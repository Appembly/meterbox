import React from 'react';
import { LiveDot } from './LiveDot';

export type StepStatus = 'completed' | 'active' | 'pending' | 'error';

export interface StepItem {
  id: string;
  label: React.ReactNode;
  detail?: React.ReactNode;
  meta?: React.ReactNode;
  status: StepStatus;
}

export interface StatusStepperProps {
  steps: StepItem[];
  showProgressRail?: boolean;
  className?: string;
}

export const StatusStepper: React.FC<StatusStepperProps> = ({
  steps,
  showProgressRail = true,
  className = '',
}) => {
  const total = Math.max(steps.length, 1);
  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const activeCount = steps.filter((s) => s.status === 'active').length;
  const progress = Math.min(1, (completedCount + activeCount * 0.45) / total);

  return (
    <div className={`ap-stepper ${className}`.trim()}>
      {showProgressRail && (
        <div
          className="ap-stepper-rail"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={completedCount}
        >
          <div
            className="ap-stepper-rail-fill"
            style={{ transform: `scaleX(${progress.toFixed(3)})` }}
          />
        </div>
      )}

      <ol className="ap-stepper-list">
        {steps.map((step) => (
          <li key={step.id} className="ap-stepper-item" data-status={step.status}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              {step.status === 'completed' && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                  style={{ color: 'var(--ui-ok, #2E7D5B)', flexShrink: 0 }}
                >
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.4" />
                  <path
                    d="M4.8 8.2L7.0 10.3L11.2 5.8"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ap-decision-check-path"
                  />
                </svg>
              )}
              {step.status === 'active' && <LiveDot tone="accent" size={8} active />}
              {step.status === 'pending' && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    margin: 4,
                    borderRadius: 9999,
                    backgroundColor: 'var(--ui-border-strong, #CFD4D0)',
                    flexShrink: 0,
                  }}
                />
              )}
              {step.status === 'error' && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    margin: 4,
                    borderRadius: 9999,
                    backgroundColor: 'var(--ui-danger, #C93B4A)',
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {step.label}
                </div>
                {step.detail && (
                  <div style={{ fontSize: 12, color: 'var(--ui-text-muted, #6B726F)', marginTop: 2 }}>
                    {step.detail}
                  </div>
                )}
              </div>
            </div>
            {step.meta && (
              <span
                className="ap-tabular"
                style={{ fontSize: 12, color: 'var(--ui-text-muted, #6B726F)', flexShrink: 0 }}
              >
                {step.meta}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
};
