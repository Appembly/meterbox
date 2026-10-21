import React from 'react';

export interface MeterboxIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number;
  compact?: boolean;
  variant?: 'default' | 'monochrome';
}

/**
 * Meterbox product icon — Concept 4: Ultra-Minimal Faceted Gauge + Counter Bar.
 * A frameless 3-facet semi-circular gauge arch with a bold 45° needle and hollow pivot hub,
 * sitting directly above a 3-block horizontal odometer counter bar.
 * Automatically adapts between dark mode and light mode via CSS custom properties.
 */
export const MeterboxIcon: React.FC<MeterboxIconProps> = ({
  size = 24,
  strokeWidth: _strokeWidth,
  compact: _compact,
  variant = 'default',
  className = '',
  style,
  ...rest
}) => {
  if (variant === 'monochrome') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="12 12 76 76"
        fill="none"
        style={size ? { width: size, height: size, ...style } : style}
        className={className}
        {...rest}
      >
        <path
          d="M 17.11 66.64 A 36 36 0 0 1 50 16 L 50 27 A 25 25 0 0 0 27.16 62.17 Z"
          fill="currentColor"
        />
        <path
          d="M 50 16 A 36 36 0 0 1 71.16 22.88 L 64.70 31.78 A 25 25 0 0 0 50 27 Z"
          fill="currentColor"
          opacity={0.75}
        />
        <path
          d="M 79.84 31.87 A 36 36 0 0 1 82.89 66.64 L 72.84 62.17 A 25 25 0 0 0 70.73 38.02 Z"
          fill="currentColor"
          opacity={0.45}
        />
        <g transform="translate(50 52) rotate(-45)">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M -15.5 -3.2 L -8.8 -3.2 A 9.6 9.6 0 0 1 8.8 -3.8 L 35.5 -1.7 L 35.5 1.7 L 8.8 3.8 A 9.6 9.6 0 0 1 -8.8 3.2 L -15.5 3.2 Z M -4.2 0 A 4.2 4.2 0 1 0 4.2 0 A 4.2 4.2 0 1 0 -4.2 0 Z"
            fill="currentColor"
          />
        </g>
        <rect x="24" y="70" width="14.8" height="14" rx="2.5" fill="currentColor" />
        <rect x="42.6" y="70" width="14.8" height="14" rx="2.5" fill="currentColor" />
        <rect x="61.2" y="70" width="14.8" height="14" rx="2.5" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="12 12 76 76"
      fill="none"
      style={size ? { width: size, height: size, ...style } : style}
      className={className}
      {...rest}
    >
      {/* Facet 1: Left Active Gauge Arch (204° to 90°) */}
      <path
        d="M 17.11 66.64 A 36 36 0 0 1 50 16 L 50 27 A 25 25 0 0 0 27.16 62.17 Z"
        style={{ fill: 'var(--mbx-mark-arch-1, #569475)' }}
      />

      {/* Facet 2: Top-Center Gauge Arch before Needle Gap (90° to 54°) */}
      <path
        d="M 50 16 A 36 36 0 0 1 71.16 22.88 L 64.70 31.78 A 25 25 0 0 0 50 27 Z"
        style={{ fill: 'var(--mbx-mark-arch-2, #234233)' }}
      />

      {/* Facet 3: Right Gauge Arch after Needle Gap (34° to -24°) */}
      <path
        d="M 79.84 31.87 A 36 36 0 0 1 82.89 66.64 L 72.84 62.17 A 25 25 0 0 0 70.73 38.02 Z"
        style={{ fill: 'var(--mbx-mark-arch-3, #9FA9A3)' }}
      />

      {/* 45° Gauge Needle + Hollow Pivot Hub + Counterweight Tail */}
      <g transform="translate(50 52) rotate(-45)">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M -15.5 -3.2 L -8.8 -3.2 A 9.6 9.6 0 0 1 8.8 -3.8 L 35.5 -1.7 L 35.5 1.7 L 8.8 3.8 A 9.6 9.6 0 0 1 -8.8 3.2 L -15.5 3.2 Z M -4.2 0 A 4.2 4.2 0 1 0 4.2 0 A 4.2 4.2 0 1 0 -4.2 0 Z"
          style={{ fill: 'var(--mbx-mark-ink, #111618)' }}
        />
      </g>

      {/* 3-Block Horizontal Odometer Counter Bar */}
      <rect x="24" y="70" width="14.8" height="14" rx="2.5" style={{ fill: 'var(--mbx-mark-ink, #111618)' }} />
      <rect x="42.6" y="70" width="14.8" height="14" rx="2.5" style={{ fill: 'var(--mbx-mark-ink, #111618)' }} />
      <rect x="61.2" y="70" width="14.8" height="14" rx="2.5" style={{ fill: 'var(--mbx-mark-ink, #111618)' }} />
    </svg>
  );
};
