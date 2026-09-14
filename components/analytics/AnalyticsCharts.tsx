"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { AnalyticsDailyPoint } from "@/lib/analytics/types";

const COLORS = {
  primary: "#3157d5",
  grid: "#e5e9f1",
  axis: "#65708a",
  track: "#edf0f5",
};

const tooltipStyle = {
  border: "1px solid #dfe4ee",
  borderRadius: 10,
  boxShadow: "0 8px 24px rgba(23, 32, 51, .10)",
  fontSize: 12,
};

export function AnalyticsLineChart({
  data,
  label,
  emptyText = "目前尚無資料",
}: {
  data: AnalyticsDailyPoint[];
  label: string;
  emptyText?: string;
}) {
  if (!data.length || data.every((point) => point.value === 0)) {
    return <div className="analytics-empty-chart">{emptyText}</div>;
  }

  return (
    <div className="analytics-recharts analytics-recharts-line" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 4, left: 0 }} accessibilityLayer>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            tickMargin={10}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            width={34}
            domain={[0, "auto"]}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(_label, payload) => payload?.[0]?.payload?.date ?? _label}
            formatter={(value) => [Number(value).toLocaleString("zh-TW"), label]}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={label}
            stroke={COLORS.primary}
            strokeWidth={3}
            dot={{ r: 3, fill: "#fff", stroke: COLORS.primary, strokeWidth: 2 }}
            activeDot={{ r: 5, fill: "#fff", stroke: COLORS.primary, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 百分比/進度語意使用一般Progress UI，而不是統計圖表。
 * 灰色軌道代表尚未達成，藍色代表已達成。
 */
export function AnalyticsProgressList({
  rows,
  valueSuffix = "%",
  emptyText = "目前尚無資料",
  maxValue = 100,
}: {
  rows: Array<{ id: string; label: string; value: number | null; meta?: string }>;
  valueSuffix?: string;
  emptyText?: string;
  maxValue?: number;
}) {
  const valid = rows.filter((row) => row.value != null);
  if (!valid.length) return <div className="analytics-empty-chart">{emptyText}</div>;
  const max = Math.max(1, maxValue);

  return (
    <div className="analytics-bars">
      {rows.map((row) => (
        <div className="analytics-bar-row" key={row.id}>
          <div className="analytics-bar-label">
            <span>{row.label}</span>
            {row.meta && <small>{row.meta}</small>}
          </div>
          <div
            className="analytics-bar-track"
            role="progressbar"
            aria-label={row.label}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={row.value ?? undefined}
          >
            {row.value != null && (
              <span
                className="analytics-bar-fill"
                style={{ width: `${Math.max(0, Math.min(100, (row.value / max) * 100))}%` }}
              />
            )}
          </div>
          <strong className="analytics-bar-value">{row.value == null ? "—" : `${row.value}${valueSuffix}`}</strong>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsHorizontalBarChart({
  rows,
  valueSuffix = "",
  emptyText = "目前尚無資料",
}: {
  rows: Array<{ id: string; label: string; value: number | null; meta?: string }>;
  valueSuffix?: string;
  emptyText?: string;
}) {
  const data = rows.filter((row) => row.value != null).map((row) => ({ ...row, value: row.value as number }));
  if (!data.length) return <div className="analytics-empty-chart">{emptyText}</div>;

  const height = Math.max(190, data.length * 42 + 48);

  return (
    <div className="analytics-recharts" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 18, bottom: 4, left: 0 }} accessibilityLayer>
          <CartesianGrid stroke={COLORS.grid} horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            tickFormatter={(value) => `${value}${valueSuffix}`}
          />
          <YAxis
            type="category"
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            width={54}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(labelValue) => {
              const row = data.find((item) => item.label === labelValue);
              return row?.meta ? `${row.label} - ${row.meta}` : String(labelValue);
            }}
            formatter={(value) => [`${Number(value).toLocaleString("zh-TW")}${valueSuffix}`, "數值"]}
          />
          <Bar
            dataKey="value"
            name="數值"
            fill={COLORS.primary}
            background={{ fill: COLORS.track }}
            radius={[0, 6, 6, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type AnalyticsChartTone =
  | "success"
  | "warning"
  | "neutral"
  | "danger"
  | "muted"
  | "important"
  | "question"
  | "importantNote"
  | "questionNote";

export type StackedSeries = {
  key: string;
  label: string;
  tone: AnalyticsChartTone;
};

const STACKED_COLORS: Record<AnalyticsChartTone, string> = {
  success: "#41a372",
  warning: "#e5a23b",
  neutral: "#6881c9",
  danger: "#d86262",
  muted: "#a7afbd",
  important: "#e46b67",
  question: "#e6bf40",
  importantNote: "#67e0e4",
  questionNote: "#4067e6",
};

function AnalyticsStackedTooltip({
  active,
  payload,
  label,
  series,
}: TooltipContentProps & { series: StackedSeries[] }) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload as Record<string, unknown> | undefined;
  const rowLabel = String(row?.label ?? label ?? "");
  const meta = typeof row?.meta === "string" && row.meta ? ` - ${row.meta}` : "";
  const total = Number(row?.total ?? 0);

  return (
    <div className="analytics-chart-tooltip">
      <strong>{rowLabel}{meta}{Number.isFinite(total) ? ` (總數${total})` : ""}</strong>
      <div className="analytics-chart-tooltip-series">
        {series.map((item) => {
          const value = Number(row?.[item.key] ?? 0);
          return (
            <div key={item.key}>
              <span className="analytics-chart-tooltip-dot" style={{ background: STACKED_COLORS[item.tone] ?? COLORS.primary }} />
              <span>{item.label}</span>
              <strong>{Number.isFinite(value) ? value.toLocaleString("zh-TW") : "0"}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AnalyticsStackedBars({
  rows,
  series,
  emptyText = "目前尚無資料",
}: {
  rows: Array<{ id: string; label: string; total: number; values: Record<string, number>; meta?: string }>;
  series: StackedSeries[];
  emptyText?: string;
}) {
  const activeRows = rows.filter((row) => row.total > 0);
  if (!activeRows.length) return <div className="analytics-empty-chart">{emptyText}</div>;

  const data = activeRows.map((row) => ({
    id: row.id,
    label: row.label,
    meta: row.meta,
    total: row.total,
    ...row.values,
  }));
  const height = Math.max(210, data.length * 46 + 72);

  return (
    <div className="analytics-recharts" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          data={data}
          layout="vertical"
          stackOffset="expand"
          margin={{ top: 8, right: 18, bottom: 4, left: 0 }}
          accessibilityLayer
        >
          <CartesianGrid stroke={COLORS.grid} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 1]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
          />
          <YAxis
            type="category"
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: COLORS.axis, fontSize: 11 }}
            width={104}
          />
          <Tooltip
            content={(props) => (
              <AnalyticsStackedTooltip {...props} series={series} />
            )}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: COLORS.axis }} />
          {series.map((item) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label}
              stackId="total"
              fill={STACKED_COLORS[item.tone] ?? COLORS.primary}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

