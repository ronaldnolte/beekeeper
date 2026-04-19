import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, ArrowRight, UserCircle2 } from 'lucide-react';

export const Auth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isResetMode, setIsResetMode] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isResetMode) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { 
        redirectTo: window.location.origin 
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for the password reset link.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    
    setLoading(false);
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ 
      email: 'guest@beektools.com', 
      password: 'Guest2026#'
    });
    if (error) setError('Guest login failed. Please try again later.');
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-[#FFFBF0] to-[#f4ecd8]">
      <div className="w-full max-w-md card p-6 sm:p-8 relative overflow-hidden">
        {/* Honeycomb subtle accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#E67E22] opacity-10 rounded-full blur-2xl"></div>
        
        <div className="text-center mb-8 relative z-10">
          <div className="w-24 h-24 mx-auto flex items-center justify-center mb-2">
            <img src="/logo.png" alt="Beektools Logo" className="w-full h-full object-contain drop-shadow-md" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text)]">TBH Beekeeper</h1>
          <p className="text-gray-500 mt-1 font-medium text-sm sm:text-base">Manage your top-bar hives with ease.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 font-bold">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 text-sm rounded-xl border border-green-100 font-bold">
            {message}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5 relative z-10">
          <div>
            <label className="block text-xs sm:text-sm font-black text-[var(--color-text)] mb-1 uppercase tracking-wide">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 sm:py-3.5 border-2 border-[#E6DCC3] rounded-xl focus:ring-4 focus:ring-[#E67E22]/20 focus:border-[#E67E22] transition-all bg-white text-gray-900 font-bold"
                placeholder="beekeeper@example.com"
                required
              />
            </div>
          </div>

          {!isResetMode && (
            <div>
              <label className="block text-xs sm:text-sm font-black text-[var(--color-text)] mb-1 uppercase tracking-wide">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 sm:py-3.5 border-2 border-[#E6DCC3] rounded-xl focus:ring-4 focus:ring-[#E67E22]/20 focus:border-[#E67E22] transition-all bg-white text-gray-900 font-bold"
                  placeholder="••••••••"
                  required={!isResetMode}
                />
              </div>
            </div>
          )}

          {!isResetMode && (
            <div className="flex justify-end">
              <button 
                type="button" 
                onClick={() => { setIsResetMode(true); setError(null); setMessage(null); }}
                className="text-xs sm:text-sm font-bold text-[#E67E22] hover:text-[#D35400] transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          )}

          {isResetMode && (
            <div className="flex justify-end">
              <button 
                type="button" 
                onClick={() => { setIsResetMode(false); setError(null); setMessage(null); }}
                className="text-xs sm:text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Back to Login
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-[#E67E22] to-[#D35400] text-white rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? (isResetMode ? 'Sending...' : 'Logging in...') : (isResetMode ? 'Send Reset Link' : 'Log In')}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="mt-8 relative z-10">
          <div className="relative flex items-center py-5">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-medium">OR</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <button
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full py-3.5 bg-white border-2 border-[#E6DCC3] text-[#4A3C28] rounded-xl font-bold text-base hover:bg-gray-50 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            <UserCircle2 size={18} className="text-[#E67E22]" />
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
};
