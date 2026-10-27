import React from 'react';

export interface ValiscaleIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  variant?: 'default' | 'squircle' | 'monochrome';
  primaryColor?: string;
  secondaryColor?: string;
}

/**
 * Official Valiscale ("V") Brand Mark:
 * - Left Diagonal Stem: Valiscale Deep Navy (`#0F1E59`, or `--vls-stem-color` in dark mode)
 * - Right Floating Triangle: Valiscale Electric Cobalt (`#4F73FF`, or `--ui-accent`)
 */
export const ValiscaleIcon: React.FC<ValiscaleIconProps> = ({
  size = 24,
  variant = 'default',
  primaryColor,
  secondaryColor,
  className = '',
  style,
  ...rest
}) => {
  const stemFill =
    secondaryColor ||
    (variant === 'monochrome'
      ? 'currentColor'
      : 'var(--vls-mark-stem, #0F1E59)');
  const triangleFill =
    primaryColor ||
    (variant === 'monochrome'
      ? 'currentColor'
      : 'var(--vls-mark-accent, #4F73FF)');

  if (variant === 'squircle') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        fill="none"
        style={size ? { width: size, height: size, ...style } : style}
        className={className}
        {...rest}
      >
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="22"
          fill="#FFFFFF"
          stroke="rgba(15, 30, 89, 0.14)"
          strokeWidth="2"
        />
        <path
          d="M 17.4 25.2 L 30.8 25.2 Q 36.2 25.2 39.2 30.6 L 56.4 61.2 Q 59.3 66.5 56.1 71.8 L 50.2 79.8 L 17.4 25.2 Z"
          fill="#0F1E59"
        />
        <path
          d="M 82.6 25.2 L 54.6 25.2 Q 48.2 25.2 51.3 31.0 L 61.5 49.5 Q 64.8 55.3 68.2 49.5 L 82.6 25.2 Z"
          fill={primaryColor || '#4F73FF'}
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="12 18 76 68"
      fill="none"
      style={size ? { width: size, height: size, ...style } : style}
      className={className}
      {...rest}
    >
      <path
        d="M 17.4 25.2 L 30.8 25.2 Q 36.2 25.2 39.2 30.6 L 56.4 61.2 Q 59.3 66.5 56.1 71.8 L 50.2 79.8 L 17.4 25.2 Z"
        fill={stemFill}
      />
      <path
        d="M 82.6 25.2 L 54.6 25.2 Q 48.2 25.2 51.3 31.0 L 61.5 49.5 Q 64.8 55.3 68.2 49.5 L 82.6 25.2 Z"
        fill={triangleFill}
        opacity={variant === 'monochrome' ? 0.65 : 1}
      />
    </svg>
  );
};
