import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { BreadcrumbSegment } from '../../types';

export interface BreadcrumbBarProps {
  segments: BreadcrumbSegment[];
  rightActions?: React.ReactNode;
}

/**
 * Top Breadcrumb Navigation Bar with inline dropdown switchers
 * (matches "Dashboard / Social Media v / Facebook v" from the reference screenshot).
 */
export const BreadcrumbBar: React.FC<BreadcrumbBarProps> = ({
  segments,
  rightActions,
}) => {
  const [openSegmentId, setOpenSegmentId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenSegmentId(null);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <header
      ref={containerRef}
      className="h-16 px-8 flex items-center justify-between border-b border-transparent flex-shrink-0 select-none"
    >
      <div className="flex items-center flex-wrap gap-2 text-[13.5px]">
        {segments.map((seg, idx) => {
          const isLast = idx === segments.length - 1;
          const hasDropdown = Boolean(seg.options && seg.options.length > 0);
          const isOpen = openSegmentId === seg.id;

          return (
            <React.Fragment key={seg.id}>
              {idx > 0 && (
                <span className="text-[var(--ui-text-muted)] font-normal px-0.5">/</span>
              )}

              <div className="relative">
                <button
                  onClick={() => {
                    if (hasDropdown) {
                      setOpenSegmentId(isOpen ? null : seg.id);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                    hasDropdown ? 'cursor-pointer hover:bg-[var(--ui-bg-hover)]' : 'cursor-default'
                  } ${
                    isLast
                      ? 'font-semibold text-[var(--ui-text-primary)]'
                      : 'font-normal text-[var(--ui-text-secondary)]'
                  }`}
                >
                  {seg.icon && <span className="flex-shrink-0">{seg.icon}</span>}
                  <span>{seg.label}</span>
                  {hasDropdown && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[var(--ui-text-muted)] transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </button>

                {hasDropdown && isOpen && seg.options && (
                  <div className="absolute left-0 mt-1.5 w-56 rounded-xl bg-[var(--ui-bg-surface)] border border-[var(--ui-border)] shadow-lg py-1.5 z-40">
                    {seg.options.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          seg.onSelectOption?.(opt.id);
                          setOpenSegmentId(null);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] transition-colors cursor-pointer"
                      >
                        {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                        <span className="truncate">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {rightActions && <div className="flex items-center gap-2.5">{rightActions}</div>}
    </header>
  );
};
