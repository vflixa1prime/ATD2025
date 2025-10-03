import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AttendanceResponse,
  DailyAttendanceResponse,
  EmployeesResponse,
  FilesListResponse,
  Employee,
} from "@shared/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AttendanceSnapshot from "@/components/attendance/AttendanceSnapshot";
import { captureNodeToPng } from "@/lib/capture";
import { isExcludedName, parseMonthYear } from "@/lib/attendance";
import {
  getWhatsAppCredentials,
  normalizeWhatsAppRecipient,
} from "@/lib/whatsapp-config";
import { toast } from "sonner";

export default function SendMultiPage() {
  const [file, setFile] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({}); // key by number
  const [layout] = useState<"horizontal" | "vertical">("horizontal");

  const filesQuery = useQuery({
    queryKey: ["files"],
    queryFn: async (): Promise<FilesListResponse> => {
      const res = await fetch("/api/files");
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json();
    },
  });
  const files = filesQuery.data?.files ?? [];

  useEffect(() => {
    if (!file && files[0]) setFile(files[0].filename);
  }, [files, file]);

  const employeesQuery = useQuery({
    queryKey: ["employees", file],
    enabled: !!file,
    queryFn: async (): Promise<EmployeesResponse> => {
      const res = await fetch(
        `/api/attendance/employees?file=${encodeURIComponent(file!)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });

  const fileLabel = useMemo(() => {
    const f = files.find((x) => x.filename === file);
    return f?.originalName || "";
  }, [files, file]);

  const employees = useMemo(() => {
    const list = employeesQuery.data?.employees ?? [];
    const filtered = list.filter((e) => !isExcludedName(e.name));
    const mapped = filtered
      .map((e) => ({
        ...e,
        numeric: (e.number || "").replace(/\D+/g, ""),
      }))
      .filter((e) => !!e.numeric);
    if (!search) return mapped;
    const q = search.toLowerCase();
    return mapped.filter(
      (e) =>
        e.numeric.includes(q) ||
        e.number.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q),
    );
  }, [employeesQuery.data, search]) as (Employee & { numeric: string })[];

  const allSelected = useMemo(() => {
    const ids = employees.map((e) => (e as any).numeric || e.number);
    if (!ids.length) return false;
    return ids.every((id) => !!selected[id]);
  }, [employees, selected]);

  const toggleAll = useCallback(
    (checked: boolean) => {
      const next: Record<string, boolean> = { ...selected };
      for (const e of employees) next[(e as any).numeric || e.number] = checked;
      setSelected(next);
    },
    [employees, selected],
  );

  const [status, setStatus] = useState<Record<string, string>>({}); // number -> status
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const captureRef = useRef<HTMLDivElement | null>(null);
  const [snapSummary, setSnapSummary] = useState<AttendanceResponse | null>(
    null,
  );
  const [snapDaily, setSnapDaily] = useState<DailyAttendanceResponse | null>(
    null,
  );

  async function loadEmployeeData(num: string, name: string) {
    const params = new URLSearchParams({ file: file! });
    params.set("number", num);
    const [summaryRes, dailyRes] = await Promise.all([
      fetch(`/api/attendance/summary?${params.toString()}`),
      fetch(`/api/attendance/daily?${params.toString()}`),
    ]);
    if (!summaryRes.ok) throw new Error("Failed to fetch summary");
    if (!dailyRes.ok) throw new Error("Failed to fetch daily");
    const summary = (await summaryRes.json()) as AttendanceResponse;
    const daily = (await dailyRes.json()) as DailyAttendanceResponse;
    return { summary, daily };
  }

  async function renderSnapshotPng(
    summary: AttendanceResponse,
    daily: DailyAttendanceResponse,
  ) {
    setSnapSummary(summary);
    setSnapDaily(daily);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 50));
    if (!captureRef.current) throw new Error("No capture ref");
    return await captureNodeToPng(captureRef.current);
  }

  async function sendOne(
    summary: AttendanceResponse,
    daily: DailyAttendanceResponse,
  ) {
    const cfg = getWhatsAppCredentials();
    if (!cfg) throw new Error("Missing WhatsApp credentials");
    const rawPhone = summary?.details?.mobile1;
    if (!rawPhone) throw new Error("No mobile number (BB) available");
    const to = normalizeWhatsAppRecipient(rawPhone);
    if (!to) throw new Error("Invalid mobile number");

    const dataUrl = await renderSnapshotPng(summary, daily);
    const meta = parseMonthYear(fileLabel);
    const month = meta?.label || "Month";
    const roll = summary.employee.number;
    const message = `${month}-${roll}`;

    const uploadResp = await fetch("/api/whatsapp/image-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: dataUrl,
        name: `${message}.png`,
        publicBase: cfg.imageHost || undefined,
      }),
    });
    const uploadJson = await uploadResp.json();
    if (!uploadResp.ok || !uploadJson?.url)
      throw new Error("Failed to prepare image URL");
    let fileUrl: string = uploadJson.url;
    if (cfg.imageHost) {
      try {
        const tempU = new URL(fileUrl);
        const baseU = new URL(cfg.imageHost);
        fileUrl = `${baseU.origin}${tempU.pathname}`;
      } catch {}
    }

    const payload: any = {
      endpoint: cfg.endpoint,
      appkey: cfg.appkey,
      authkey: cfg.authkey,
      to,
      message,
      fileUrl,
    };
    if (cfg.templateId) payload.template_id = cfg.templateId;

    const resp = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await resp.json();
    if (!resp.ok) throw new Error(j?.error || "Failed to send on WhatsApp");
  }

  async function handleSendSelected() {
    const cfg = getWhatsAppCredentials();
    if (!cfg) {
      toast.error("Set WhatsApp keys first in Settings (WhatsApp) page");
      return;
    }
    const targets = employees.filter(
      (e) => selected[(e as any).numeric || e.number],
    );
    if (!targets.length) {
      toast.message("Select at least one employee");
      return;
    }
    setSending(true);
    setProgress({ current: 0, total: targets.length });

    const nextStatus: Record<string, string> = { ...status };
    for (const t of targets)
      nextStatus[(t as any).numeric || t.number] = "Queued";
    setStatus(nextStatus);

    let i = 0;
    for (const emp of targets) {
      const key = (emp as any).numeric || emp.number;
      i += 1;
      setProgress({ current: i, total: targets.length });
      setStatus((s) => ({ ...s, [key]: "Sending..." }));
      try {
        const data = await loadEmployeeData(emp.number, emp.name);
        await sendOne(data.summary, data.daily);
        setStatus((s) => ({ ...s, [key]: "Sent" }));
      } catch (e: any) {
        setStatus((s) => ({ ...s, [key]: `Failed` }));
      }
    }

    setSending(false);
    toast.success("Completed sending batch");
  }

  return (
    <div className="container mx-auto py-10 space-y-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Send Multi</h1>
        <p className="text-muted-foreground">
          Select multiple employees and send attendance snapshot on WhatsApp.
        </p>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Recipients</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => toggleAll(!allSelected)}
            >
              {allSelected ? "Unselect All" : "Select All"}
            </Button>
            <Button
              size="sm"
              onClick={handleSendSelected}
              disabled={sending || !employees.length}
            >
              {sending
                ? `Sending ${progress.current}/${progress.total}`
                : "Send Selected"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Monthly file
              </label>
              <Select value={file} onValueChange={setFile}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      files.length
                        ? "Select file"
                        : "No files found. Upload in Upload & Files"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {files.map((f) => (
                    <SelectItem key={f.filename} value={f.filename}>
                      {f.originalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Search</label>
              <Input
                placeholder="Type name or roll number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Selected</label>
              <div className="rounded-md border p-3 text-3xl font-extrabold tracking-tight bg-card text-center">
                {Object.values(selected).filter(Boolean).length}
              </div>
            </div>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[52px] text-center">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(v) => toggleAll(Boolean(v))}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Roll</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => {
                  const num = (e as any).numeric || e.number;
                  return (
                    <TableRow key={String(num) + e.name}>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={!!selected[num]}
                          onCheckedChange={(v) =>
                            setSelected((s) => ({ ...s, [num]: Boolean(v) }))
                          }
                          aria-label={`Select ${e.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {String(num)}
                      </TableCell>
                      <TableCell>{e.name}</TableCell>
                      <TableCell>
                        <span
                          className={
                            status[num] === "Sent"
                              ? "text-emerald-600 font-medium"
                              : status[num] === "Failed"
                                ? "text-rose-600 font-medium"
                                : status[num]
                                  ? "text-amber-600"
                                  : "text-muted-foreground"
                          }
                        >
                          {status[num] || "-"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {!files.length && (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              No files uploaded. Go to{" "}
              <a href="/files" className="underline">
                Upload & Files
              </a>{" "}
              to add a monthly Excel file.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Offscreen snapshot renderer for capture */}
      <div
        style={{ position: "absolute", left: -99999, top: -99999, width: 1200 }}
      >
        <div ref={captureRef}>
          <AttendanceSnapshot
            layout={layout}
            summary={snapSummary || undefined}
            daily={snapDaily || undefined}
            fileLabel={fileLabel}
          />
        </div>
      </div>

      {sending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-[90%] max-w-sm rounded-lg border bg-card p-6 shadow-lg text-center"
            role="status"
            aria-live="polite"
          >
            <div className="mb-3 text-base font-semibold">
              Sending to WhatsApp...
            </div>
            <div className="text-sm text-muted-foreground">
              Sending {progress.current}/{progress.total}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
