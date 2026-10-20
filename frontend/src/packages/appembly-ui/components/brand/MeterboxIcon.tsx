import React from 'react';

export interface MeterboxIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number;
}

/**
 * Meterbox product icon — depicts a physical utility/telemetry meterbox:
 * an enclosed housing with an upper gauge dial + needle and a lower
 * 3-segment usage counter register.
 */
export const MeterboxIcon: React.FC<MeterboxIconProps> = ({
  size,
  strokeWidth = 2,
  className = '',
  style,
  ...rest
}) => (
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
    {/* Outer meterbox enclosure */}
    <rect x="3" y="2.5" width="18" height="19" rx="3" />
    {/* Upper semicircular meter dial arc */}
    <path d="M 7.2 12.5 a 4.8 4.8 0 0 1 9.6 0" />
    {/* Active gauge needle + pivot hub */}
    <path d="M 12 12.5 L 14.5 9.5" />
    <circle cx="12" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
    {/* Lower 3-segment odometer / counter register */}
    <path d="M 7.5 17.25 h 2 M 11 17.25 h 2 M 14.5 17.25 h 2" />
  </svg>
);
