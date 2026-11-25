import type { Json } from "@/types/database";

export function csvCell(value: unknown): string {
  let text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  // Prevent spreadsheet formula execution, including leading whitespace and control characters.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r]/.test(text))
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function exportCsv(data: Json): string {
  if (!data || Array.isArray(data) || typeof data !== "object")
    throw new Error("Invalid export payload.");
  const rows = [
    ["dataset", "record_id", "field", "value"].map(csvCell).join(","),
  ];
  for (const [dataset, value] of Object.entries(data)) {
    (Array.isArray(value) ? value : [value]).forEach((row, index) => {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        const recordId = row.id ?? row.user_id ?? index;
        for (const [field, fieldValue] of Object.entries(row))
          rows.push(
            [dataset, recordId, field, fieldValue].map(csvCell).join(","),
          );
      } else rows.push([dataset, index, "value", row].map(csvCell).join(","));
    });
  }
  return rows.join("\r\n");
}
