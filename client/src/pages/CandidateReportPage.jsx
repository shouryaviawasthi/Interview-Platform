import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FiRefreshCw } from "react-icons/fi";
import { interviewApi } from "../lib/api";
import { usePdfDownload } from "../hooks/usePdfDownload";
import CandidateReportView from "../components/report/CandidateReportView";
import Button from "../components/ui/Button";
import { PageSpinner } from "../components/ui/Spinner";

const CandidateReportPage = () => {
  const { token } = useParams();
  const session = { type: "candidate", joinToken: token };
  const [interviewId, setInterviewId] = useState(null);
  const [state, setState] = useState({ loading: true, data: null, error: null });

  const loadReport = useCallback((id) => {
    setState((prev) => ({ ...prev, loading: true }));
    interviewApi
      .getReport(session, id)
      .then((res) => setState({ loading: false, data: res, error: null }))
      .catch((err) => setState({ loading: false, data: null, error: err }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    interviewApi
      .joinByToken(token)
      .then((res) => {
        setInterviewId(res.interview.id);
        loadReport(res.interview.id);
      })
      .catch((err) => setState({ loading: false, data: null, error: err }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const { download, downloading } = usePdfDownload(session, interviewId, "my-interview-feedback.pdf");

  return (
    <div className="min-h-screen bg-paper px-6 py-10">
      <div className="mx-auto max-w-2xl">
        {state.loading && <PageSpinner label="Loading your report…" />}

        {!state.loading && state.error && (
          <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
            <h2 className="font-display text-lg font-semibold text-ink">{state.error.message}</h2>
            <p className="mt-1.5 text-sm text-ink-soft">
              {state.error.status === 404 ? "Your feedback will appear here once the interview ends." : "Something went wrong loading your report."}
            </p>
            <Button className="mt-5" variant="secondary" onClick={() => interviewId && loadReport(interviewId)}>
              <FiRefreshCw size={15} /> Check again
            </Button>
          </div>
        )}

        {!state.loading && state.data && <CandidateReportView data={state.data} onDownloadPdf={download} downloading={downloading} />}
      </div>
    </div>
  );
};

export default CandidateReportPage;
