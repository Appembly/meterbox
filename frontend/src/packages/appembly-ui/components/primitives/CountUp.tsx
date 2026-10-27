import React from 'react';
import { useCountUp, UseCountUpOptions } from '../../motion/useCountUp';

export interface CountUpProps extends UseCountUpOptions {
  value: number;
  prefix?: string;
  suffix?: string;
  format?: (val: number) => string;
  className?: string;
}

export const CountUp: React.FC<CountUpProps> = ({
  value,
  duration = 600,
  decimals = 0,
  enabled = true,
  prefix = '',
  suffix = '',
  format,
  className = '',
}) => {
  const display = useCountUp(value, { duration, decimals, enabled });
  const formatted = format
    ? format(display)
    : decimals > 0
      ? display.toFixed(decimals)
      : display.toLocaleString();

  return (
    <span className={`ap-tabular-nums ${className}`.trim()}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
