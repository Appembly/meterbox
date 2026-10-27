import React from 'react';
import { LiveDot } from './LiveDot';

export type BadgeTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'approval';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  /** Renders a static status dot inside the badge */
  dot?: boolean;
  /** Renders a breathing LiveDot inside the badge */
  live?: boolean;
  icon?: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      tone = 'neutral',
      size = 'md',
      dot = false,
      live = false,
      icon,
      className = '',
      children,
      ...rest
    },
    ref
  ) => {
    const liveTone = tone === 'neutral' ? 'accent' : tone;
    return (
      <span
        ref={ref}
        className={`ap-badge ap-badge--${tone} ap-badge--${size} ap-tabular-nums ${className}`.trim()}
        {...rest}
      >
        {live ? (
          <LiveDot tone={liveTone} size={6} />
        ) : dot ? (
          <span className="ap-badge-dot" aria-hidden="true" />
        ) : icon ? (
          <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
            {icon}
          </span>
        ) : null}
        <span>{children}</span>
      </span>
    );
  }
);
Badge.displayName = 'Badge';

export type StatusPillProps = BadgeProps;
export const StatusPill = Badge;
