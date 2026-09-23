import { useEffect, useState } from "react";

/**
 * LiveTimer
 *
 * Displays a running HH:MM:SS timer based on a `startedAt` Date.
 * The timer is calculated from the authoritative `startedAt` timestamp,
 * so it correctly restores after a page refresh.
 */
const LiveTimer = ({ startedAt, className = "" }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;

    // Compute initial elapsed on mount (handles page-refresh case)
    const computeElapsed = () =>
      Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));

    setElapsed(computeElapsed());

    const interval = setInterval(() => {
      setElapsed(computeElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  const pad = (n) => String(n).padStart(2, "0");

  const formatted =
    hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;

  return <span className={className}>{formatted}</span>;
};

export default LiveTimer;
