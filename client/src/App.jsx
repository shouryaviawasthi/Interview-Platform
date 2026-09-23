import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import { ROUTES } from "./constants/routes";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Interviews from "./pages/Interviews";
import InterviewNew from "./pages/InterviewNew";
import InterviewDetail from "./pages/InterviewDetail";
import Transcript from "./pages/Transcript";
import CandidateReport from "./pages/CandidateReport";
import InterviewerReport from "./pages/InterviewerReport";
import InterviewAnalytics from "./pages/InterviewAnalytics";
import InterviewEndDashboard from "./pages/InterviewEndDashboard";
import CandidateReportSimple from "./pages/CandidateReportSimple";
import InterviewerReportSimple from "./pages/InterviewerReportSimple";
import JoinInterview from "./pages/JoinInterview";
import InterviewRoom from "./pages/InterviewRoom";
import NotFound from "./pages/NotFound";

const GuestOnlyRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (isAuthenticated) return <Navigate to={ROUTES.DASHBOARD} replace />;
  return children;
};

const AppRoutes = () => (
  <Routes>
    <Route path={ROUTES.HOME} element={<Landing />} />
    <Route
      path={ROUTES.LOGIN}
      element={
        <GuestOnlyRoute>
          <Login />
        </GuestOnlyRoute>
      }
    />
    <Route
      path={ROUTES.REGISTER}
      element={
        <GuestOnlyRoute>
          <Register />
        </GuestOnlyRoute>
      }
    />

    {/* Public candidate flow */}
    <Route path={ROUTES.JOIN} element={<JoinInterview />} />
    <Route path={ROUTES.ROOM} element={<InterviewRoom />} />

    {/* ── Standalone pages — no sidebar layout ── */}
    {/* End-of-interview summary (interviewer, post-session) */}
    <Route
      path={ROUTES.INTERVIEW_END_DASHBOARD}
      element={
        <ProtectedRoute>
          <InterviewEndDashboard />
        </ProtectedRoute>
      }
    />
    {/* Simple document-style report pages */}
    <Route
      path={ROUTES.CANDIDATE_REPORT_SIMPLE}
      element={
        <ProtectedRoute>
          <CandidateReportSimple />
        </ProtectedRoute>
      }
    />
    <Route
      path={ROUTES.INTERVIEWER_REPORT_SIMPLE}
      element={
        <ProtectedRoute>
          <InterviewerReportSimple />
        </ProtectedRoute>
      }
    />

    {/* Authenticated dashboard shell */}
    <Route
      element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }
    >
      <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
      <Route path={ROUTES.INTERVIEWS} element={<Interviews />} />
      <Route path={ROUTES.INTERVIEW_NEW} element={<InterviewNew />} />
      <Route path={ROUTES.INTERVIEW_DETAIL} element={<InterviewDetail />} />
      <Route path={ROUTES.TRANSCRIPT} element={<Transcript />} />
      <Route path={ROUTES.CANDIDATE_REPORT} element={<CandidateReport />} />
      <Route path={ROUTES.INTERVIEWER_REPORT} element={<InterviewerReport />} />
      <Route path={ROUTES.ANALYTICS} element={<InterviewAnalytics />} />
    </Route>

    <Route path={ROUTES.NOT_FOUND} element={<NotFound />} />
  </Routes>
);

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#2B2543",
              color: "#F6F4FF",
              borderRadius: "12px",
              fontSize: "13px",
              fontFamily: "Inter, sans-serif",
            },
            success: { iconTheme: { primary: "#8A6DEC", secondary: "#F6F4FF" } },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
