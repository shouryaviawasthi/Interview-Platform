import { forwardRef } from "react";

const Input = forwardRef(
  ({ label, error, icon: Icon, className = "", id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <label htmlFor={inputId} className="block">
        {label && (
          <span className="mb-1.5 block text-sm font-medium text-ink-700">{label}</span>
        )}
        <span className="relative flex items-center">
          {Icon && (
            <Icon className="pointer-events-none absolute left-3.5 h-4.5 w-4.5 text-ink-400" />
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder:text-ink-400 transition-colors focus:outline-none focus:ring-4 focus:ring-lav-100 focus:border-lav-400 ${
              Icon ? "pl-10" : ""
            } ${error ? "border-[#D14D5B]" : "border-ink-100"} ${className}`}
            {...props}
          />
        </span>
        {error && <span className="mt-1.5 block text-xs text-[#D14D5B]">{error}</span>}
      </label>
    );
  }
);

Input.displayName = "Input";
export default Input;
