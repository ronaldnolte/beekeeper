import { useState } from 'react';
import { HeaderLandscape, paletteFor } from './HeaderLandscape';

/** 60% → 30% → transparent, from the palette's own sky (SCAR S-UI-15). */
function hexAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function Header({ title, email, showAvatar, onAvatar }: { title: string; email?: string | null; showAvatar: boolean; onAvatar: () => void }) {
  // Resolved once per mount (SCAR S-UI-15).
  const [palette] = useState(() => paletteFor(new Date()));
  const initial = email ? email.charAt(0).toUpperCase() : '🐝';

  return (
    <header className="sticky top-0 z-40 overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <HeaderLandscape palette={palette} />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `linear-gradient(to bottom, ${hexAlpha(palette.sky[0], 0.6)}, ${hexAlpha(palette.sky[1], 0.3)}, transparent)` }}
      />
      <div className="relative max-w-4xl mx-auto flex items-center justify-between px-4 py-5">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logo.png" alt="" className="w-8 h-8 shrink-0" />
          <h1 className="text-white font-black text-lg truncate drop-shadow-sm">{title}</h1>
        </div>
        {showAvatar && (
          <button
            type="button"
            onClick={onAvatar}
            aria-label="Your profile"
            className="w-9 h-9 rounded-full bg-white/20 border border-white/50 text-white font-black flex items-center justify-center shrink-0 backdrop-blur-sm"
          >
            {initial}
          </button>
        )}
      </div>
    </header>
  );
}
