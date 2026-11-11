import { forwardRef } from "react";

const TextArea = forwardRef(({ label, error, className = "", id, ...props }, ref) => {
  const inputId = id || props.name;
  return (
    <label htmlFor={inputId} className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-700">{label}</span>}
      <textarea
        ref={ref}
        id={inputId}
        className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder:text-ink-400 transition-colors focus:outline-none focus:ring-4 focus:ring-lav-100 focus:border-lav-400 ${
          error ? "border-[#D14D5B]" : "border-ink-100"
        } ${className}`}
        {...props}
      />
      {error && <span className="mt-1.5 block text-xs text-[#D14D5B]">{error}</span>}
    </label>
  );
});

TextArea.displayName = "TextArea";
export default TextArea;
