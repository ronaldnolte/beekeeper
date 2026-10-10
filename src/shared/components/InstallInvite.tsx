import React, { useSyncExternalStore } from 'react';
import { Download, X } from 'lucide-react';
import { installApp, shouldInvite, snoozeInstall, subscribeInstall } from '../installPrompt';

/**
 * Dashboard invitation to install the site as an app, shown only when the
 * browser offers it. "Not now" hides it for 30 days; Settings → About keeps an
 * Install button for later.
 */
export const InstallInvite: React.FC = () => {
  const visible = useSyncExternalStore(subscribeInstall, shouldInvite, () => false);
  if (!visible) return null;

  return (
    <div className="w-full max-w-2xl px-4 mb-6">
      <div className="card flex items-center gap-3 p-3 sm:p-4" role="region" aria-label="Install Beekeeper">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-wash)] text-[var(--color-primary)]">
          <Download size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[var(--color-text)]">Install Beekeeper?</p>
          <p className="text-xs text-[var(--color-text-muted)]">Opens like an app, from your home screen.</p>
        </div>
        <button
          onClick={() => void installApp()}
          className="btn-honey shrink-0 px-4 py-2 text-sm"
        >
          Install
        </button>
        <button
          onClick={snoozeInstall}
          aria-label="Not now"
          title="Not now"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--color-input-bg)] hover:text-[var(--color-text)]"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};
