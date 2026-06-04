import React from "react";
import { Navigate, Outlet } from "react-router-dom";

interface ProtectedRouteProps {
  currentUser: { id: number; name: string; email: string; role: "admin" | "faculty" | "student"; mustChangePassword?: boolean } | null;
  allowedRoles?: string[];
  redirectPath?: string;
  isChangePasswordPage?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  currentUser,
  allowedRoles,
  redirectPath = "/",
  isChangePasswordPage = false,
}) => {
  const isAuthenticated = !!currentUser;
  const hasRequiredRole = !allowedRoles || (currentUser && (currentUser.role === "admin" || allowedRoles.includes(currentUser.role)));

  // 1. Authentication check
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 2. Force Password Change check
  if (currentUser?.mustChangePassword && !isChangePasswordPage) {
    return <Navigate to="/change-password" replace />;
  }

  // 3. Authorization check
  if (!hasRequiredRole) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0B1120] flex flex-col items-center justify-center p-4 text-center overflow-auto">
        {/* Background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,170,0.03)_1px,transparent_1px),linear-gradient(to_right,rgba(0,212,170,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

        <div className="relative flex flex-col items-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-2xl border border-red-500/20 flex items-center justify-center mb-6 shadow-2xl">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h3 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>403 - Forbidden</h3>
          <p className="text-[#94A3B8] max-w-md text-lg leading-relaxed mb-8">
            Access to this resorce on the server is denied!
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-8 py-3 bg-[#00D4AA] text-[#0F1729] font-bold rounded-xl hover:bg-[#00D4AA]/90 transition-all shadow-lg hover:shadow-[#00D4AA]/20 hover:-translate-y-0.5 active:translate-y-0"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
