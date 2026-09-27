// Small shared shell pieces.

/** A fixed strip the height of the bottom safe area in the app background (SPEC A §12). */
export function GestureStrip() {
  return (
    <div
      aria-hidden="true"
      className="fixed bottom-0 inset-x-0 bg-bg pointer-events-none"
      style={{ height: 'env(safe-area-inset-bottom)', zIndex: 9999 }}
    />
  );
}

export function Spinner({ className = 'w-8 h-8', color = 'border-primary' }: { className?: string; color?: string }) {
  return <div className={`${className} rounded-full border-4 ${color} border-t-transparent animate-spin`} role="status" />;
}

/** Full-screen loader while the session is checked (SPEC A §2 step 3). */
export function FullScreenLoader({ text = 'Waking up the bees...' }: { text?: string }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4">
      <Spinner className="w-12 h-12" />
      <p className="text-text-muted font-bold">{text}</p>
    </div>
  );
}
