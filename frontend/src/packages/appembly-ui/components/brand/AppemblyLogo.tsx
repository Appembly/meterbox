import React from 'react';

export interface AppemblyLogoProps {
  /**
   * - 'app-icon': Rounded-square Graphite (#111618) squircle with Off-White (#F6F7F5) geometric mark (default)
   * - 'mark': Standalone geometric monogram without background box
   * - 'favicon': Light bordered squircle with Graphite mark
   * - 'lockup': App Icon + Wordmark ('Appembly' or custom productName)
   * - 'image': Uses the exact raster /appembly-icon.jpg asset
   */
  variant?: 'app-icon' | 'mark' | 'favicon' | 'lockup' | 'image';
  size?: number;
  productName?: string;
  tagline?: string;
  className?: string;
  strokeColor?: string;
  squircleColor?: string;
}

/**
 * Official Appembly Geometric Monogram & App Icon Component.
 * Built on simple 60° equilateral triangle geometry ("Connected · Modular · Scalable · Timeless").
 */
export const AppemblyLogo: React.FC<AppemblyLogoProps> = ({
  variant = 'app-icon',
  size = 32,
  productName = 'Appembly',
  tagline,
  className = '',
  strokeColor,
  squircleColor = '#111618',
}) => {
  const renderMarkPaths = (stroke: string, strokeWidth = 5.4) => (
    <g
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      {/* Upward symmetrical triangle (A): bottom-left (20,77) -> top apex (50,23) -> bottom-right (80,77) */}
      <polyline points="20,77 50,23 80,77" />
      {/* Downward symmetrical triangle (V): top-left (20,23) -> bottom apex (50,77) -> top-right (80,23) */}
      <polyline points="20,23 50,77 80,23" />
      {/* Central horizontal bridge connecting left intersection (35,50) and right intersection (65,50) */}
      <line x1="35" y1="50" x2="65" y2="50" />
    </g>
  );

  if (variant === 'image') {
    return (
      <img
        src="/appembly-icon.jpg"
        alt={productName}
        style={{ width: size, height: size }}
        className={`rounded-[22%] object-cover select-none ${className}`}
      />
    );
  }

  if (variant === 'mark') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        style={{ width: size, height: size }}
        className={`flex-shrink-0 select-none ${className}`}
      >
        {renderMarkPaths(strokeColor || 'currentColor', 6.2)}
      </svg>
    );
  }

  if (variant === 'favicon') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        style={{ width: size, height: size }}
        className={`flex-shrink-0 select-none ${className}`}
      >
        <rect
          x="3"
          y="3"
          width="94"
          height="94"
          rx="23"
          fill="#F6F7F5"
          stroke="#E2E5E2"
          strokeWidth="2.5"
        />
        {renderMarkPaths(strokeColor || '#111618', 5.2)}
      </svg>
    );
  }

  const appIconSvg = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      style={{ width: size, height: size }}
      className={`flex-shrink-0 select-none ${variant === 'app-icon' ? className : ''}`}
    >
      <rect x="2" y="2" width="96" height="96" rx="24" fill={squircleColor} />
      {renderMarkPaths(strokeColor || '#F6F7F5', 5.2)}
    </svg>
  );

  if (variant === 'app-icon') {
    return appIconSvg;
  }

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {appIconSvg}
      <div className="flex flex-col min-w-0">
        <span className="font-bold tracking-tight text-[16px] leading-tight text-[var(--ui-text-primary)]">
          {productName}
        </span>
        {tagline && (
          <span className="text-[11px] font-medium text-[#4E8067] leading-tight truncate">
            {tagline}
          </span>
        )}
      </div>
    </div>
  );
};
