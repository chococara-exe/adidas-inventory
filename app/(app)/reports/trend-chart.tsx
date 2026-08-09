import { formatRM } from "@/lib/currency";

/** One point per day of the period. `index` is 1-based; `label` is its date. */
export type TrendPoint = { index: number; label: string; value: number };
export type TrendSeries = { name: string; points: TrendPoint[] };

// Chart chrome, one step off the white card surface so it stays recessive.
const GRID = "#e1e0d9";
const AXIS = "#c3c2b7";
const MUTED = "#898781";
const INK = "#52514e";
const SURFACE = "#ffffff";

// Blue for money, orange for units — both validated against the white card
// surface. A comparison period is context, not a rival series, so it uses the
// de-emphasis grey (3.59:1 on white) rather than a second categorical hue.
const ACCENT = { currency: "#2a78d6", units: "#eb6834" } as const;
const CONTEXT = MUTED;

const VIEW_W = 720;
const VIEW_H = 220;
const PAD = { top: 16, right: 18, bottom: 28, left: 60 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;

/** Round a maximum up to a clean axis top (1, 2, 2.5, 5 × a power of ten). */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step =
    normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

export function formatTrendValue(value: number, kind: "currency" | "units"): string {
  return kind === "currency" ? formatRM(value) : `${value} unit${value === 1 ? "" : "s"}`;
}

/**
 * Daily trend across the selected period. The first series is the subject and
 * carries the accent hue plus an area wash; an optional second series is the
 * comparison period, drawn as a bare grey line behind it. Every value is also
 * in the table beneath the chart, so nothing is hover-only.
 */
export function TrendChart({
  series,
  kind,
  label,
}: {
  series: TrendSeries[];
  kind: "currency" | "units";
  label: string;
}) {
  const [primary, rawComparison] = series;
  const span = primary.points.length;

  // A previous calendar month can be longer than this one (31 vs 30 days);
  // the x-scale is the current period, so trim rather than run off the plot.
  const comparison = rawComparison
    ? { ...rawComparison, points: rawComparison.points.slice(0, span) }
    : undefined;

  const rawMax = Math.max(
    ...[primary, ...(comparison ? [comparison] : [])].flatMap((s) => s.points.map((p) => p.value)),
    0
  );
  const axisMax = niceCeil(rawMax);

  const x = (index: number) =>
    PAD.left + (span === 1 ? PLOT_W / 2 : ((index - 1) / (span - 1)) * PLOT_W);
  const y = (value: number) => PAD.top + PLOT_H - (value / axisMax) * PLOT_H;

  const path = (points: TrendPoint[]) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.index)} ${y(p.value)}`).join(" ");

  const linePath = path(primary.points);
  const areaPath = `${linePath} L${x(span)} ${PAD.top + PLOT_H} L${x(1)} ${PAD.top + PLOT_H} Z`;

  // Label the peak and the last day with a value — never every point.
  const peak = primary.points.reduce((best, p) => (p.value > best.value ? p : best), primary.points[0]);
  const lastWithValue = [...primary.points].reverse().find((p) => p.value > 0);
  const marked = primary.points.filter(
    (p) => p.value > 0 && (p.index === peak.index || p.index === lastWithValue?.index)
  );

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => axisMax * f);

  // ~6 evenly spaced ticks, always including the first and last day.
  const tickStep = Math.max(1, Math.ceil(span / 6));
  const tickIndexes = [
    ...new Set([...Array.from({ length: span }, (_, i) => i + 1).filter((i) => (i - 1) % tickStep === 0), span]),
  ].sort((a, b) => a - b);

  return (
    <figure className="m-0">
      {comparison && (
        <figcaption className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-zinc-600">
          {[
            { name: primary.name, colour: ACCENT[kind] },
            { name: comparison.name, colour: CONTEXT },
          ].map((entry) => (
            <span key={entry.name} className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-0.5 w-4 rounded-full"
                style={{ backgroundColor: entry.colour }}
              />
              {entry.name}
            </span>
          ))}
        </figcaption>
      )}

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${label}. Peak ${formatTrendValue(peak.value, kind)} on ${peak.label}.`}
      >
        {gridValues.map((value) => (
          <g key={value}>
            <line
              x1={PAD.left}
              x2={PAD.left + PLOT_W}
              y1={y(value)}
              y2={y(value)}
              stroke={value === 0 ? AXIS : GRID}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 10}
              y={y(value) + 4}
              textAnchor="end"
              fontSize={11}
              fill={MUTED}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {kind === "currency" ? (value / 100).toLocaleString("en-MY") : value}
            </text>
          </g>
        ))}

        {/* Comparison sits behind the subject: line only, no fill, no markers. */}
        {comparison && (
          <path
            d={path(comparison.points)}
            fill="none"
            stroke={CONTEXT}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        <path d={areaPath} fill={ACCENT[kind]} fillOpacity={0.1} />
        <path
          d={linePath}
          fill="none"
          stroke={ACCENT[kind]}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {primary.points.map((p, i) => (
          // Invisible hit target per day, comfortably larger than the dot.
          <rect key={p.index} x={x(p.index) - 8} y={PAD.top} width={16} height={PLOT_H} fill="transparent">
            <title>
              {`${p.label}: ${formatTrendValue(p.value, kind)}` +
                (comparison?.points[i]
                  ? `\n${comparison.points[i].label}: ${formatTrendValue(comparison.points[i].value, kind)}`
                  : "")}
            </title>
          </rect>
        ))}

        {marked.map((p) => (
          <g key={p.index}>
            <circle cx={x(p.index)} cy={y(p.value)} r={6} fill={SURFACE} />
            <circle cx={x(p.index)} cy={y(p.value)} r={4} fill={ACCENT[kind]}>
              <title>{`${p.label}: ${formatTrendValue(p.value, kind)}`}</title>
            </circle>
            <text
              x={Math.min(x(p.index), PAD.left + PLOT_W - 4)}
              y={Math.max(y(p.value) - 12, PAD.top + 10)}
              textAnchor={x(p.index) > PAD.left + PLOT_W - 60 ? "end" : "middle"}
              fontSize={12}
              fontWeight={600}
              fill={INK}
            >
              {formatTrendValue(p.value, kind)}
            </text>
          </g>
        ))}

        {tickIndexes.map((index) => (
          <text
            key={index}
            x={x(index)}
            y={VIEW_H - 8}
            textAnchor={index === 1 ? "start" : index === span ? "end" : "middle"}
            fontSize={11}
            fill={MUTED}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {primary.points[index - 1]?.label ?? ""}
          </text>
        ))}
      </svg>
    </figure>
  );
}
