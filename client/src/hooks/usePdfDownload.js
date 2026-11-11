import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { interviewApi } from "../lib/api";

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const usePdfDownload = (session, interviewId, filename) => {
  const [downloading, setDownloading] = useState(false);

  const download = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await interviewApi.getReportPdfBlob(session, interviewId);
      triggerDownload(blob, filename);
    } catch (err) {
      toast.error(err.message || "Couldn't download the PDF.");
    } finally {
      setDownloading(false);
    }
  }, [session, interviewId, filename]);

  return { download, downloading };
};
