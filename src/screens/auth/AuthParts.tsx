// Pieces shared by the stand-alone sign-in screens (screenshots A01–A08).

import type { InputHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** Near-white card with a soft amber glow in the top-right corner. */
export function AuthCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative w-full max-w-md rounded-[1.25rem] border border-white/80 bg-[#FAF8F4]/95 shadow-[0_4px_24px_rgba(0,0,0,0.07)] overflow-hidden ${className}`}
    >
      <div
        aria-hidden="true"
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(233,155,26,0.10), transparent 70%)' }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export function Logo({ size }: { size: number }) {
  return <img src="/logo.png" alt="BeekTools Beekeeper" width={size} height={size} className="mx-auto shadow-md" style={{ width: size, height: size }} />;
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-black tracking-wider uppercase text-text mb-1.5">
      {children}
    </label>
  );
}

/** Rounded field with a leading icon. `variant="outlined"` is the Set New Password style. */
export function IconInput({
  icon: Icon,
  variant = 'soft',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon; variant?: 'soft' | 'outlined' }) {
  const look =
    variant === 'outlined'
      ? 'bg-white/80 border-2 border-[#E6DCC3] rounded-xl focus:border-primary'
      : 'bg-white/80 border-2 border-transparent rounded-2xl focus:border-primary-faint';
  return (
    <div className="relative">
      <Icon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
      <input
        {...props}
        className={`w-full h-14 pl-12 pr-4 text-base font-bold text-text placeholder:text-text-muted outline-none focus:ring-4 focus:ring-primary-ring transition-colors ${look}`}
      />
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl border border-[#f9b8b8] bg-[#fde3e3] px-4 py-4 text-sm font-bold text-[#ef6363]">
      {children}
    </div>
  );
}

export function MessageBox({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-sm font-bold text-green-700">
      {children}
    </div>
  );
}
