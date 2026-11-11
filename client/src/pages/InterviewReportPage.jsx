import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FiArrowLeft, FiRefreshCw } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { interviewApi } from "../lib/api";
import { usePdfDownload } from "../hooks/usePdfDownload";
import InterviewerReportView from "../components/report/InterviewerReportView";
import Button from "../components/ui/Button";
import { PageSpinner } from "../components/ui/Spinner";

const InterviewReportPage = () => {
  const { id } = useParams();
  const { session } = useAuth();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true }));
    interviewApi
      .getReport(session, id)
      .then((res) => setState({ loading: false, data: res, error: null }))
      .catch((err) => setState({ loading: false, data: null, error: err }));
  }, [session, id]);

  useEffect(() => {
    load();
  }, [load]);

  const { download, downloading } = usePdfDownload(session, id, "interview-evaluation-report.pdf");

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await interviewApi.regenerateReport(session, id);
      toast.success("Report regenerated.");
      load();
    } catch (err) {
      toast.error(err.message || "Couldn't generate the report.");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/interviews/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <FiArrowLeft size={14} /> Back to interview
      </Link>

      {state.loading && <PageSpinner label="Loading report…" />}

      {!state.loading && state.error && (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
          <h2 className="font-display text-lg font-semibold text-ink">{state.error.message}</h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            {state.error.status === 404 ? "Once the interview ends, the report will appear here." : "Something went wrong loading the report."}
          </p>
          <Button className="mt-5" onClick={handleRegenerate} loading={regenerating}>
            <FiRefreshCw size={15} /> Generate report
          </Button>
        </div>
      )}

      {!state.loading && state.data && (
        <InterviewerReportView data={state.data} onDownloadPdf={download} downloading={downloading} onRegenerate={handleRegenerate} regenerating={regenerating} />
      )}
    </div>
  );
};

export default InterviewReportPage;
