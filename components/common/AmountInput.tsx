import React from "react";

interface AmountInputProps {
  amount: string;
  onChange: (value: string) => void;
  onMax?: () => void;
}

export function AmountInput({ amount, onChange, onMax }: AmountInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
      .replace("$", "")
      .replace(",", ".")
      .replace(/[^0-9.]/g, "");
    if (value.split(".").length > 2) return;
    if (value.split(".")[1]?.length > 2) return;

    onChange(value);
  };

  return (
    <div className="flex flex-col items-center">
      <input
        placeholder="$0.00"
        className="mb-1 w-full border-none text-center text-[54px] font-bold outline-none focus:ring-0"
        value={amount ? `$${amount}` : ""}
        onChange={handleChange}
        style={{ maxWidth: 200 }}
      />
      {onMax && (
        <button
          type="button"
          onClick={onMax}
          className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
        >
          Max
        </button>
      )}
    </div>
  );
}
