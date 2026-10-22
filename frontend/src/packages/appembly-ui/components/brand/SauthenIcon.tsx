import React from 'react';

export interface SauthenIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number;
  compact?: boolean;
  variant?: 'default' | 'monochrome';
}

/**
 * Sauthen product icon — Variation 2: 3-Plane Faceted Folded S-Shield.
 * A tapered security shield formed by two interlocking faceted halves that carve
 * a bold diagonal "S" channel across the shield face, split along the central vertical ridge.
 */
export const SauthenIcon: React.FC<SauthenIconProps> = ({
  size = 24,
  strokeWidth: _strokeWidth,
  compact: _compact,
  variant = 'default',
  className = '',
  style,
  ...rest
}) => {
  const uid = React.useId().replace(/:/g, '');

  if (variant === 'monochrome') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="12 8 76 86"
        fill="none"
        style={size ? { width: size, height: size, ...style } : style}
        className={className}
        {...rest}
      >
        <path
          d="M 50 10 L 80 16.5 Q 84 17.5 84 21.5 L 84 46.5 L 50 26 L 33.5 36 Q 30.5 37.8 33.5 39.6 L 61.5 56.5 L 50 63.5 L 16 43 L 16 21.5 Q 16 17.5 20 16.5 Z"
          fill="currentColor"
        />
        <path
          d="M 38.5 39.5 L 50 32.5 L 84 53 C 84 69.5 71 81.5 50 92 C 29 81.5 16 69.5 16 50 L 50 70.5 L 66.5 60.5 Q 69.5 58.7 66.5 56.9 Z"
          fill="currentColor"
          opacity={0.65}
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="12 8 76 86"
      fill="none"
      style={size ? { width: size, height: size, ...style } : style}
      className={className}
      {...rest}
    >
      <defs>
        <linearGradient id={`sth-top-l-${uid}`} x1="16" y1="10" x2="56" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0%" style={{ stopColor: 'var(--sth-mark-top-hi, #F6F7F5)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--sth-mark-top-mid, #DCE0EC)' }} />
        </linearGradient>
        <linearGradient id={`sth-top-r-${uid}`} x1="50" y1="10" x2="84" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" style={{ stopColor: 'var(--sth-mark-top-mid, #D2D6E4)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--sth-mark-top-lo, #AEB5C9)' }} />
        </linearGradient>
        <linearGradient id={`sth-bot-l-${uid}`} x1="16" y1="48" x2="50" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9B8EFF" />
          <stop offset="100%" stopColor="#7565F0" />
        </linearGradient>
        <linearGradient id={`sth-bot-r-${uid}`} x1="42" y1="34" x2="82" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6557DC" />
          <stop offset="100%" stopColor="#4337B3" />
        </linearGradient>
      </defs>

      <path
        d="M 50 10 L 80 16.5 Q 84 17.5 84 21.5 L 84 46.5 L 50 26 Z"
        fill={`url(#sth-top-r-${uid})`}
      />
      <path
        d="M 50 10 L 20 16.5 Q 16 17.5 16 21.5 L 16 43 L 50 63.5 L 61.5 56.5 L 33.5 39.6 Q 30.5 37.8 33.5 36 L 50 26 Z"
        fill={`url(#sth-top-l-${uid})`}
      />
      <path
        d="M 16 40.2 L 50 60.7 L 59.2 55.1 L 61.5 56.5 L 50 63.5 L 16 43 Z"
        style={{ fill: 'var(--sth-mark-top-bevel, #B4BBD0)' }}
      />
      <path
        d="M 50 23.2 L 84 43.7 L 84 46.5 L 50 26 Z"
        style={{ fill: 'var(--sth-mark-top-bevel, #9AA2BA)' }}
      />

      <path
        d="M 38.5 39.5 L 50 32.5 L 84 53 C 84 69.5 71 81.5 50 92 L 50 70.5 L 66.5 60.5 Q 69.5 58.7 66.5 56.9 Z"
        fill={`url(#sth-bot-r-${uid})`}
      />
      <path
        d="M 16 50 L 50 70.5 L 50 92 C 29 81.5 16 69.5 16 50 Z"
        fill={`url(#sth-bot-l-${uid})`}
      />
      <path d="M 38.5 39.5 L 50 32.5 L 50 46.7 Z" fill="#7C6EF2" />
      <path d="M 38.5 39.5 L 50 32.5 L 84 53 L 84 55.8 L 50 35.3 L 41.2 40.6 Z" fill="#352A96" />
      <path
        d="M 16 50 L 50 70.5 L 66.5 60.5 Q 69.5 58.7 66.5 56.9 L 64.2 55.5 Q 66.5 57.2 64.2 58.6 L 50 67.2 L 16 46.8 Z"
        fill="#3B30A3"
      />
    </svg>
  );
};
