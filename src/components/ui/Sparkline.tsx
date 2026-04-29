"use client";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  fill?: boolean;
}

export default function Sparkline({
  data,
  width = 80,
  height = 28,
  color = "#6366f1",
  strokeWidth = 1.5,
  fill = true,
}: SparklineProps) {
  if (!data.length) return <svg width={width} height={height} />;

  const max = Math.max(...data, 1);
  const pad = strokeWidth;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = data.map((v, i) => [
    pad + (i / Math.max(data.length - 1, 1)) * w,
    pad + h - (v / max) * h,
  ]);

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");

  const areaPath = fill
    ? `${linePath} L${points[points.length - 1][0].toFixed(1)},${(pad + h).toFixed(1)} L${points[0][0].toFixed(1)},${(pad + h).toFixed(1)} Z`
    : "";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {fill && (
        <path
          d={areaPath}
          fill={color}
          fillOpacity={0.12}
        />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
