export const Spinner = ({ className = "h-5 w-5" }) => (
  <span
    className={`inline-block rounded-full border-2 border-lav-200 border-t-lav-600 animate-spin ${className}`}
  />
);

const Loader = ({ label = "Loading" }) => (
  <div className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-3">
    <Spinner className="h-8 w-8" />
    <p className="text-sm text-ink-400 font-medium">{label}&hellip;</p>
  </div>
);

export default Loader;
