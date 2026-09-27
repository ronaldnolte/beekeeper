// Shared selection list and card — SPEC B §11 (screenshot B05).

import { useState, type ReactNode } from 'react';
import { ChevronRight, MoreVertical, Pencil, Search, type LucideIcon } from 'lucide-react';
import { Spinner } from './Chrome';

export interface SelectionItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
}

interface Props<T extends SelectionItem> {
  items: T[];
  icon: LucideIcon;
  loading?: boolean;
  emptyMessage: ReactNode;
  onSelect: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
}

export function SelectionList<T extends SelectionItem>({ items, icon, loading, emptyMessage, onSelect, onEdit, onDelete }: Props<T>) {
  const [query, setQuery] = useState('');

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-text-muted">
        <Spinner />
        <p>Loading data...</p>
      </div>
    );
  }
  if (items.length === 0) {
    return <div className="rounded-[20px] border-2 border-dashed border-divider p-8 text-center text-text-muted">{emptyMessage}</div>;
  }

  const q = query.trim().toLowerCase();
  const shown = q ? items.filter(i => i.title.toLowerCase().includes(q) || (i.subtitle ?? '').toLowerCase().includes(q)) : items;

  return (
    <div className="space-y-3">
      {items.length > 5 && (
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full h-12 pl-11 pr-4 rounded-2xl bg-input-bg border border-card-border outline-none focus:ring-4 focus:ring-primary-ring"
          />
        </div>
      )}
      {shown.length === 0 ? (
        <p className="text-center text-text-muted py-6">No results found.</p>
      ) : (
        shown.map(item => <SelectionCard key={item.id} item={item} icon={icon} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} />)
      )}
    </div>
  );
}

function SelectionCard<T extends SelectionItem>({
  item,
  icon: Icon,
  onSelect,
  onEdit,
  onDelete,
}: {
  item: T;
  icon: LucideIcon;
  onSelect: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onSelect(item)} className="card flex-1 min-w-0 flex items-center gap-4 p-4 text-left active:scale-[0.99] transition-transform">
          <span className="w-11 h-11 shrink-0 rounded-xl bg-primary-wash text-primary-ink flex items-center justify-center">
            <Icon size={22} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-2">
              <span className="font-bold text-text truncate">{item.title}</span>
              {item.badge}
            </span>
            {item.subtitle && <span className="block text-sm text-text-muted truncate">{item.subtitle}</span>}
          </span>
          <ChevronRight size={20} className="shrink-0 text-text-muted" />
        </button>
        {/* Delete lives behind a three-dot menu (accidental taps, SCAR S-UI-2). */}
        {onDelete ? (
          <button type="button" aria-label="More actions" onClick={() => setMenuOpen(o => !o)} className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-text-muted">
            <MoreVertical size={20} />
          </button>
        ) : onEdit ? (
          <button type="button" aria-label="Edit" onClick={() => onEdit(item)} className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-text-muted">
            <Pencil size={18} />
          </button>
        ) : null}
      </div>
      {menuOpen && onDelete && (
        <div className="flex gap-2 mt-2 animate-fade-quick">
          {onEdit && (
            <button type="button" onClick={() => (setMenuOpen(false), onEdit(item))} className="flex-1 h-10 rounded-xl bg-primary-wash text-primary-ink font-bold">
              Edit
            </button>
          )}
          <button type="button" onClick={() => (setMenuOpen(false), onDelete(item))} className="flex-1 h-10 rounded-xl bg-bad text-white font-bold">
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
