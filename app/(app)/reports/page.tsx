import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatRM } from "@/lib/currency";
import { PrintButton } from "../print-button";
import {
  TrendChart,
  formatTrendValue,
  type TrendPoint,
  type TrendSeries,
} from "./trend-chart";

const DAY_LABEL = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short" });
const FULL_LABEL = new Intl.DateTimeFormat("en-MY", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const REVENUE_HUE = "#2a78d6";
const UNITS_HUE = "#eb6834";
const MAX_RANGE_DAYS = 366;

/** yyyy-mm-dd in local time — toISOString() shifts the day at UTC+8. */
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function parseDay(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(y, m - 1, d);
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d
    ? parsed
    : null;
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Whole days between two local midnights, ignoring DST wobble. */
const daysBetween = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / 86_400_000);

const isWholeMonth = (from: Date, to: Date) =>
  from.getDate() === 1 &&
  from.getFullYear() === to.getFullYear() &&
  from.getMonth() === to.getMonth() &&
  to.getDate() === new Date(to.getFullYear(), to.getMonth() + 1, 0).getDate();

/** "August 2026" for a whole calendar month, otherwise "1 Aug – 15 Aug 2026". */
function rangeLabel(from: Date, to: Date) {
  return isWholeMonth(from, to)
    ? new Intl.DateTimeFormat("en-MY", { month: "long", year: "numeric" }).format(from)
    : `${DAY_LABEL.format(from)} – ${FULL_LABEL.format(to)}`;
}

/**
 * The reporting window. Defaults to the current calendar month, so the plain
 * /reports view still reads as a monthly report; `from`/`to` override it.
 */
function resolvePeriod(fromParam?: string, toParam?: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  let from = parseDay(fromParam) ?? monthStart;
  let to = parseDay(toParam) ?? monthEnd;
  if (to < from) [from, to] = [to, from];
  if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) to = addDays(from, MAX_RANGE_DAYS - 1);

  const days = daysBetween(from, to) + 1;
  const wholeMonth = isWholeMonth(from, to);

  // The equal-length window immediately before this one. For a whole month
  // that is the previous calendar month — the month-on-month comparison.
  const previous = wholeMonth
    ? {
        from: new Date(from.getFullYear(), from.getMonth() - 1, 1),
        to: new Date(from.getFullYear(), from.getMonth(), 0),
      }
    : { from: addDays(from, -days), to: addDays(from, -1) };

  return {
    from,
    to,
    days,
    wholeMonth,
    label: rangeLabel(from, to),
    previous: {
      ...previous,
      // Its own length: a previous calendar month can be shorter or longer
      // than this one, and reusing `days` would bleed into a neighbouring month.
      days: daysBetween(previous.from, previous.to) + 1,
      label: rangeLabel(previous.from, previous.to),
    },
  };
}

/** Day-by-day figures behind the chart, so no value is chart-only. */
function TrendTable({ points, kind }: { points: TrendPoint[]; kind: "currency" | "units" }) {
  const withSales = points.filter((p) => p.value > 0);
  return (
    <table className="mt-2 w-full max-w-sm text-left text-sm print:mt-1 print:text-[9px]">
      <thead>
        <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500 print:text-[8px]">
          <th className="py-1.5 pr-4 print:py-0">Day</th>
          <th className="py-1.5 print:py-0">{kind === "currency" ? "Revenue" : "Units"}</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {withSales.length === 0 && (
          <tr>
            <td colSpan={2} className="py-2 text-zinc-500 print:py-0.5">
              No sales on any day in this period.
            </td>
          </tr>
        )}
        {withSales.map((p) => (
          <tr key={p.index} className="border-b border-zinc-100 last:border-0">
            <td className="py-1.5 pr-4 text-zinc-600 print:py-0">{p.label}</td>
            <td className="py-1.5 text-zinc-900 print:py-0">{formatTrendValue(p.value, kind)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    compare?: string;
    store?: string;
    item?: string;
  }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  // A store account only ever reports on its own store; an admin sees them all.
  const ownStoreId = isAdmin ? null : user.storeId;
  if (!isAdmin && !ownStoreId) redirect("/");

  const params = await searchParams;
  const period = resolvePeriod(params.from, params.to);
  const comparing = params.compare === "1";

  const saleIn = (from: Date, to: Date) =>
    ({
      type: "SALE",
      date: { gte: from, lt: addDays(to, 1) },
      ...(ownStoreId ? { storeId: ownStoreId } : {}),
    }) as const;

  const current = saleIn(period.from, period.to);
  const prior = saleIn(period.previous.from, period.previous.to);

  // A reporting window is a small set of rows, so they are pulled once and
  // folded in memory — revenue per line needs quantity × unitPriceSen, which
  // groupBy cannot express.
  const [receipts, lines, priorReceipts, priorLines, selectedStore, selectedItem] =
    await Promise.all([
      prisma.receipt.findMany({
        where: current,
        select: { storeId: true, date: true, totalSen: true, store: { select: { name: true } } },
      }),
      prisma.receiptLine.findMany({
        where: { receipt: current },
        select: {
          itemId: true,
          quantity: true,
          unitPriceSen: true,
          item: { select: { name: true, articleNumber: true } },
          receipt: { select: { date: true } },
        },
      }),
      comparing
        ? prisma.receipt.findMany({
            where: prior,
            select: { storeId: true, date: true, totalSen: true },
          })
        : [],
      comparing
        ? prisma.receiptLine.findMany({
            where: { receipt: prior },
            select: { itemId: true, quantity: true, receipt: { select: { date: true } } },
          })
        : [],
      // Store accounts are pinned to their own store, so a ?store= pointing at
      // someone else's shop cannot even surface its name.
      ownStoreId
        ? prisma.store.findUnique({ where: { id: ownStoreId }, select: { id: true, name: true } })
        : params.store
          ? prisma.store.findUnique({
              where: { id: params.store },
              select: { id: true, name: true },
            })
          : null,
      params.item
        ? prisma.item.findUnique({
            where: { id: params.item },
            select: { id: true, name: true, articleNumber: true },
          })
        : null,
    ]);

  const totalRevenueSen = receipts.reduce((sum, r) => sum + r.totalSen, 0);
  const priorRevenueSen = priorReceipts.reduce((sum, r) => sum + r.totalSen, 0);
  const deltaPct =
    comparing && priorRevenueSen > 0
      ? ((totalRevenueSen - priorRevenueSen) / priorRevenueSen) * 100
      : null;

  const storeRows = [
    ...receipts
      .reduce((acc, r) => {
        const row =
          acc.get(r.storeId) ?? { id: r.storeId, name: r.store.name, revenueSen: 0, receipts: 0 };
        row.revenueSen += r.totalSen;
        row.receipts += 1;
        return acc.set(r.storeId, row);
      }, new Map<string, { id: string; name: string; revenueSen: number; receipts: number }>())
      .values(),
  ].sort((a, b) => b.revenueSen - a.revenueSen);

  const itemRows = [
    ...lines
      .reduce((acc, l) => {
        const row =
          acc.get(l.itemId) ??
          {
            id: l.itemId,
            name: l.item.name,
            articleNumber: l.item.articleNumber,
            units: 0,
            revenueSen: 0,
          };
        row.units += l.quantity;
        row.revenueSen += l.quantity * l.unitPriceSen;
        return acc.set(l.itemId, row);
      }, new Map<string, { id: string; name: string; articleNumber: string; units: number; revenueSen: number }>())
      .values(),
  ].sort((a, b) => b.units - a.units);

  /** Empty day buckets spanning a window, labelled with their dates. */
  const buckets = (from: Date, count: number): TrendPoint[] =>
    Array.from({ length: count }, (_, i) => ({
      index: i + 1,
      label: DAY_LABEL.format(addDays(from, i)),
      value: 0,
    }));

  const bucketFor = (points: TrendPoint[], from: Date, date: Date) => {
    const i = daysBetween(from, new Date(date.getFullYear(), date.getMonth(), date.getDate()));
    return i >= 0 && i < points.length ? points[i] : null;
  };

  let trend: {
    series: TrendSeries[];
    kind: "currency" | "units";
    heading: string;
    total: string;
  } | null = null;

  // A store account has its store selected all along, so an item the user
  // actually clicked takes precedence over the standing store trend.
  const showItemTrend = Boolean(selectedItem && (params.item || !selectedStore));

  if (selectedStore && !showItemTrend) {
    const points = buckets(period.from, period.days);
    for (const r of receipts) {
      if (r.storeId === selectedStore.id) {
        const bucket = bucketFor(points, period.from, r.date);
        if (bucket) bucket.value += r.totalSen;
      }
    }
    const series: TrendSeries[] = [{ name: period.label, points }];
    if (comparing) {
      const priorPoints = buckets(period.previous.from, period.previous.days);
      for (const r of priorReceipts) {
        if (r.storeId === selectedStore.id) {
          const bucket = bucketFor(priorPoints, period.previous.from, r.date);
          if (bucket) bucket.value += r.totalSen;
        }
      }
      series.push({ name: period.previous.label, points: priorPoints });
    }
    trend = {
      series,
      kind: "currency",
      heading: `${selectedStore.name} — daily revenue`,
      total: formatRM(points.reduce((s, p) => s + p.value, 0)),
    };
  } else if (selectedItem && showItemTrend) {
    const points = buckets(period.from, period.days);
    for (const l of lines) {
      if (l.itemId === selectedItem.id) {
        const bucket = bucketFor(points, period.from, l.receipt.date);
        if (bucket) bucket.value += l.quantity;
      }
    }
    const series: TrendSeries[] = [{ name: period.label, points }];
    if (comparing) {
      const priorPoints = buckets(period.previous.from, period.previous.days);
      for (const l of priorLines) {
        if (l.itemId === selectedItem.id) {
          const bucket = bucketFor(priorPoints, period.previous.from, l.receipt.date);
          if (bucket) bucket.value += l.quantity;
        }
      }
      series.push({ name: period.previous.label, points: priorPoints });
    }
    trend = {
      series,
      kind: "units",
      heading: `${selectedItem.name} — units sold per day`,
      total: `${points.reduce((s, p) => s + p.value, 0)} units`,
    };
  }

  const link = (next: Partial<Record<"from" | "to" | "compare" | "store" | "item", string>>) => {
    const q = new URLSearchParams({ from: dayKey(period.from), to: dayKey(period.to) });
    if (comparing) q.set("compare", "1");
    if (params.store) q.set("store", params.store);
    if (params.item) q.set("item", params.item);
    for (const [key, value] of Object.entries(next)) {
      if (value === "") q.delete(key);
      else q.set(key, value);
    }
    // Drill-downs jump to #trend so the chart scrolls into view.
    const hash = q.has("store") || q.has("item") ? "#trend" : "";
    return `/reports?${q}${hash}`;
  };

  const now = new Date();
  const presets = [
    {
      name: "This month",
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    },
    {
      name: "Last month",
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to: new Date(now.getFullYear(), now.getMonth(), 0),
    },
    { name: "Last 30 days", from: addDays(now, -29), to: now },
    {
      name: "This year",
      from: new Date(now.getFullYear(), 0, 1),
      to: new Date(now.getFullYear(), 11, 31),
    },
  ];

  const maxStoreRevenue = Math.max(...storeRows.map((s) => s.revenueSen), 1);
  const maxItemUnits = Math.max(...itemRows.map((i) => i.units), 1);
  const inputClass =
    "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 print:text-base">
            Reports
          </h1>
          <p className="mt-1 text-sm text-zinc-500 print:mt-0 print:text-[10px]">
            {isAdmin
              ? "Sales across all stores."
              : `Sales for ${selectedStore?.name ?? "your store"}.`}{" "}
            Figures cover completed sale receipts only.
          </p>
        </div>
        <PrintButton label="Save as PDF" />
      </div>

      {/* One filter row above everything it scopes — period and comparison
          apply to the totals, both lists and the trend chart alike. */}
      <form
        method="get"
        action="/reports"
        className="mt-5 rounded-2xl bg-white p-4 shadow-sm print:hidden"
      >
        {params.store && <input type="hidden" name="store" value={params.store} />}
        {params.item && <input type="hidden" name="item" value={params.item} />}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="from" className="block text-xs font-medium text-zinc-600">
              From
            </label>
            <input
              id="from"
              type="date"
              name="from"
              defaultValue={dayKey(period.from)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label htmlFor="to" className="block text-xs font-medium text-zinc-600">
              To
            </label>
            <input
              id="to"
              type="date"
              name="to"
              defaultValue={dayKey(period.to)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <label className="flex items-center gap-2 pb-2.5 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              name="compare"
              value="1"
              defaultChecked={comparing}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Compare with previous period
          </label>
          <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700">
            Apply
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-zinc-100 pt-3">
          <span className="mr-1 text-xs text-zinc-500">Quick ranges:</span>
          {presets.map((p) => {
            const active =
              dayKey(p.from) === dayKey(period.from) && dayKey(p.to) === dayKey(period.to);
            return (
              <Link
                key={p.name}
                href={link({ from: dayKey(p.from), to: dayKey(p.to) })}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                  active
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {p.name}
              </Link>
            );
          })}
          <span className="ml-auto flex items-center gap-1">
            <Link
              href={link({
                from: dayKey(period.previous.from),
                to: dayKey(period.previous.to),
              })}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            >
              ‹ Previous period
            </Link>
            <Link
              href={link({
                from: dayKey(
                  period.wholeMonth
                    ? new Date(period.from.getFullYear(), period.from.getMonth() + 1, 1)
                    : addDays(period.to, 1)
                ),
                to: dayKey(
                  period.wholeMonth
                    ? new Date(period.from.getFullYear(), period.from.getMonth() + 2, 0)
                    : addDays(period.to, period.days)
                ),
              })}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            >
              Next period ›
            </Link>
          </span>
        </div>
      </form>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm print:mt-2 print:break-inside-avoid print:rounded-md print:border print:border-zinc-200 print:p-2 print:shadow-none">
        <div className="text-sm text-zinc-500 print:text-[10px]">Revenue</div>
        <div className="mt-1 text-5xl font-semibold tracking-tight text-zinc-900 print:mt-0 print:text-xl">
          {formatRM(totalRevenueSen)}
        </div>
        <div className="mt-1 text-sm text-zinc-500 print:mt-0 print:text-[10px]">
          {period.label}
          {comparing && (
            <>
              {" · "}
              {deltaPct === null
                ? `no revenue in the previous period (${formatRM(priorRevenueSen)})`
                : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}% vs previous period (${formatRM(
                    priorRevenueSen
                  )})`}
            </>
          )}
        </div>
      </div>

      {trend && (
        <div
          id="trend"
          className="mt-6 scroll-mt-6 rounded-2xl bg-white p-6 shadow-sm print:mt-2 print:break-inside-avoid print:rounded-md print:border print:border-zinc-200 print:p-2 print:shadow-none"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 print:text-xs">
                {trend.heading}
              </h2>
              <p className="mt-0.5 text-sm text-zinc-500 print:text-[10px]">
                {period.label}. Total {trend.total}.
              </p>
            </div>
            {/* A store account always has a trend on screen; closing an item
                returns it to its own store's revenue rather than to nothing. */}
            {(isAdmin || showItemTrend) && (
              <Link
                href={link({ store: "", item: "" })}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 print:hidden"
              >
                Close
              </Link>
            )}
          </div>
          <div className="mt-4 print:mt-1 print:max-w-120">
            <TrendChart series={trend.series} kind={trend.kind} label={trend.heading} />
          </div>
          {/* On screen the day-by-day figures sit behind a disclosure; a closed
              <details> would print as an empty stub, so the PDF gets the table flat. */}
          <details className="mt-3 print:hidden">
            <summary className="cursor-pointer text-sm font-medium text-zinc-600 hover:text-zinc-900">
              View as table
            </summary>
            <TrendTable points={trend.series[0].points} kind={trend.kind} />
          </details>
          <div className="hidden print:mt-3 print:block">
            <TrendTable points={trend.series[0].points} kind={trend.kind} />
          </div>
        </div>
      )}

      {/* Paper is narrower than the lg breakpoint, so the two lists would
          stack and spill onto a second page — keep them side by side. */}
      <div
        className={`mt-6 grid gap-6 print:mt-2 print:gap-2 ${
          isAdmin ? "lg:grid-cols-2 print:grid-cols-2" : ""
        }`}
      >
        {/* A store account has exactly one store, so a "by store" breakdown
            would be a one-row list restating the headline. */}
        {isAdmin && (
        <section className="rounded-2xl bg-white p-6 shadow-sm print:break-inside-avoid print:rounded-md print:border print:border-zinc-200 print:p-2 print:shadow-none">
          <h2 className="text-base font-semibold text-zinc-900 print:text-xs">Revenue by store</h2>
          <p className="mt-0.5 text-sm text-zinc-500 print:hidden">
            Select a store to see its trend over the period.
          </p>
          {storeRows.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500 print:mt-1 print:text-[10px]">
              No sales recorded in {period.label}.
            </p>
          ) : (
            <ul className="mt-4 space-y-1 print:mt-1 print:space-y-0">
              {storeRows.map((s) => (
                <li key={s.id}>
                  <Link
                    href={link({ store: s.id, item: "" })}
                    className={`block rounded-lg px-3 py-2.5 transition hover:bg-zinc-50 print:break-inside-avoid print:px-0 print:py-0.5 ${
                      selectedStore?.id === s.id ? "bg-zinc-50 ring-1 ring-zinc-200" : ""
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium text-zinc-900 print:text-[10px]">
                        {s.name}
                      </span>
                      <span className="text-sm tabular-nums text-zinc-900 print:text-[10px]">
                        {formatRM(s.revenueSen)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full rounded-sm bg-zinc-100 print:mt-0.5 print:h-1">
                      <div
                        className="h-2 rounded-l-sm rounded-r print:h-1"
                        style={{
                          width: `${Math.max((s.revenueSen / maxStoreRevenue) * 100, 1)}%`,
                          backgroundColor: REVENUE_HUE,
                        }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 print:mt-0 print:text-[8px]">
                      {s.receipts} receipt{s.receipts === 1 ? "" : "s"}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        )}

        <section className="rounded-2xl bg-white p-6 shadow-sm print:break-inside-avoid print:rounded-md print:border print:border-zinc-200 print:p-2 print:shadow-none">
          <h2 className="text-base font-semibold text-zinc-900 print:text-xs">
            Units sold by item
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500 print:hidden">
            Select an item to see how many sold each day.
          </p>
          {itemRows.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500 print:mt-1 print:text-[10px]">
              No items sold in {period.label}.
            </p>
          ) : (
            <ul className="mt-4 space-y-1 print:mt-1 print:space-y-0">
              {itemRows.map((i) => (
                <li key={i.id}>
                  <Link
                    href={link({ item: i.id, store: "" })}
                    className={`block rounded-lg px-3 py-2.5 transition hover:bg-zinc-50 print:break-inside-avoid print:px-0 print:py-0.5 ${
                      selectedItem?.id === i.id ? "bg-zinc-50 ring-1 ring-zinc-200" : ""
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium text-zinc-900 print:text-[10px]">
                        {i.name}
                      </span>
                      <span className="text-sm tabular-nums text-zinc-900 print:text-[10px]">
                        {i.units}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full rounded-sm bg-zinc-100 print:mt-0.5 print:h-1">
                      <div
                        className="h-2 rounded-l-sm rounded-r print:h-1"
                        style={{
                          width: `${Math.max((i.units / maxItemUnits) * 100, 1)}%`,
                          backgroundColor: UNITS_HUE,
                        }}
                      />
                    </div>
                    <div className="mt-1 text-xs tabular-nums text-zinc-500 print:mt-0 print:text-[8px]">
                      {i.articleNumber} · {formatRM(i.revenueSen)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
