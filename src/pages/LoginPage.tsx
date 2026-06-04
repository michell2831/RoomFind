import React, { useState } from "react";
import { supabase } from '@/lib/supabase'
import { Wifi, Lock, Mail, Eye, EyeOff, AlertCircle, User as UserIcon, Building, ArrowLeft, CheckCircle2 } from "lucide-react";

const DEMO_USERS = [
  { email: "admin@university.edu", password: "admin123" },
  { email: "m.santos@university.edu", password: "faculty123" },
];

interface LoginPageProps {
  onLogin?: (email: string, password: string) => Promise<boolean>;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [name, setName] = useState("");
  const [courseAndSection, setCourseAndSection] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Direct guidance if trying to reset demo credentials
    const isDemoEmail = DEMO_USERS.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (isDemoEmail) {
      setError("Demo accounts cannot have their passwords reset. Please use the demo credentials at the bottom of the sign-in screen, or enter a registered Supabase email.");
      setLoading(false);
      return;
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;

      setResetSuccess(true);
    } catch (err: any) {
      console.error("Supabase reset password error:", err);
      setError(err.message || "Failed to send reset link. Please verify your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        // Handle Sign Up - try Supabase with timeout
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
          });

          clearTimeout(timeoutId);

          if (authError) throw authError;

          if (authData.user) {
            // Check if user already exists in public.users to avoid unique constraint violations
            const { data: existingUser } = await supabase
              .from('users')
              .select('id')
              .eq('email', email)
              .maybeSingle();

            if (!existingUser) {
              const { error: insertError } = await supabase.from('users').insert({
                name: name || email.split('@')[0],
                email,
                course_and_section: courseAndSection || 'General',
                role: 'student',
                is_active: true
              });

              if (insertError) throw insertError;
            }
          }
        } catch (supabaseError: any) {
          console.error('Supabase error:', supabaseError);
          throw new Error(supabaseError.message || "Sign up failed. Please check your connection and try again.");
        }
      } else {
        // Always try to sign in via Supabase Auth first (respecting authentications/RLS)
        let signInError = null;
        try {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) signInError = error;
        } catch (err) {
          signInError = err;
        }

        // Auto-register demo users in Supabase Auth if they aren't registered yet
        const demoUser = DEMO_USERS.find(u => u.email === email && u.password === password);
        if (signInError && demoUser) {
          console.log("Found demo user not yet registered in Supabase Auth. Auto-registering...");
          try {
            // 1. Sign up the user in Supabase Auth
            const { error: signUpError } = await supabase.auth.signUp({
              email,
              password,
            });
            if (signUpError) throw signUpError;

            // 2. Retry sign in
            const { error: retrySignInError } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (retrySignInError) throw retrySignInError;
          } catch (regError: any) {
            console.error('Auto-registration of demo user failed:', regError);
            setError(regError.message || "Failed to auto-register demo user in Supabase.");
          }
        } else if (signInError) {
          console.error('Supabase sign in error:', signInError);
          setError((signInError as any).message || "Invalid credentials or connection error.");
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
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
          <div className="flex flex-col items-center justify-center mb-4">
            <div className="w-50 h-32 flex items-center justify-center p-2 overflow-hidden">
              <img src="/logo_trans.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            {/* <h1 className="text-white font-bold text-xl mt-4 tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              RoomFindx
            </h1> */}
          </div>

          <h2 className="text-white text-xl font-semibold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {isForgotPassword ? "Reset Password" : (isSignUp ? "Create Account" : "Sign in")}
          </h2>
          <p className="text-[#94A3B8] text-sm mb-6">
            {isForgotPassword ? "Enter your email to receive a recovery link" : (isSignUp ? "Register as a student" : "Welcome to RoomFind")}
          </p>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 mb-5">
              <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          {isForgotPassword ? (
            resetSuccess ? (
              <div className="flex flex-col items-center justify-center text-center py-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-[#00D4AA]/10 rounded-full flex items-center justify-center shadow-lg border border-[#00D4AA]/20">
                  <CheckCircle2 className="text-[#00D4AA] w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-white font-bold text-lg">Reset Link Sent!</h3>
                  <p className="text-[#94A3B8] text-sm leading-relaxed">
                    We've sent a password recovery link to <span className="text-white font-semibold">{email}</span>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setResetSuccess(false);
                    setError("");
                  }}
                  className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2 mt-2"
                >
                  <ArrowLeft size={14} />
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label className="text-[#94A3B8] text-xs font-medium mb-1.5 block uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50 focus:ring-1 focus:ring-[#00D4AA]/30 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#00D4AA] hover:bg-[#00D4AA]/90 disabled:bg-[#00D4AA]/40 text-[#0F1729] font-semibold py-2.5 rounded-lg text-sm transition-all mt-2 flex items-center justify-center gap-2"
                >
                  {loading && <div className="w-4 h-4 border-2 border-[#0F1729]/30 border-t-[#0F1729] rounded-full animate-spin" />}
                  {loading ? "Sending link..." : "Send Reset Link"}
                </button>

                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setError("");
                    }}
                    className="text-[#00D4AA] hover:text-[#00D4AA]/80 text-sm font-medium transition-colors flex items-center justify-center gap-2 mx-auto"
                  >
                    <ArrowLeft size={14} />
                    Back to Sign In
                  </button>
                </div>
              </form>
            )
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <>
                    <div>
                      <label className="text-[#94A3B8] text-xs font-medium mb-1.5 block uppercase tracking-wider">
                        Full Name
                      </label>
                      <div className="relative">
                        <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Full Name"
                          required={isSignUp}
                          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50 focus:ring-1 focus:ring-[#00D4AA]/30 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[#94A3B8] text-xs font-medium mb-1.5 block uppercase tracking-wider">
                        Course and Section
                      </label>
                      <div className="relative">
                        <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                        <input
                          type="text"
                          value={courseAndSection}
                          onChange={(e) => setCourseAndSection(e.target.value)}
                          placeholder="Course and Section"
                          required={isSignUp}
                          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00D4AA]/50 focus:ring-1 focus:ring-[#00D4AA]/30 transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}

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
                      placeholder="Email"
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
                      placeholder="Password"
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
                  {!isSignUp && (
                    <div className="flex justify-end mt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setError("");
                        }}
                        className="text-xs text-[#00D4AA]/70 hover:text-[#00D4AA] transition-colors"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#00D4AA] hover:bg-[#00D4AA]/90 disabled:bg-[#00D4AA]/40 text-[#0F1729] font-semibold py-2.5 rounded-lg text-sm transition-all mt-2 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-[#0F1729]/30 border-t-[#0F1729] rounded-full animate-spin" />
                  ) : null}
                  {loading ? (isSignUp ? "Creating account..." : "Signing in...") : (isSignUp ? "Create Account" : "Sign In")}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError("");
                  }}
                  className="text-[#00D4AA] hover:text-[#00D4AA]/80 text-sm font-medium transition-colors"
                >
                  {isSignUp ? "Already have an account? Sign in" : "Need an account? Create one"}
                </button>
              </div>
            </>
          )}


        </div>
      </div>
    </div>
  );
}
