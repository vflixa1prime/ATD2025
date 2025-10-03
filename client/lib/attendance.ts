import type { DayStatus } from "@shared/api";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function isExcludedName(name: string) {
  const value = String(name || "").trim();
  if (!value) return true;
  const monthPattern = new RegExp(`\\b(${MONTHS.join("|")})\\b`, "i");
  if (monthPattern.test(value)) return true;
  if (/^column\s*\d+$/i.test(value)) return true;
  if (/^\d{4,}$/.test(value)) return true;
  return false;
}

export function parseMonthYear(name?: string | null) {
  if (!name)
    return null as null | { year: number; monthIndex: number; label: string };
  const base = name.replace(/\.[^.]+$/, "");
  const regex = new RegExp(`(${MONTHS.join("|")})[^0-9]*([12][0-9]{3})`, "i");
  const match = base.match(regex);
  if (!match) return null;
  const monthName = match[1];
  const year = parseInt(match[2], 10);
  const monthIndex = MONTHS.findIndex(
    (item) => item.toLowerCase() === monthName.toLowerCase(),
  );
  if (monthIndex < 0) return null;
  const label = `${MONTHS[monthIndex]} ${year}`;
  return { year, monthIndex, label };
}

export function buildCalendarCells(
  days: DayStatus[],
  year?: number,
  monthIndex?: number,
) {
  const sorted = [...(days || [])].sort((a, b) => a.day - b.day);
  let leading = 0;
  if (typeof year === "number" && typeof monthIndex === "number") {
    leading = new Date(year, monthIndex, 1).getDay();
  }
  const cells: (DayStatus | null)[] = Array(Math.max(0, leading))
    .fill(null)
    .concat(sorted);
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailing; i++) cells.push(null);
  return cells;
}

export function codeColor(code: string) {
  switch (code) {
    case "P":
      return "text-emerald-600";
    case "A":
      return "text-rose-600";
    case "WO":
      return "text-amber-600";
    default:
      return "text-muted-foreground";
  }
}
