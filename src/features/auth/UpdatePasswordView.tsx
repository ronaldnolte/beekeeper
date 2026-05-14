import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../data/supabase';
import { useAppStore } from '../../store/useAppStore';
import { Lock, ArrowRight, XCircle } from 'lucide-react';

export const UpdatePasswordView: React.FC = () => {
  const { setCurrentView } = useAppStore();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(true);

  const exchangeAttempted = useRef(false);

  useEffect(() => {
    const checkSession = async () => {
      // Prevent double-invocation in Strict Mode
      if (exchangeAttempted.current) return;
      exchangeAttempted.current = true;

      // 1. Check immediate session
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setVerifying(false);
        return;
      }

      // 2. Check for PKCE Code or Hash in URL (handled automatically by Supabase client)
      // Since Supabase intercepts the token hash automatically in the root App component,
      // the session should be available here. If not, wait for auto-recovery events.

      let timeoutId: any;

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
        if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
          if (timeoutId) clearTimeout(timeoutId);
          setVerifying(false);
          setError('');
        }
      });

      // 3. Set fallback timeout (4 seconds)
      timeoutId = setTimeout(async () => {
        const { data: { session: finalSession } } = await supabase.auth.getSession();
        setVerifying(false);
        if (!finalSession) {
          setError('Unable to verify security token. The link may have expired.');
        }
      }, 4000);

      return () => {
        subscription.unsubscribe();
        if (timeoutId) clearTimeout(timeoutId);
      };
    };

    checkSession();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Security session missing! Please click the link in your email again.');
      }

      const { error } = await supabase.auth.updateUser({ password: password });

      if (error) {
        setError(error.message);
      } else {
        setMessage('Success! Your password has been updated.');
        setTimeout(() => {
          setCurrentView('SELECT_APIARY');
        }, 2000);
      }
    } catch (err: any) {
      setError('Unexpected error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setCurrentView('AUTH');
  };

  if (verifying) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-[#FFFBF0] to-[#f4ecd8]">
        <div className="w-full max-w-md card p-6 sm:p-8 text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#E67E22] opacity-10 rounded-full blur-2xl"></div>
          <div className="animate-pulse text-5xl mb-4 relative z-10">🔑</div>
          <p className="text-gray-800 font-bold text-lg relative z-10">Verifying security link...</p>
          <p className="text-sm text-gray-500 mt-2 relative z-10">Please wait</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col p-4 sm:p-6 bg-gradient-to-br from-[#FFFBF0] to-[#f4ecd8]">
      <button 
        onClick={handleCancel}
        className="self-start mb-6 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center shadow-sm text-gray-500 hover:text-gray-800 hover:bg-white transition-all backdrop-blur-sm"
      >
        <XCircle size={24} strokeWidth={1.5} />
      </button>

      <div className="w-full max-w-md mx-auto card p-6 sm:p-8 relative overflow-hidden flex-grow flex flex-col justify-center">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#E67E22] opacity-10 rounded-full blur-2xl"></div>
        
        <div className="text-center mb-8 relative z-10">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text)]">Set New Password</h1>
          <p className="text-gray-500 mt-2 font-medium text-sm sm:text-base">Enter your new secure password below.</p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4 sm:space-y-5 relative z-10">
          <div>
            <label className="block text-xs sm:text-sm font-black text-[var(--color-text)] mb-1 uppercase tracking-wide">New Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 sm:py-3.5 border-2 border-[#E6DCC3] rounded-xl focus:ring-4 focus:ring-[#E67E22]/20 focus:border-[#E67E22] transition-all bg-white text-gray-900 font-bold"
                placeholder="Min 6 characters"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs sm:text-sm font-black text-[var(--color-text)] mb-1 uppercase tracking-wide">Confirm Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 sm:py-3.5 border-2 border-[#E6DCC3] rounded-xl focus:ring-4 focus:ring-[#E67E22]/20 focus:border-[#E67E22] transition-all bg-white text-gray-900 font-bold"
                placeholder="Re-type password"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 font-bold text-center">
              {error}
            </div>
          )}
          
          {message && (
            <div className="p-4 bg-green-50 text-green-700 text-sm rounded-xl border border-green-100 font-bold text-center">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3.5 bg-gradient-to-r from-[#E67E22] to-[#D35400] text-white rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? 'Updating...' : 'Update Password'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
};
