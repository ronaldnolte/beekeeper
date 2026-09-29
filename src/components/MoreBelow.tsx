// "More below" hint — deliberate change #9 (Ron, 2026-09-29): on phones part of a form can sit
// below the screen with nothing saying so. A still (never looping) round chevron appears while
// more than 40 px of content lies below the visible area, and scrolls down when tapped.

import { useEffect, useState, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  /** The scrolling element; the page itself when omitted. */
  scroller?: HTMLElement | null;
  /** Placement: fixed to the viewport for the page, absolute inside a sheet. */
  className: string;
  style?: CSSProperties;
}

export function MoreBelow({ scroller, className, style }: Props) {
  const [more, setMore] = useState(false);

  useEffect(() => {
    const el = scroller ?? document.documentElement;
    const events: HTMLElement | Window = scroller ?? window;
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 40);
    check();
    events.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    // Content that loads or grows later (history lists, sheets opening) changes the answer.
    const ro = new ResizeObserver(check);
    ro.observe(scroller ? (scroller.firstElementChild ?? scroller) : document.body);
    return () => {
      events.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      ro.disconnect();
    };
  }, [scroller]);

  if (!more) return null;
  return (
    <button
      type="button"
      aria-label="More below — scroll down"
      onClick={() => {
        const el = scroller ?? document.documentElement;
        (scroller ?? window).scrollBy({ top: el.clientHeight * 0.7, behavior: 'smooth' });
      }}
      className={`w-10 h-10 rounded-full bg-white/90 border border-divider shadow-lg text-text-muted flex items-center justify-center animate-fade-quick ${className}`}
      style={style}
    >
      <ChevronDown size={22} />
    </button>
  );
}
