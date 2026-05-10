"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { PrimaryButton } from "@/components/common/PrimaryButton";

interface OTPVerificationProps {
  /** "email" or "phone" */
  type: "email" | "phone";
  /** The email address or phone number being verified */
  destination: string;
  /** Called when user submits the OTP code. Reject the promise to display an error. */
  onVerify: (code: string) => Promise<void>;
  /** Called to resend the OTP. Reject to display an error. */
  onResend: () => Promise<void>;
  /** Optional error message from parent (e.g. send-OTP failure) */
  error?: string | null;
}

const CODE_LENGTH = 6;

export function OTPVerification({
  type,
  destination,
  onVerify,
  onResend,
  error: externalError,
}: OTPVerificationProps) {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Track which code we last attempted, so we don't auto-resubmit
  // the same failed code on keystroke updates.
  const lastSubmittedCode = useRef<string | null>(null);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerify = useCallback(
    async (code: string) => {
      if (code.length !== CODE_LENGTH || isVerifying) return;
      if (lastSubmittedCode.current === code) return;

      lastSubmittedCode.current = code;
      setIsVerifying(true);
      setInternalError(null);

      try {
        await onVerify(code);
      } catch (err: unknown) {
        const message =
          (err as { message?: string } | null)?.message ||
          "Invalid or expired code. Please try again.";
        setInternalError(message);
        // Clear digits so the user can retype without manually backspacing
        setDigits(Array(CODE_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
        // Allow re-submit of a previously-failed code after the user retypes
        lastSubmittedCode.current = null;
      } finally {
        setIsVerifying(false);
      }
    },
    [onVerify, isVerifying]
  );

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    if (internalError) setInternalError(null);

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (digit && index === CODE_LENGTH - 1 && next.every((d) => d)) {
      void handleVerify(next.join(""));
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;

    const next = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);

    if (internalError) setInternalError(null);

    const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();

    if (next.every((d) => d)) {
      void handleVerify(next.join(""));
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending || isVerifying) return;
    setIsResending(true);
    setInternalError(null);

    try {
      await onResend();
      setResendCooldown(30);
      setDigits(Array(CODE_LENGTH).fill(""));
      lastSubmittedCode.current = null;
      inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      const message =
        (err as { message?: string } | null)?.message || "Failed to resend code. Please try again.";
      setInternalError(message);
    } finally {
      setIsResending(false);
    }
  };

  const code = digits.join("");
  const isComplete = code.length === CODE_LENGTH;
  const label = type === "email" ? "email" : "phone number";
  const displayError = internalError || externalError;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-center text-sm text-gray-900">
        Enter the {CODE_LENGTH}-digit code sent to your {label}
      </p>
      <p className="text-center text-xs font-medium break-all text-black">{destination}</p>

      <div className="flex gap-2" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={isVerifying}
            aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
            className="h-12 w-10 rounded-md border border-gray-600 bg-gray-300 text-center text-lg font-semibold text-black focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
          />
        ))}
      </div>

      {displayError && (
        <p className="text-center text-sm font-medium text-red-700" role="alert">
          {displayError}
        </p>
      )}

      <PrimaryButton onClick={() => void handleVerify(code)} disabled={!isComplete || isVerifying}>
        {isVerifying ? "Verifying..." : "Verify"}
      </PrimaryButton>

      <button
        type="button"
        onClick={handleResend}
        disabled={resendCooldown > 0 || isResending || isVerifying}
        className="text-sm text-blue-700 hover:underline disabled:text-gray-900 disabled:no-underline"
      >
        {isResending
          ? "Sending..."
          : resendCooldown > 0
            ? `Resend code in ${resendCooldown}s`
            : "Resend code"}
      </button>
    </div>
  );
}
