import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft, Key } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Retrieve current active session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setHasSession(true);
        } else {
          // If no immediate session, check if URL has hash fragments indicating recovery redirect.
          // Sometimes the Supabase JS SDK takes a moment to parse the URL fragments and log the user in.
          const hash = window.location.hash;
          if (hash && (hash.includes("access_token=") || hash.includes("type=recovery"))) {
            // Wait brief moment for client library to handle url parsing
            await new Promise((resolve) => setTimeout(resolve, 800));
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession) {
              setHasSession(true);
            }
          }
        }
      } catch (e) {
        console.error("Error verifying recovery session:", e);
      } finally {
        setChecking(false);
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      // Update user password using Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setSuccess(true);

      // Sign the user out to force a clean login with the new password
      await supabase.auth.signOut().catch(e => console.error("Sign out error post-reset:", e));
      localStorage.removeItem("roomfind_user");

      // Redirect to login after a short delay
      setTimeout(() => {
        navigate("/login");
      }, 2500);

    } catch (err: any) {
      console.error("Error resetting password:", err);
      setError(err.message || "An error occurred while updating your password.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#00D4AA]/30 border-t-[#00D4AA] rounded-full animate-spin" />
          <p className="text-[#94A3B8] text-xs">Validating recovery link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-[#0B1120] flex items-center justify-center p-4 overflow-auto">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,170,0.03)_1px,transparent_1px),linear-gradient(to_right,rgba(0,212,170,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[#00D4AA]/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-56 h-56 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative w-full max-w-md">
        <div className="bg-[#0F1729] rounded-2xl border border-white/10 p-8 shadow-2xl">
          
          {!hasSession ? (
            // Invalid/Expired session state
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl border border-red-500/20 flex items-center justify-center mx-auto mb-6 shadow-xl">
                <AlertCircle size={32} className="text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Reset Link Expired or Invalid
              </h2>
              <p className="text-[#94A3B8] text-sm leading-relaxed mb-6">
                This password reset link is invalid, expired, or has already been used. Please request a new link from the sign-in screen.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="w-full bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-[#0F1729] font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg hover:shadow-[#00D4AA]/20 flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} />
                Back to Login
              </button>
            </div>
          ) : (
            // Active recovery session - show reset form
            <>
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-[#00D4AA]/10 rounded-2xl border border-[#00D4AA]/20 flex items-center justify-center mb-4 shadow-xl">
                  <Key size={32} className="text-[#00D4AA]" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Reset Your Password
                </h2>
                <p className="text-[#94A3B8] text-center text-sm leading-relaxed">
                  Enter your new password below to regain secure access to the portal.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-6 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {success && (
                <div className="flex items-start gap-3 bg-[#00D4AA]/10 border border-[#00D4AA]/20 rounded-xl px-4 py-3 mb-6 animate-in fade-in slide-in-from-top-2">
                  <CheckCircle2 size={18} className="text-[#00D4AA] mt-0.5 flex-shrink-0" />
                  <p className="text-[#00D4AA] text-sm">
                    Password successfully reset! Redirecting to login...
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wider block">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                      disabled={success}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50 focus:ring-1 focus:ring-[#00D4AA]/30 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wider block">
                    Confirm New Password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    disabled={success}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50 focus:ring-1 focus:ring-[#00D4AA]/30 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || success}
                  className="w-full bg-[#00D4AA] hover:bg-[#00D4AA]/90 disabled:opacity-50 text-[#0F1729] font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg hover:shadow-[#00D4AA]/20 flex items-center justify-center gap-2"
                >
                  {loading && <div className="w-4 h-4 border-2 border-[#0F1729]/30 border-t-[#0F1729] rounded-full animate-spin" />}
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
