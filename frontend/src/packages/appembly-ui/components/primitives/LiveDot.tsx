import React from 'react';

export type LiveDotTone = 'accent' | 'ok' | 'warn' | 'danger' | 'approval';

export interface LiveDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: LiveDotTone;
  size?: number;
  /** When true (default), breathes with a single calm 2.4s opacity cycle (static under reduced motion) */
  active?: boolean;
  /** Optional text label rendered beside the dot */
  label?: React.ReactNode;
}

export const LiveDot = React.forwardRef<HTMLSpanElement, LiveDotProps>(
  (
    {
      tone = 'accent',
      size = 8,
      active = true,
      label,
      className = '',
      style,
      ...rest
    },
    ref
  ) => {
    const dotEl = (
      <span
        ref={label ? undefined : ref}
        data-active={active ? 'true' : 'false'}
        aria-hidden={label ? 'true' : rest['aria-label'] ? undefined : 'true'}
        className={`ap-live-dot ap-live-dot--${tone} ${label ? '' : className}`.trim()}
        style={{
          width: size,
          height: size,
          ...(label ? undefined : style),
        }}
        {...(label ? undefined : rest)}
      />
    );

    if (!label) {
      return dotEl;
    }

    return (
      <span
        ref={ref}
        className={`ap-live-dot-wrap ${className}`.trim()}
        style={style}
        {...rest}
      >
        {dotEl}
        <span>{label}</span>
      </span>
    );
  }
);
LiveDot.displayName = 'LiveDot';
