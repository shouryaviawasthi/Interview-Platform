import { forwardRef } from "react";

const VARIANTS = {
  primary:
    "bg-lav-600 text-white hover:bg-lav-700 shadow-[0_1px_2px_rgba(43,37,67,0.08),0_10px_20px_-8px_rgba(110,89,232,0.55)] active:bg-lav-800",
  secondary:
    "bg-white text-ink-700 border border-ink-100 hover:border-lav-300 hover:bg-lav-50",
  ghost: "text-ink-600 hover:bg-lav-100/70 hover:text-ink-800",
  danger: "bg-white text-[#D14D5B] border border-[#F3D2D6] hover:bg-[#FCE9EB]",
  dark: "bg-ink-800 text-white hover:bg-ink-900",
};

const SIZES = {
  sm: "text-sm px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2.5 gap-2",
  lg: "text-base px-6 py-3 gap-2",
};

const Button = forwardRef(
  (
    {
      children,
      variant = "primary",
      size = "md",
      className = "",
      isLoading = false,
      disabled = false,
      icon: Icon,
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center rounded-xl font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : (
          Icon && <Icon className="h-4 w-4 shrink-0" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
