import React from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../data/supabase';

/**
 * "Log out of Beekeeper?" confirmation, shared by the header menu and Settings.
 * Log Out used to sit one thumb-width from Ask AI in the nav bar, so it always
 * asks first.
 */
export const LogoutConfirm: React.FC<{ onCancel: () => void }> = ({ onCancel }) =>
  createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-5 sm:items-center animate-[fade-in_var(--dur-base)_var(--ease-soft)]"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-[var(--color-bg-raised)] p-6 shadow-2xl animate-[rise-in_var(--dur-base)_var(--ease-soft)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-confirm-title"
      >
        <h2 id="logout-confirm-title" className="text-lg font-black text-[var(--color-text)]">
          Log out of Beekeeper?
        </h2>
        <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
          You'll need your email and password to get back in. Nothing you've recorded is lost.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-2xl border-2 border-[var(--color-card-border)] py-3 font-bold text-[var(--color-text)] transition-colors duration-[var(--dur-fast)] active:scale-95"
          >
            Stay signed in
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.reload();
            }}
            className="flex-1 rounded-2xl bg-[var(--color-bad)] py-3 font-bold text-white transition-colors duration-[var(--dur-fast)] active:scale-95"
          >
            Log out
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
