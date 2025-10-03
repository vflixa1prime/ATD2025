import { forwardRef } from "react";
import type { AttendanceResponse, DailyAttendanceResponse } from "@shared/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildCalendarCells,
  codeColor,
  parseMonthYear,
} from "@/lib/attendance";

type AttendanceSnapshotProps = {
  layout: "horizontal" | "vertical";
  summary?: AttendanceResponse | null;
  daily?: DailyAttendanceResponse | null;
  fileLabel?: string;
};

const AttendanceSnapshot = forwardRef<HTMLDivElement, AttendanceSnapshotProps>(
  function AttendanceSnapshot(props, ref) {
    const { layout, summary, daily, fileLabel } = props;
    const meta = parseMonthYear(fileLabel);

    return (
      <div ref={ref} className="space-y-4">
        {summary && (
          <>
            <div
              className={
                layout === "vertical"
                  ? "grid gap-4 grid-cols-1"
                  : "grid gap-4 sm:grid-cols-3"
              }
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Roll Number
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="font-bold text-base text-center">
                    {summary.employee.number}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Name
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="font-bold text-base text-center">
                    {summary.employee.name}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Department
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="font-bold text-base text-center">
                    {summary.details?.department || "-"}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div
              className={
                layout === "vertical"
                  ? "grid gap-4 grid-cols-1"
                  : "grid gap-4 sm:grid-cols-7"
              }
            >
              <StatCard
                title="Present"
                value={summary.summary.present}
                color="bg-emerald-500"
              />
              <StatCard
                title="Absent"
                value={summary.summary.absent}
                color="bg-rose-500"
              />
              <StatCard
                title="Weekoff"
                value={summary.summary.weekoff}
                color="bg-amber-500"
              />
              <StatCard
                title="Minus"
                value={summary.summary.minus ?? 0}
                color="bg-fuchsia-500"
              />
              <StatCard
                title="ATD"
                value={summary.summary.atd}
                color="bg-blue-500"
              />
              <StatCard
                title="OT Hours"
                value={summary.summary.otHours}
                color="bg-cyan-500"
              />
              <StatCard
                title="Kitchen"
                value={summary.summary.kitchen ?? 0}
                color="bg-indigo-500"
              />
            </div>
          </>
        )}

        {daily && (
          <div className="mt-6 rounded-md border overflow-hidden bg-[#2A176A]">
            <div className="flex items-center justify-center bg-emerald-500 text-white font-semibold px-4 py-2">
              <span className="text-base sm:text-lg">{meta?.label || ""}</span>
            </div>
            <div className="px-4 py-3">
              {layout !== "vertical" ? (
                <>
                  <div className="grid grid-cols-7 gap-2 text-xs font-bold text-white mb-2">
                    <div className="text-center">Sun</div>
                    <div className="text-center">Mon</div>
                    <div className="text-center">Tue</div>
                    <div className="text-center">Wed</div>
                    <div className="text-center">Thu</div>
                    <div className="text-center">Fri</div>
                    <div className="text-center">Sat</div>
                  </div>
                  {(() => {
                    const cells = buildCalendarCells(
                      daily.days,
                      meta?.year,
                      meta?.monthIndex,
                    );
                    const rows: (typeof cells)[number][][] = [];
                    for (let i = 0; i < cells.length; i += 7) {
                      rows.push(cells.slice(i, i + 7));
                    }
                    return rows.map((row, rowIndex) => (
                      <div
                        key={rowIndex}
                        className="grid grid-cols-7 gap-2 mb-2"
                      >
                        {row.map((cell, cellIndex) => (
                          <div
                            key={cellIndex}
                            className="min-h-[76px] rounded-md border bg-card"
                          >
                            {cell ? (
                              <div className="p-2 space-y-1 text-center">
                                <div className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold bg-muted text-foreground/80">
                                  {cell.day}
                                </div>
                                <div
                                  className={
                                    "text-sm font-bold " + codeColor(cell.code)
                                  }
                                >
                                  {cell.code === "WO" ? "W" : cell.code || ""}
                                </div>
                                <div className="text-xs font-bold">
                                  {cell.ot > 0 ? cell.ot : ""}
                                </div>
                              </div>
                            ) : (
                              <div className="p-2" />
                            )}
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
                </>
              ) : (
                (() => {
                  const days = [...daily.days].sort((a, b) => a.day - b.day);
                  return (
                    <div className="space-y-2">
                      {days.map((day) => (
                        <div
                          key={day.day}
                          className="rounded-md border bg-card p-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold bg-muted text-foreground/80 min-w-[28px] text-center">
                              {day.day}
                            </div>
                            <div className="text-sm font-semibold text-white/90">
                              {meta &&
                              typeof meta.year === "number" &&
                              typeof meta.monthIndex === "number"
                                ? new Date(
                                    meta.year,
                                    meta.monthIndex,
                                    day.day,
                                  ).toLocaleDateString(undefined, {
                                    weekday: "long",
                                  })
                                : `Day ${day.day}`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={
                                "text-base font-bold " + codeColor(day.code)
                              }
                            >
                              {day.code === "WO" ? "W" : day.code || ""}
                            </div>
                            <div className="text-xs font-bold">
                              {day.ot > 0 ? day.ot : ""}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )}

        {summary?.details && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Mobile
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div>{summary.details?.mobile1 || "-"}</div>
                <div>{summary.details?.mobile2 || ""}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Present Address
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="whitespace-pre-wrap">
                  {summary.details?.presentAddress || "-"}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  },
);

export default AttendanceSnapshot;

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-extrabold tracking-tight text-center">
          <span
            className={
              color + " inline-block h-3 w-3 rounded-full align-middle mr-2"
            }
          />
          {Number.isFinite(value) ? value : 0}
        </div>
      </CardContent>
    </Card>
  );
}
