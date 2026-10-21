import React from 'react';

export interface SauthenIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number;
  compact?: boolean;
}

/**
 * Sauthen product icon — Geometric Vault Shield & Keyhole silhouette:
 * An octagonal-crested security shield enclosing a precision token keyhole,
 * optically balanced for 16px–20px sidebar badges and larger display cards.
 */
export const SauthenIcon: React.FC<SauthenIconProps> = ({
  size,
  strokeWidth = 2.2,
  compact,
  className = '',
  style,
  ...rest
}) => {
  const isCompact = compact ?? (typeof size === 'number' && size <= 20);

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
      {/* Geometric vault shield outer contour */}
      <path d="M 12 2.75 L 19.5 6 V 11.75 C 19.5 16.6 16.25 20.1 12 21.5 C 7.75 20.1 4.5 16.6 4.5 11.75 V 6 Z" />
      {/* Inner token keyhole ring + vertical ward */}
      <circle cx="12" cy="10.5" r={isCompact ? '2.1' : '2.25'} />
      <path d="M 12 12.75 V 16.25" />
    </svg>
  );
};
