import { useEffect } from "react";
import { FiX } from "react-icons/fi";

const Modal = ({ isOpen, onClose, title, children, footer, maxWidth = "max-w-lg" }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm animate-rise-in"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${maxWidth} card-surface animate-rise-in max-h-[90vh] overflow-hidden flex flex-col`}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-lav-100 hover:text-ink-700 transition-colors"
            aria-label="Close"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto scrollbar-thin px-6 py-5">{children}</div>
        {footer && <div className="border-t border-ink-100 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
