/**
 * A tiny inline sparkline.
 *
 * Hand-drawn rather than a chart library: three of these sit in a narrow drawer
 * and only need a line plus a soft fill, so a 40-line SVG beats pulling a chart
 * into the render path. Flat series (all zero) draw a centred baseline instead of
 * collapsing into a divide-by-zero path.
 */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 220;
  const height = 34;
  const pad = 2;
  if (!values.length) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 h-[34px] w-full" role="img" aria-label="no data">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="var(--color-line)" strokeWidth={1} />
      </svg>
    );
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min;
  const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const y = (value: number) =>
    span === 0 ? height / 2 : height - pad - ((value - min) / span) * (height - pad * 2);
  const points = values.map((value, index) => [pad + index * stepX, y(value)] as const);
  const line = points.map(([px, py], index) => `${index === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1]![0].toFixed(1)},${height} L${points[0]![0].toFixed(1)},${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 h-[34px] w-full" role="img" aria-label="trend">
      <path d={area} fill={color} opacity={0.14} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
