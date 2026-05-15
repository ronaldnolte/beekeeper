import React, { useState } from 'react';
import { ChevronRight, MoreVertical, Pencil, Trash2 } from 'lucide-react';

export interface SelectionItem {
  id: string;
  title: string;
  subtitle?: string;
  statusBadge?: {
    text: string;
    colorClass: string;
  };
  icon?: React.ReactNode;
  raw?: any;
  onDelete?: (id: string) => void;
}

interface SelectionCardProps {
  item: SelectionItem;
  onClick: (id: string) => void;
  onEdit?: (id: string) => void;
}

// Rotating gradient pairs for visual variety
const CARD_GRADIENTS = [
  'from-emerald-500/10 to-teal-500/5',
  'from-amber-500/10 to-orange-500/5',
  'from-sky-500/10 to-blue-500/5',
  'from-violet-500/10 to-purple-500/5',
  'from-rose-500/10 to-pink-500/5',
];

const ICON_COLORS = [
  'text-emerald-600 bg-emerald-100',
  'text-amber-600 bg-amber-100',
  'text-sky-600 bg-sky-100',
  'text-violet-600 bg-violet-100',
  'text-rose-600 bg-rose-100',
];

export const SelectionCard: React.FC<SelectionCardProps> = ({ item, onClick, onEdit }) => {
  const [showActions, setShowActions] = useState(false);

  // Deterministic color based on item title
  const colorIndex = item.title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % CARD_GRADIENTS.length;
  const gradient = CARD_GRADIENTS[colorIndex];
  const iconColor = ICON_COLORS[colorIndex];

  return (
    <div className="relative w-full flex flex-col mb-3">
      <div className="flex items-center gap-2">
        {/* Main card button */}
        <button
          onClick={() => onClick(item.id)}
          className={`flex-1 text-left card p-4 flex items-center justify-between hover:shadow-md transition-all active:scale-[0.98] bg-gradient-to-r ${gradient}`}
        >
          <div className="flex items-center gap-3">
            {item.icon && (
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconColor}`}>
                {item.icon}
              </div>
            )}
            
            <div>
              <h3 className="font-bold text-base text-[var(--color-card-text)] leading-tight">{item.title}</h3>
              
              <div className="flex items-center gap-2 mt-0.5">
                {item.statusBadge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${item.statusBadge.colorClass}`}>
                    {item.statusBadge.text}
                  </span>
                )}
                {item.subtitle && (
                  <p className="text-sm text-[var(--color-text-muted)] font-medium">{item.subtitle}</p>
                )}
              </div>
            </div>
          </div>

          <ChevronRight size={20} className="text-[var(--color-text-muted)] flex-shrink-0" />
        </button>

        {/* More button */}
        {(onEdit || item.onDelete) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowActions(!showActions);
            }}
            className="w-11 h-11 flex-shrink-0 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors active:scale-95"
          >
            <MoreVertical size={18} />
          </button>
        )}
      </div>

      {/* Expandable action row */}
      {showActions && (onEdit || item.onDelete) && (
        <div className="flex items-center gap-2 mt-2 animate-in slide-in-from-top-2 duration-200">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(false);
                onEdit(item.id);
              }}
              className="flex-1 py-3 text-sm font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-95 border border-[var(--color-primary)]/20"
            >
              <Pencil size={16} /> Edit
            </button>
          )}
          {item.onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(false);
                item.onDelete!(item.id);
              }}
              className="flex-1 py-3 text-sm font-bold text-red-600 bg-red-50 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-95 border border-red-200"
            >
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};
