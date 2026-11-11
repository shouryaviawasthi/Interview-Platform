const ReportSection = ({ title, children }) => (
  <section className="border-t border-line pt-6 first:border-t-0 first:pt-0">
    <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
    <div className="mt-3">{children}</div>
  </section>
);

export default ReportSection;
