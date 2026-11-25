import { rowNumber, rowText } from "@/lib/control/client";
import type { ControlRow } from "@/types/control";
import { Empty } from "./ui";
export function GrowthChart({ rows }: { rows: ControlRow[] }) {
  if (!rows.length)
    return (
      <Empty
        title="No measurements yet"
        description="Growth is shown only from recorded creation timestamps."
      />
    );
  const max = Math.max(
    1,
    ...rows.flatMap((row) => [
      rowNumber(row, "users"),
      rowNumber(row, "titles"),
    ]),
  );
  const path = (key: string) =>
    rows
      .map(
        (row, index) =>
          `${index ? "L" : "M"}${20 + (index / Math.max(1, rows.length - 1)) * 600},${145 - (rowNumber(row, key) / max) * 125}`,
      )
      .join(" ");
  return (
    <>
      <div className="cc-chart-legend">
        <span>
          <i />
          Titles added
        </span>
        <span>
          <i className="blue" />
          Accounts created
        </span>
      </div>
      <svg
        className="cc-chart"
        viewBox="0 0 640 180"
        role="img"
        aria-label={`Daily growth: ${rows.length} recorded days`}
      >
        <title>Daily title imports and account registrations</title>
        {[0, 1, 2, 3].map((line) => (
          <line
            key={line}
            x1="20"
            x2="620"
            y1={20 + line * 42}
            y2={20 + line * 42}
            stroke="#282d37"
            strokeWidth="1"
          />
        ))}
        <path d={path("titles")} stroke="#e8a64e" strokeWidth="2" fill="none" />
        <path d={path("users")} stroke="#7195cc" strokeWidth="2" fill="none" />
        <text x="20" y="172" fill="#737e90" fontSize="10">
          {rowText(rows[0], "day")}
        </text>
        <text x="620" y="172" textAnchor="end" fill="#737e90" fontSize="10">
          {rowText(rows.at(-1)!, "day")}
        </text>
      </svg>
      <details className="cc-small cc-muted">
        <summary>View chart data</summary>
        <div className="cc-table-wrap">
          <table className="cc-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Titles added</th>
                <th>New accounts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowText(row, "day")}>
                  <td>{rowText(row, "day")}</td>
                  <td>{rowNumber(row, "titles")}</td>
                  <td>{rowNumber(row, "users")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
export function Distribution({
  rows,
  label = "kind",
  value = "count",
}: {
  rows: ControlRow[];
  label?: string;
  value?: string;
}) {
  if (!rows.length) return <Empty title="No distribution recorded" />;
  const total = Math.max(
    1,
    rows.reduce((sum, row) => sum + rowNumber(row, value), 0),
  );
  return (
    <div className="cc-bars">
      {rows.map((row, index) => (
        <div className="cc-bar" key={`${rowText(row, label)}:${index}`}>
          <span>{rowText(row, label).replaceAll("_", " ")}</span>
          <div className="cc-bar-track">
            <span
              style={{ width: `${(rowNumber(row, value) / total) * 100}%` }}
            />
          </div>
          <strong>{rowNumber(row, value).toLocaleString()}</strong>
        </div>
      ))}
    </div>
  );
}
