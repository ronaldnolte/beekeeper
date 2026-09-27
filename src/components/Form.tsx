// Form pieces for the record sheets (screenshots B19, B23).

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="block mb-2 text-sm font-black uppercase tracking-wider text-text-muted">
      {children}
      {hint && <span className="ml-1.5 normal-case font-medium tracking-normal">{hint}</span>}
    </label>
  );
}

const field = 'w-full rounded-2xl bg-white/70 border border-white/60 px-4 text-text font-bold outline-none focus:ring-4 focus:ring-primary-ring focus:border-primary-faint placeholder:text-text-muted placeholder:font-bold';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${field} h-16 text-lg ${props.className ?? ''}`} />;
}

export function SmallInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${field} h-[52px] text-base ${props.className ?? ''}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${field} py-4 text-base resize-none ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${field} h-16 text-lg appearance-none pr-12 ${props.className ?? ''}`} />
      <span aria-hidden="true" className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-text-muted">
        ▼
      </span>
    </div>
  );
}

/** Two-option toggle (hive type). Selected = amber border + amber 15% fill + amber text. */
export function ToggleButton({ selected, children, onClick }: { selected: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex-1 h-[50px] rounded-2xl border-2 font-black transition-colors ${
        selected ? 'border-primary bg-primary/15 text-primary' : 'border-white/70 bg-transparent text-text-muted'
      }`}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full h-[60px] rounded-2xl bg-primary text-white text-lg font-black shadow-md flex items-center justify-center gap-3 disabled:opacity-50 ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function DangerButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`w-full h-[60px] rounded-2xl bg-red-50 text-red-600 text-lg font-black flex items-center justify-center gap-3 disabled:opacity-50 ${props.className ?? ''}`}>
      {children}
    </button>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
      {children}
    </div>
  );
}
