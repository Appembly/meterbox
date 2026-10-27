import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  radius?: 'sm' | 'md' | 'lg' | 'pill' | 'full';
  /** Optional multi-line text skeleton helper */
  lines?: number;
}

const RADIUS_MAP: Record<NonNullable<SkeletonProps['radius']>, string> = {
  sm: 'var(--ui-radius-sm, 8px)',
  md: 'var(--ui-radius, 12px)',
  lg: 'var(--ui-radius-lg, 16px)',
  pill: 'var(--ui-radius-pill, 9px)',
  full: '9999px',
};

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  radius = 'sm',
  lines,
  className = '',
  style,
  ...rest
}) => {
  if (lines && lines > 1) {
    return (
      <div
        aria-hidden="true"
        className={className}
        style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}
        {...rest}
      >
        {Array.from({ length: lines }).map((_, idx) => (
          <div
            key={idx}
            className="ap-skeleton"
            style={{
              width: idx === lines - 1 ? '68%' : width,
              height,
              borderRadius: RADIUS_MAP[radius],
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`ap-skeleton ${className}`.trim()}
      style={{
        width,
        height,
        borderRadius: RADIUS_MAP[radius],
        ...style,
      }}
      {...rest}
    />
  );
};
