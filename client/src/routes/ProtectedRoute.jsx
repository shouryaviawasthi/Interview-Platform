import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loader from "../components/ui/Loader";
import { ROUTES } from "../constants/routes";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <Loader label="Checking your session" />;
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;

  return children;
};

export default ProtectedRoute;
