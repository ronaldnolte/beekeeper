import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { X, Camera, Mic, Download, ShieldCheck, Sparkles } from 'lucide-react';

// Bump this string whenever there's new content worth announcing. Anyone whose
// stored value doesn't match sees the modal once, then it's marked as read.
// Kept as a content id (not the app version) so a release with nothing
// user-facing to say doesn't have to trigger the popup.
export const WHATS_NEW_VERSION = '2026-07-photos-voice-export';
const SEEN_KEY = 'beek_whats_new_seen';

// One-time "What's New" modal. Self-managing: on mount it checks localStorage
// and shows itself once per WHATS_NEW_VERSION. Mounted globally for signed-in
// users, so it appears over the dashboard on first load after an update.
export const WhatsNewModal: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) !== WHATS_NEW_VERSION) {
        setOpen(true);
      }
    } catch {
      // localStorage unavailable (e.g. private mode) — just skip the modal.
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, WHATS_NEW_VERSION);
    } catch {
      // Ignore — worst case the modal shows again next load.
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={dismiss}
    >
      <div
        className="bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300 border border-[var(--color-card-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-[var(--color-input-bg)] border-b border-[var(--color-card-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--color-primary)]/15 flex items-center justify-center text-[var(--color-primary)]">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="text-xl font-black text-[var(--color-text)]">What's New</h3>
              <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider mt-0.5">
                A few things you may have missed
              </p>
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="Close"
            className="p-2 rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-raised)] transition-colors active:scale-95"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm custom-scrollbar">
          <Feature
            icon={<><Camera size={20} /><Mic size={20} /></>}
            title="Photos & voice notes on inspections"
            body="You can now attach photos and voice notes to any inspection. Snap a picture of brood, queen cells, or anything you want to remember — or record a quick voice note instead of typing it all out. Look for the camera and microphone on the inspection screen."
          />
          <Feature
            icon={<Download size={20} />}
            title="Export your records for safe keeping"
            body="Save any inspection as a PDF report, and export your photos to your device. It's a great way to keep your own backup of your records and images — for safe keeping, or to share them."
          />
          <Feature
            icon={<ShieldCheck size={20} />}
            title="Behind the scenes"
            body="We've also made a round of security and reliability improvements across the app."
          />

          {/* Testers on the packaged Android build — nudge them to stay current.
              Hidden on web/PWA, which is always up to date automatically. */}
          {Capacitor.isNativePlatform() && (
            <div className="rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 p-4">
              <p className="text-xs font-bold text-[var(--color-text)] leading-relaxed">
                📱 <strong>Beta testers:</strong> please make sure you're on the latest version
                (keep auto-updates turned on in Google Play) so every feature keeps working smoothly.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[var(--color-input-bg)] border-t border-[var(--color-card-border)] flex justify-end">
          <button
            onClick={dismiss}
            className="px-8 py-3 btn-honey rounded-xl font-black active:scale-95"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-4 border border-[var(--color-card-border)] bg-[var(--color-bg-raised)] rounded-2xl p-4">
      <div className="shrink-0 w-11 h-11 rounded-2xl bg-[var(--color-primary)]/15 flex items-center justify-center gap-0.5 text-[var(--color-primary)]">
        {icon}
      </div>
      <div>
        <h4 className="font-black text-[var(--color-text)] mb-1">{title}</h4>
        <p className="text-xs text-[var(--color-text-muted)] font-medium leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
