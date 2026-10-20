import React from 'react';

export interface MeterboxIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number;
  /**
   * When true (or automatically when numeric `size <= 20`), omits the micro
   * register line in the base so the domed utility-meter silhouette and needle
   * stay razor-sharp at 16px–20px scales.
   */
  compact?: boolean;
}

/**
 * Meterbox product icon — Domed Utility Meter silhouette:
 * an arch-top utility meter housing divided into an upper dial chamber
 * with a bold active needle and a lower register base, with optical scaling
 * for 16px–20px badges/favicons vs. larger display cards.
 */
export const MeterboxIcon: React.FC<MeterboxIconProps> = ({
  size,
  strokeWidth = 2.2,
  compact,
  className = '',
  style,
  ...rest
}) => {
  const isCompact = compact ?? (typeof size === 'number' && size <= 20);
  const needleWidth = Number((strokeWidth * 1.15).toFixed(2));

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={size ? { width: size, height: size, ...style } : style}
      className={className}
      {...rest}
    >
      {/* Domed utility meter outer silhouette */}
      <path d="M 4 11 A 8 8 0 0 1 20 11 V 18.5 A 2.5 2.5 0 0 1 17.5 21 H 6.5 A 2.5 2.5 0 0 1 4 18.5 Z" />
      {/* Horizontal faceplate divider between dial dome and register base */}
      <line x1="4" y1="15.5" x2="20" y2="15.5" />
      {/* Active gauge needle + pivot hub */}
      <path d="M 12 15.5 L 15.8 8.2" strokeWidth={needleWidth} />
      <circle cx="12" cy="15.5" r="1.6" fill="currentColor" stroke="none" />
      {/* Lower register bar — shown at >20px display scales */}
      {!isCompact && <line x1="8.5" y1="18.3" x2="15.5" y2="18.3" />}
    </svg>
  );
};
