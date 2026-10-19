import React from 'react';
import { Calendar, SlidersHorizontal } from 'lucide-react';
import { SegmentedTabItem } from '../../types';

export interface SegmentedTabsProps {
  tabs: SegmentedTabItem[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  dateRangeLabel?: string;
  onDateRangeClick?: () => void;
  filterLabel?: string;
  onFilterClick?: () => void;
  rightSlot?: React.ReactNode;
}

/**
 * Segmented Pill Tabs + Date/Wave Range & Filter Toolbar
 * (matches "Overview | Profiles | Likes | Posts" + "Oct 5, 2023 - Oct 15, 2024" + "Filter" in reference image).
 */
export const SegmentedTabs: React.FC<SegmentedTabsProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  dateRangeLabel = 'Wave 1 – Wave 3 (Active Sprint)',
  onDateRangeClick,
  filterLabel = 'Filter',
  onFilterClick,
  rightSlot,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 select-none">
      {/* Left Segmented Pill Group */}
      <div className="inline-flex items-center p-1 rounded-xl bg-[var(--ui-bg-subtle)] border border-[var(--ui-border)]">
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId;
          const prevActive = idx > 0 && tabs[idx - 1].id === activeTabId;
          return (
            <React.Fragment key={tab.id}>
              {idx > 0 && !isActive && !prevActive && (
                <span className="w-px h-4 bg-[var(--ui-border-strong)]/70 mx-0.5" />
              )}
              <button
                onClick={() => onSelectTab(tab.id)}
                className={`px-4 py-1.5 rounded-lg text-[13px] transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[var(--ui-bg-surface)] text-[var(--ui-text-primary)] font-semibold shadow-xs border border-[var(--ui-border)]/80'
                    : 'text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] font-normal'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`text-[10.5px] font-mono px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? 'bg-[#4E8067]/15 text-[#4E8067] font-semibold'
                        : 'text-[var(--ui-text-muted)]'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Right Action Pills (Date/Wave Selector + Filter Button + Custom Slot) */}
      <div className="flex items-center gap-2.5">
        {dateRangeLabel && (
          <button
            onClick={onDateRangeClick}
            className="px-3.5 py-2 rounded-xl bg-[var(--ui-bg-surface)] hover:bg-[var(--ui-bg-hover)] border border-[var(--ui-border)] text-[13px] font-medium text-[var(--ui-text-primary)] inline-flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-[#4E8067]" />
            <span>{dateRangeLabel}</span>
          </button>
        )}

        {filterLabel && (
          <button
            onClick={onFilterClick}
            className="px-3.5 py-2 rounded-xl bg-[var(--ui-bg-surface)] hover:bg-[var(--ui-bg-hover)] border border-[var(--ui-border)] text-[13px] font-medium text-[var(--ui-text-primary)] inline-flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--ui-text-secondary)]" />
            <span>{filterLabel}</span>
          </button>
        )}

        {rightSlot}
      </div>
    </div>
  );
};
