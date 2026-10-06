import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, MessageSquare, Settings, User } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { LogoutConfirm } from '../shared/components/LogoutConfirm';

/**
 * The header's initial button and the small menu it opens: Profile, Settings,
 * Send feedback, Log out. The gear badge is there because a lone letter in a
 * circle did not read as "your settings live here".
 *
 * The menu is portalled to <body> and positioned under the button, so the
 * header's own clipping and stacking can't hide it.
 */
export const AccountMenu: React.FC<{ initial: string }> = ({ initial }) => {
  const { navigateTo, setFeedbackModalOpen } = useAppStore();
  const [open, setOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const close = () => setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  const item =
    'flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[var(--color-text)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--color-input-bg)] focus-visible:bg-[var(--color-input-bg)] outline-none';

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-label="Profile and settings"
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/20 font-black text-white shadow-sm backdrop-blur-sm transition-all duration-[var(--dur-fast)] hover:bg-white/30 active:scale-90"
      >
        {initial}
        {/* Gear badge: says "settings" where a letter alone did not. */}
        <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white bg-[var(--color-primary)] text-white shadow">
          <Settings size={10} strokeWidth={3} />
        </span>
      </button>

      {open &&
        createPortal(
          <>
            {/* Click anywhere else to close. */}
            <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} role="presentation" />
            <div
              role="menu"
              aria-label="Profile and settings"
              className="fixed z-[91] w-56 overflow-hidden rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-bg-raised)] py-1 shadow-xl animate-[rise-in_var(--dur-fast)_var(--ease-soft)]"
              style={{ top: pos.top, right: pos.right }}
            >
              <button role="menuitem" className={item} onClick={choose(() => navigateTo('PROFILE'))}>
                <User size={18} className="text-[var(--color-text-muted)]" /> Profile
              </button>
              <button role="menuitem" className={item} onClick={choose(() => navigateTo('SETTINGS'))}>
                <Settings size={18} className="text-[var(--color-text-muted)]" /> Settings
              </button>
              <button role="menuitem" className={item} onClick={choose(() => setFeedbackModalOpen(true))}>
                <MessageSquare size={18} className="text-[var(--color-text-muted)]" /> Send feedback
              </button>
              <div className="my-1 h-px bg-[var(--color-divider)]" />
              <button
                role="menuitem"
                className={`${item} text-[var(--color-bad)]`}
                onClick={choose(() => setConfirmingLogout(true))}
              >
                <LogOut size={18} /> Log out
              </button>
            </div>
          </>,
          document.body
        )}

      {confirmingLogout && <LogoutConfirm onCancel={() => setConfirmingLogout(false)} />}
    </>
  );
};
