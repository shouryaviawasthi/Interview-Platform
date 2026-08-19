import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";

const DashboardLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-lav-50">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-64 animate-rise-in">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <Outlet context={{ onMenuClick: () => setMobileOpen(true) }} />
      </div>
    </div>
  );
};

export default DashboardLayout;
