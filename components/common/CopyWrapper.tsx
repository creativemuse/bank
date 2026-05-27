import { ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CheckIcon, Square2StackIcon } from "@heroicons/react/24/outline";
import { copyToClipboard } from "@/utils/copyToClipboard";

interface CopyWrapperProps {
  toCopy?: string;
  className?: string;
  children?: ReactNode;
  iconPosition?: "left" | "right";
  /** When true, only the copy icon is shown (no "Copy" label). Use when display text lives outside the button. */
  iconOnly?: boolean;
}

export function CopyWrapper({
  toCopy,
  className,
  children,
  iconPosition = "left",
  iconOnly = false,
}: CopyWrapperProps) {
  const [justCopied, setJustCopied] = useState(false);

  useEffect(() => {
    if (justCopied) {
      setTimeout(() => {
        setJustCopied(false);
      }, 3_000);
    }
  }, [justCopied]);

  const iconClasses = "w-4 h-4 text-gray-900 dark:text-gray-100 shrink-0";
  const icon = justCopied ? (
    <CheckIcon className={cn("h-4 w-4 text-emerald-500")} aria-hidden />
  ) : (
    <Square2StackIcon className={iconClasses} aria-hidden />
  );

  const handleCopy = async (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const text = toCopy ?? "";
    if (!text) {
      return;
    }

    const copied = await copyToClipboard(text);
    if (copied) {
      setJustCopied(true);
    }
  };

  return (
    <button
      type="button"
      className={cn(
        "flex cursor-pointer items-center gap-2 select-none",
        iconPosition === "right" && "flex-row-reverse",
        justCopied && "text-emerald-500",
        className
      )}
      aria-label={justCopied ? "Copied" : "Copy to clipboard"}
      // stopPropagation only — preventDefault on pointerDown breaks iOS clipboard in some cases
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={handleCopy}
      data-testid="copy-wrapper"
    >
      {icon}
      {!iconOnly && (children ?? (justCopied ? "Copied" : "Copy"))}
    </button>
  );
}
