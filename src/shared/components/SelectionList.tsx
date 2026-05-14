import React, { useState } from 'react';
import { SelectionCard, type SelectionItem } from './SelectionCard';
import { Search } from 'lucide-react';

interface SelectionListProps {
  items: SelectionItem[];
  emptyMessage?: string;
  onSelect: (id: string) => void;
  onEdit?: (id: string) => void;
  isLoading?: boolean;
}

export const SelectionList: React.FC<SelectionListProps> = ({ 
  items, 
  emptyMessage = "No items found.", 
  onSelect,
  onEdit,
  isLoading = false 
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-50">
        <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-bold text-[var(--color-text-muted)]">Loading data...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto p-4 space-y-4">
      {/* Search Bar */}
      {items.length > 5 && (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[var(--color-input-bg)] border border-[var(--color-card-border)] rounded-xl shadow-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all font-medium text-[var(--color-text)] placeholder-[var(--color-text-muted)]"
            placeholder="Search..."
          />
        </div>
      )}

      {/* Item List */}
      <div className="space-y-1 pb-8">
        {filteredItems.length > 0 ? (
          filteredItems.map(item => (
            <SelectionCard 
              key={item.id} 
              item={item} 
              onClick={onSelect} 
              onEdit={onEdit}
            />
          ))
        ) : (
          <div className="text-center py-12 rounded-2xl border-2 border-dashed border-[var(--color-card-border)] bg-[var(--color-card-bg)]/50">
            <p className="text-[var(--color-text-muted)] font-medium">{searchQuery ? 'No results found.' : emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};
