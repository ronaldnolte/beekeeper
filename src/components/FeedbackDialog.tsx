// Feedback dialog — SPEC C §6 (screenshot B42) — and the shared amber-header dialog frame that
// the Roadmap's Submit Idea / Edit Request dialogs also use (B44).

import { useEffect, useState, type ReactNode } from 'react';
import { Lightbulb, MessageSquare, Send, X, type LucideIcon } from 'lucide-react';
import { Overlay } from './Overlay';
import { useApp } from '../app/store';
import { sendFeedback } from '../lib/profileData';

export function DialogFrame({ icon: Icon, title, onClose, children }: { icon: LucideIcon; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <Overlay>
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-quick" onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-[#ebe8e3] shadow-2xl animate-sheet-in" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between bg-primary px-5 py-4 text-white">
            <h2 className="flex items-center gap-3 text-xl font-black">
              <Icon size={24} /> {title}
            </h2>
            <button type="button" aria-label="Close" onClick={onClose} className="p-1">
              <X size={24} />
            </button>
          </div>
          <div className="px-6 py-6">{children}</div>
        </div>
      </div>
    </Overlay>
  );
}

export const dialogLabel = 'block mb-2 text-sm font-black uppercase tracking-wider text-text-muted';
export const dialogField = 'w-full rounded-2xl bg-white px-4 text-lg font-bold text-text outline-none focus:ring-4 focus:ring-primary-ring placeholder:text-text-muted';

export function DialogActions({ onCancel, label, disabled, onSubmit }: { onCancel: () => void; label: string; disabled: boolean; onSubmit: () => void }) {
  return (
    <div className="mt-6 flex gap-3">
      <button type="button" onClick={onCancel} className="flex-1 h-14 text-lg font-black text-text-muted">
        Cancel
      </button>
      <button type="button" onClick={onSubmit} disabled={disabled} className="flex-[2] h-14 rounded-2xl bg-[#8d5b3a] text-white text-lg font-black shadow-md flex items-center justify-center gap-3 disabled:opacity-60">
        {label} <Send size={20} />
      </button>
    </div>
  );
}

export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const { navigate } = useApp();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const send = async () => {
    setStatus('sending');
    try {
      await sendFeedback(message.trim(), email);
      setStatus('sent');
      setTimeout(onClose, 2000);
    } catch (err) {
      console.warn('[feedback]', err);
      setStatus('failed');
    }
  };

  return (
    <DialogFrame icon={MessageSquare} title="Send Feedback" onClose={onClose}>
      {status === 'sent' ? (
        <div className="py-10 text-center">
          <p className="text-2xl font-black text-text">✅ Message Sent!</p>
          <p className="mt-2 text-text-muted">Thanks for your feedback.</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border-2 border-primary/30 bg-primary-wash p-5">
            <p className="flex items-center gap-2 text-lg font-black text-primary-ink">
              Have a Feature Idea? <Lightbulb size={20} className="text-primary" />
            </p>
            <p className="mt-2 font-bold text-primary-ink">Vote on existing requests or submit your own ideas to our public roadmap.</p>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('ROADMAP', { keepRecord: false });
              }}
              className="mt-4 w-full h-[52px] rounded-2xl border-2 border-primary bg-white/80 text-lg font-black text-primary-ink"
            >
              View Roadmap &amp; Vote →
            </button>
          </div>

          <div className="my-6 flex items-center gap-4 text-sm font-black uppercase tracking-wider text-text-muted">
            <span className="flex-1 border-t border-divider" /> Or private message <span className="flex-1 border-t border-divider" />
          </div>

          <label className="block">
            <span className={dialogLabel}>Your message</span>
            <textarea className={`${dialogField} py-4 resize-none`} rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder="Suggestions, bugs, or questions..." />
          </label>
          <label className="mt-5 block">
            <span className={dialogLabel}>
              Your email <span className="font-medium normal-case">(Optional)</span>
            </span>
            <input className={`${dialogField} h-14`} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="If you'd like a reply..." />
          </label>
          {status === 'failed' && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">Failed to send. Please check your connection.</p>}
          <DialogActions onCancel={onClose} label="Send Feedback" disabled={!message.trim() || status === 'sending'} onSubmit={() => void send()} />
        </>
      )}
    </DialogFrame>
  );
}
