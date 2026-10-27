import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  compact = false,
  className = '',
}) => {
  return (
    <div
      className={`ap-empty-state ${compact ? 'ap-empty-state--compact' : ''} ${className}`.trim()}
    >
      <div className="ap-empty-state__icon" aria-hidden="true">
        {icon ?? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M7 9h10M7 13h6" />
          </svg>
        )}
      </div>
      <h3 className="ap-empty-state__title">{title}</h3>
      {description && <p className="ap-empty-state__desc">{description}</p>}
      {action && <div className="ap-empty-state__action">{action}</div>}
    </div>
  );
};
