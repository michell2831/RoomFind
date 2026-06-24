import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

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
      // 1. Update the password and the metadata
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false }
      });

      if (updateError) throw updateError;

      setSuccess(true);
      
      // Update local storage to match the new metadata state
      const storedUser = localStorage.getItem('roomfind_user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        userData.mustChangePassword = false;
        localStorage.setItem('roomfind_user', JSON.stringify(userData));
      }

      // 2. Redirect to dashboard after a short delay
      setTimeout(() => {
        // We use window.location.href to force a full app reload and pick up the new auth state
        window.location.href = "/";
      }, 2000);

    } catch (err: any) {
      console.error("Error updating password:", err);
      setError(err.message || "An error occurred while updating your password.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('roomfind_user');
      await supabase.auth.signOut();
    } catch (e) {
      console.error('signOut error', e);
    }
    window.location.href = "/login";
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#0B1120] flex items-center justify-center p-4 overflow-auto">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,170,0.03)_1px,transparent_1px),linear-gradient(to_right,rgba(0,212,170,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      <div className="relative w-full max-w-md">
        <div className="bg-[#0F1729] rounded-2xl border border-white/10 p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-[#00D4AA]/10 rounded-2xl border border-[#00D4AA]/20 flex items-center justify-center mb-4 shadow-xl">
              <Lock size={32} className="text-[#00D4AA]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Secure Your Account
            </h2>
            <p className="text-[#94A3B8] text-center text-sm leading-relaxed">
              Your administrator requires you to change your password before continuing to the portal.
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
              <p className="text-[#00D4AA] text-sm">Password updated successfully! Redirecting to dashboard...</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50 focus:ring-1 focus:ring-[#00D4AA]/30 transition-all"
              />
            </div>

            <div className="pt-2 space-y-3">
              <button
                type="submit"
                disabled={loading || success}
                className="w-full bg-[#00D4AA] hover:bg-[#00D4AA]/90 disabled:opacity-50 text-[#0F1729] font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg hover:shadow-[#00D4AA]/20 flex items-center justify-center gap-2"
              >
                {loading && <div className="w-4 h-4 border-2 border-[#0F1729]/30 border-t-[#0F1729] rounded-full animate-spin" />}
                {loading ? "Updating..." : "Change Password & Login"}
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-semibold py-3.5 rounded-xl text-sm transition-all border border-white/10 flex items-center justify-center gap-2"
              >
                Cancel & Sign Out
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
