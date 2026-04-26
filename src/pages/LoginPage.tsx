import React, { useState } from "react";
import { supabase } from '@/lib/supabase'
import { Wifi, Lock, Mail, Eye, EyeOff, AlertCircle } from "lucide-react";

interface LoginPageProps {
  onLogin?: (email: string, password: string) => Promise<boolean>;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    let success = false;
    if (onLogin) {
      success = await onLogin(email, password);
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      success = !error;
    }
    if (!success) {
      setError("Invalid credentials. Use admin@university.edu / admin123");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,170,0.03)_1px,transparent_1px),linear-gradient(to_right,rgba(0,212,170,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[#00D4AA]/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-56 h-56 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-[#0F1729] rounded-2xl border border-white/10 p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#00D4AA]/15 border border-[#00D4AA]/20 flex items-center justify-center">
              <Wifi size={20} className="text-[#00D4AA]" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                RoomFind
              </p>
              <p className="text-[#94A3B8] text-xs tracking-widest uppercase">Admin Portal</p>
            </div>
          </div>

          <h2 className="text-white text-xl font-semibold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Sign in
          </h2>
          <p className="text-[#94A3B8] text-sm mb-6">Access your dashboard</p>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 mb-5">
              <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[#94A3B8] text-xs font-medium mb-1.5 block uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@university.edu"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50 focus:ring-1 focus:ring-[#00D4AA]/30 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-[#94A3B8] text-xs font-medium mb-1.5 block uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-10 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50 focus:ring-1 focus:ring-[#00D4AA]/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00D4AA] hover:bg-[#00D4AA]/90 disabled:bg-[#00D4AA]/40 text-[#0F1729] font-semibold py-2.5 rounded-lg text-sm transition-all mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-[#0F1729]/30 border-t-[#0F1729] rounded-full animate-spin" />
              ) : null}
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5">
            <p className="text-[#94A3B8] text-xs text-center">Demo credentials</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between bg-white/3 rounded px-3 py-1.5">
                <span className="text-[#94A3B8] text-[11px] font-mono">admin@university.edu</span>
                <span className="text-[#94A3B8]/60 text-[11px] font-mono">admin123</span>
              </div>
              <div className="flex justify-between bg-white/3 rounded px-3 py-1.5">
                <span className="text-[#94A3B8] text-[11px] font-mono">m.santos@university.edu</span>
                <span className="text-[#94A3B8]/60 text-[11px] font-mono">faculty123</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
