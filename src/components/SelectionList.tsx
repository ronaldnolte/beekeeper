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
        <div className="w-10 h-10 border-4 border-[#E67E22] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-bold text-[var(--color-text)]">Loading data...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto p-4 space-y-4">
      {/* Search Bar - Crucial for users with 50+ apiaries */}
      {items.length > 5 && (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-[#E6DCC3] rounded-xl shadow-sm focus:ring-2 focus:ring-[#E67E22] focus:border-transparent transition-all font-medium"
            placeholder="Search..."
          />
        </div>
      )}

      {/* Item List */}
      <div className="space-y-3 pb-8">
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
          <div className="text-center py-12 bg-white/50 rounded-xl border-2 border-dashed border-[#E6DCC3]">
            <p className="text-gray-500 font-medium">{searchQuery ? 'No results found.' : emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};
