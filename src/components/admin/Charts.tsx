function computeArcs(
  segments: { value: number; color: string; label?: string; name?: string }[],
  size: number,
  strokeWidth: number
) {
  const circumference = 2 * Math.PI * ((size - strokeWidth) / 2);
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  let offset = 0;
  return segments.map((seg) => {
    const segLength = (seg.value / total) * circumference;
    const arc = {
      ...seg,
      dashArray: `${segLength} ${circumference - segLength}`,
      dashOffset: -offset,
      percentage: ((seg.value / total) * 100).toFixed(0),
    };
    offset += segLength;
    return arc;
  });
}

export function LineChart({
  data,
  labels,
  color = "#4f46e5",
  fillOpacity = 0.1,
  height = 200,
  showDots = true,
  strokeWidth = 2.5,
}: {
  data: number[];
  labels: string[];
  color?: string;
  fillOpacity?: number;
  height?: number;
  showDots?: boolean;
  strokeWidth?: number;
}) {
  const width = 100;
  const padding = { top: 10, right: 5, bottom: 25, left: 5 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;

  const points = data.map((val, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - ((val - minVal) / range) * chartH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${padding.top + chartH} L${points[0].x},${padding.top + chartH} Z`;

  return (
    <svg role="img" aria-label="Line chart" viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={ratio}
          x1={padding.left}
          y1={padding.top + chartH * (1 - ratio)}
          x2={width - padding.right}
          y2={padding.top + chartH * (1 - ratio)}
          stroke="currentColor"
          strokeOpacity={0.06}
          strokeWidth={0.5}
        />
      ))}
      <path d={areaPath} fill={color} fillOpacity={fillOpacity} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {showDots && points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} stroke="white" strokeWidth={1.5} />
      ))}
      {labels.map((label, i) => {
        const x = padding.left + (i / (labels.length - 1)) * chartW;
        return (
          <text key={i} x={x} y={height - 3} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 7 }}>
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export function BarChart({
  data,
  labels,
  color = "#4f46e5",
  height = 200,
  showValues = true,
}: {
  data: number[];
  labels: string[];
  color?: string;
  height?: number;
  showValues?: boolean;
}) {
  const width = 100;
  const padding = { top: 15, right: 5, bottom: 25, left: 5 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...data, 1);
  const barWidth = (chartW / data.length) * 0.65;
  const gap = (chartW / data.length) * 0.35;

  return (
    <svg role="img" aria-label="Bar chart" viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <line
          key={ratio}
          x1={padding.left}
          y1={padding.top + chartH * (1 - ratio)}
          x2={width - padding.right}
          y2={padding.top + chartH * (1 - ratio)}
          stroke="currentColor"
          strokeOpacity={0.06}
          strokeWidth={0.5}
        />
      ))}
      {data.map((val, i) => {
        const barH = (val / maxVal) * chartH;
        const x = padding.left + (i / data.length) * chartW + gap / 2;
        const y = padding.top + chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barH} rx={1.5} fill={color} opacity={0.85} className="transition-opacity hover:opacity-100" />
            {showValues && (
              <text x={x + barWidth / 2} y={y - 3} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 6.5 }}>
                {val}
              </text>
            )}
          </g>
        );
      })}
      {labels.map((label, i) => {
        const x = padding.left + (i / data.length) * chartW + gap / 2 + barWidth / 2;
        return (
          <text key={i} x={x} y={height - 3} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 7 }}>
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export function DonutChart({
  segments,
  size = 180,
  strokeWidth = 28,
  centerLabel,
  centerValue,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const arcs = computeArcs(segments, size, strokeWidth);
  const radius = (size - strokeWidth) / 2;

  return (
    <div className="flex items-center gap-4">
      <svg role="img" aria-label="Donut chart" width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeOpacity={0.06} strokeWidth={strokeWidth} />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-all duration-700"
          />
        ))}
        {centerValue && (
          <text x={size / 2} y={size / 2 - 6} textAnchor="middle" className="fill-foreground" style={{ fontSize: 20, fontWeight: 700 }}>
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text x={size / 2} y={size / 2 + 12} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>
            {centerLabel}
          </text>
        )}
      </svg>
      <div className="space-y-2">
        {arcs.map((arc, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: arc.color }} />
            <span className="text-muted-foreground truncate">{arc.label}</span>
            <span className="font-semibold ml-auto">{arc.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ data, color = "#4f46e5", width = 80, height = 32 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;
  const padding = 2;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (height - padding * 2) - ((val - minVal) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <svg role="img" aria-label="Sparkline chart" width={width} height={height} className="shrink-0">
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
