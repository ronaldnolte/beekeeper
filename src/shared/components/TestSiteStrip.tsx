import React from 'react';
import { IS_TEST_SITE, TEST_STRIP_HEIGHT } from '../testSite';

/** Hazard-striped reminder pinned to the top of every screen on a test site. */
export const TestSiteStrip: React.FC = () => {
  if (!IS_TEST_SITE) return null;
  return (
    <div
      role="note"
      aria-label="Test site"
      className="fixed top-0 left-0 right-0 z-[10000] pointer-events-none flex items-end justify-center"
      style={{
        height: `calc(env(safe-area-inset-top, 0px) + ${TEST_STRIP_HEIGHT})`,
        paddingBottom: '3px',
        background: 'repeating-linear-gradient(-45deg, #E99B1A 0 10px, #1C1A17 10px 20px)',
      }}
    >
      <span className="px-2 py-[1px] rounded bg-[#1C1A17] text-[#E99B1A] text-[10px] font-black uppercase tracking-wider leading-tight whitespace-nowrap">
        {/* The full sentence needs about 340 px; the narrowest phones get the short form. */}
        <span className="hidden min-[360px]:inline">Test site · changes here don't touch your real data</span>
        <span className="min-[360px]:hidden">Test site · not your real data</span>
      </span>
    </div>
  );
};
