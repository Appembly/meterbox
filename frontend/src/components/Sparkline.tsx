"use client";

import React from "react";

interface SparklineProps {
  values: number[];
  stroke?: string;
  width?: number;
  height?: number;
}

export function Sparkline({
  values,
  stroke = "var(--primary)",
  width = 78,
  height = 28,
}: SparklineProps) {
  const safeValues =
    values && values.length >= 2
      ? values
      : values && values.length === 1
      ? [Math.max(0, values[0] * 0.7), values[0] * 0.85, values[0]]
      : [4, 7, 6, 10, 13, 16];

  const minVal = Math.min(...safeValues);
  const maxVal = Math.max(...safeValues);
  const span = Math.max(1e-6, maxVal - minVal);
  const padX = 2;
  const padY = 4;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;

  const points = safeValues.map((v, idx) => {
    const x = padX + (idx / Math.max(1, safeValues.length - 1)) * usableW;
    const norm = maxVal === minVal ? 0.5 : (v - minVal) / span;
    const y = padY + (1 - norm) * usableH;
    return `${idx === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} fill="none">
      <path
        d={points.join(" ")}
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
