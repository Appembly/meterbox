import React, { useState } from 'react';
import { Badge, BadgeTone } from './Badge';
import { Button } from './Button';

export type DecisionCardStatus = 'pending' | 'approved' | 'denied';

export interface DecisionCardFact {
  label?: string;
  value: React.ReactNode;
}

export interface DecisionCardProps {
  /** Plain-English intent title + target resource (Rule 2.1: 15-16.5px semibold) */
  title: React.ReactNode;
  /** One calm sentence explaining why the action or state occurred (Rule 2.2) */
  rationale: React.ReactNode;
  /** Single horizontal facts line (e.g., Blast radius · Duration · Revert policy) */
  facts?: Array<DecisionCardFact | string>;
  /** Optional primary badge (max 2 badges total on card face per Rule 2) */
  badgeLabel?: string;
  badgeTone?: BadgeTone;
  /** Optional secondary badge */
  secondaryBadgeLabel?: string;
  secondaryBadgeTone?: BadgeTone;
  /** Controlled or uncontrolled decision state */
  status?: DecisionCardStatus;
  defaultStatus?: DecisionCardStatus;
  onApprove?: () => void;
  onDeny?: () => void;
  onInspect?: () => void;
  approveLabel?: string;
  denyLabel?: string;
  inspectLabel?: string;
  receiptMeta?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({
  title,
  rationale,
  facts = [],
  badgeLabel = 'Needs Approval',
  badgeTone = 'approval',
  secondaryBadgeLabel,
  secondaryBadgeTone = 'neutral',
  status: controlledStatus,
  defaultStatus = 'pending',
  onApprove,
  onDeny,
  onInspect,
  approveLabel = 'Approve',
  denyLabel = 'Deny',
  inspectLabel = 'View command & pre-checks',
  receiptMeta,
  loading = false,
  className = '',
}) => {
  const [internalStatus, setInternalStatus] = useState<DecisionCardStatus>(defaultStatus);
  const status = controlledStatus ?? internalStatus;

  const handleApprove = () => {
    if (controlledStatus === undefined) {
      setInternalStatus('approved');
    }
    onApprove?.();
  };

  const handleDeny = () => {
    if (controlledStatus === undefined) {
      setInternalStatus('denied');
    }
    onDeny?.();
  };

  if (status === 'approved' || status === 'denied') {
    const isApproved = status === 'approved';
    return (
      <div
        className={`ap-decision-card ${className}`.trim()}
        data-status={status}
        role="status"
        aria-live="polite"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {isApproved ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                aria-hidden="true"
                style={{ color: 'var(--ui-ok, #2E7D5B)', flexShrink: 0 }}
              >
                <circle cx="9" cy="9" r="8" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.5" />
                <path
                  d="M5.5 9.2L7.9 11.6L12.6 6.6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ap-decision-check-path"
                />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                aria-hidden="true"
                style={{ color: 'var(--ui-text-muted, #6B726F)', flexShrink: 0 }}
              >
                <circle cx="9" cy="9" r="8" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
                <path
                  d="M6.5 6.5L11.5 11.5M11.5 6.5L6.5 11.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            )}
            <Badge tone={isApproved ? 'ok' : 'neutral'} size="sm">
              {isApproved ? 'Approved' : 'Denied'}
            </Badge>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: 'var(--ui-text-primary, #111618)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </span>
            {receiptMeta && (
              <span style={{ fontSize: 12.5, color: 'var(--ui-text-muted, #6B726F)', whiteSpace: 'nowrap' }}>
                · {receiptMeta}
              </span>
            )}
          </div>
          {onInspect && (
            <Button variant="ghost" size="sm" onClick={onInspect}>
              Evidence
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`ap-decision-card ${className}`.trim()} data-status="pending">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <h3 className="ap-decision-title">{title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {secondaryBadgeLabel && (
            <Badge tone={secondaryBadgeTone} size="sm">
              {secondaryBadgeLabel}
            </Badge>
          )}
          {badgeLabel && (
            <Badge tone={badgeTone} size="sm" dot>
              {badgeLabel}
            </Badge>
          )}
        </div>
      </div>

      <p className="ap-decision-rationale">{rationale}</p>

      {facts.length > 0 && (
        <div className="ap-decision-facts">
          {facts.map((fact, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span aria-hidden="true">·</span>}
              {typeof fact === 'string' ? (
                <span>{fact}</span>
              ) : (
                <span>
                  {fact.label ? `${fact.label}: ` : ''}
                  <strong style={{ fontWeight: 600, color: 'var(--ui-text-secondary, #525956)' }}>
                    {fact.value}
                  </strong>
                </span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      <div className="ap-decision-footer">
        <div>
          {onInspect && (
            <Button variant="ghost" size="sm" onClick={onInspect}>
              {inspectLabel}
            </Button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onDeny && (
            <Button variant="secondary" size="sm" onClick={handleDeny} disabled={loading}>
              {denyLabel}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={handleApprove} loading={loading}>
            {approveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
