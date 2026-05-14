import React from 'react';
import { ChevronRight } from 'lucide-react';

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

export const SelectionCard: React.FC<SelectionCardProps> = ({ item, onClick, onEdit }) => {
  return (
    <div className="relative group w-full flex flex-col mb-2">
      <button
        onClick={() => onClick(item.id)}
        className="w-full text-left card p-4 flex items-center justify-between hover:shadow-md transition-all active:scale-[0.98] bg-white border border-[#E6DCC3]"
      >
        <div className="flex items-center gap-4">
          {item.icon && (
            <div className="w-12 h-12 rounded-full bg-[#FFFBF0] flex items-center justify-center text-[#E67E22] border border-[#E6DCC3] group-hover:bg-[#E67E22] group-hover:text-white transition-colors">
              {item.icon}
            </div>
          )}
          
          <div>
            <h3 className="font-bold text-lg text-[var(--color-card-text)] leading-tight sm:pr-16">{item.title}</h3>
            
            <div className="flex items-center gap-2 mt-1">
              {item.statusBadge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${item.statusBadge.colorClass}`}>
                  {item.statusBadge.text}
                </span>
              )}
              {item.subtitle && (
                <p className="text-sm text-gray-500 font-medium">{item.subtitle}</p>
              )}
            </div>
          </div>
        </div>

        <div className="text-gray-300 group-hover:text-[#E67E22] transition-colors flex items-center">
          <ChevronRight size={24} />
        </div>
      </button>

      {/* Mobile Action Bar */}
      {(onEdit || item.onDelete) && (
        <div className="flex sm:hidden items-center justify-end gap-2 mt-2">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item.id);
              }}
              className="px-4 py-2 text-sm font-bold text-[#E67E22] bg-white hover:bg-[#FDEBD0] rounded-xl shadow-sm border border-[#E6DCC3] flex-1 text-center transition-colors active:scale-95"
            >
              Edit
            </button>
          )}
          {item.onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                item.onDelete!(item.id);
              }}
              className="px-4 py-2 text-sm font-bold text-red-600 bg-white hover:bg-red-50 rounded-xl shadow-sm border border-red-200 flex-1 text-center transition-colors active:scale-95"
            >
              Delete
            </button>
          )}
        </div>
      )}

      {/* Desktop Edit/Delete Button Overlay */}
      <div className="hidden sm:flex absolute right-12 top-1/2 -translate-y-1/2 items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item.id);
            }}
            className="px-3 py-1.5 text-sm font-bold text-[#E67E22] bg-[#FFFBF0] hover:bg-[#FDEBD0] rounded-lg transition-colors border border-[#E6DCC3]"
          >
            Edit
          </button>
        )}
        {item.onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              item.onDelete!(item.id);
            }}
            className="px-3 py-1.5 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
};
