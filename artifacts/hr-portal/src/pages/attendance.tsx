import { useState, useEffect } from "react";
import { useSearchParams } from "wouter";
import { useListAttendance, getListAttendanceQueryKey, useGetTodayAttendance, getGetTodayAttendanceQueryKey, usePunchIn, usePunchOut, useStartBreak, useEndBreak, type TodayAttendance } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RequestDialog } from "@/components/request-dialog";
import { TablePagination } from "@/components/table-pagination";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Search, MoreVertical, Loader2, PencilLine, Coffee, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

// Standard break entitlement (minutes) — breaks don't count as working hours.
const BREAK_ALLOWANCE_MIN = 60;

// Hard cap on a single shift (minutes). The server auto punches-out at this
// point; the UI caps the live timer here too so it can't display more.
const MAX_WORK_MIN = 12 * 60;

const formatTimeStr = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
};

const formatHoursWorked = (hours: number) => {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
};

const getDayName = (dateStr: string) => {
  return format(parseISO(dateStr), "EEE");
};

const getStatusDisplay = (record: { status: string; hoursWorked?: number | null }) => {
  const { status, hoursWorked } = record;
  if (status === "weekend") return { label: "Weekend", cls: "bg-muted text-muted-foreground" };
  if (status === "on_leave") return { label: "On Leave", cls: "bg-info/15 text-info" };
  if (status === "absent") return { label: "Absent", cls: "bg-danger/15 text-danger" };
  if (status === "half_day") return { label: "Partial", cls: "bg-warning/15 text-warning" };
  if (status === "holiday") return { label: "Holiday", cls: "bg-primary/15 text-primary" };
  if (hoursWorked && hoursWorked > 8) return { label: "Extra Hours", cls: "bg-accent text-primary" };
  return { label: "Present", cls: "bg-success/15 text-success" };
};

const TODAY = format(new Date(), "yyyy-MM-dd");

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const minsBetween = (a: string, b: string) => Math.max(0, toMin(b) - toMin(a));
const minutesToHm = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

type TimelineSegment = { type: "work" | "break"; from: string; to: string; ongoing: boolean };

// Break the day into consecutive work/break blocks ("working hours from one
// hour to the next"). `now` closes any still-open block.
function buildTimeline(record: TodayAttendance | undefined, now: string): TimelineSegment[] {
  const segs: TimelineSegment[] = [];
  if (!record?.punchIn) return segs;
  // Cap an open shift at the 12h limit so the live timer stops there, matching
  // the server's auto punch-out (same-day shifts only — the common case).
  let end = record.punchOut ?? now;
  let capped = false;
  if (!record.punchOut) {
    const capMin = toMin(record.punchIn) + MAX_WORK_MIN;
    if (capMin <= 23 * 60 + 59 && toMin(now) >= capMin) {
      end = `${String(Math.floor(capMin / 60)).padStart(2, "0")}:${String(capMin % 60).padStart(2, "0")}`;
      capped = true;
    }
  }
  // Once capped, the shift is effectively over (pending the server's punch-out),
  // so the trailing block is no longer "ongoing".
  const stillOpen = !record.punchOut && !capped;
  const breaks = (record.breaks ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
  let cursor = record.punchIn;
  for (const b of breaks) {
    if (b.startTime > cursor) segs.push({ type: "work", from: cursor, to: b.startTime, ongoing: false });
    const bEnd = b.endTime ?? end;
    segs.push({ type: "break", from: b.startTime, to: bEnd, ongoing: b.endTime == null });
    cursor = bEnd;
  }
  if (cursor < end) segs.push({ type: "work", from: cursor, to: end, ongoing: stillOpen });
  return segs;
}

export default function Attendance({ embedded = false }: { embedded?: boolean }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchDate, setSearchDate] = useState("");
  const [page, setPage] = useState(1);
  const [attendanceReqOpen, setAttendanceReqOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionDate, setCorrectionDate] = useState<string | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();

  // Opened from the Quick Actions menu (/attendance?new=1) — auto-open the
  // Send Attendance Request dialog, then drop the param. Skipped when embedded
  // in the admin Attendance page (that view isn't a Quick Actions target).
  useEffect(() => {
    if (!embedded && searchParams.get("new") === "1") {
      setAttendanceReqOpen(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, embedded]);

  const openCorrection = (date: string) => {
    setCorrectionDate(date);
    setCorrectionOpen(true);
  };

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const { data: todayRecord, isLoading: todayLoading } = useGetTodayAttendance({
    query: { queryKey: getGetTodayAttendanceQueryKey() }
  });

  const params = { month: currentMonth, year: currentYear };
  const { data: history, isLoading: historyLoading } = useListAttendance(params, {
    query: { queryKey: getListAttendanceQueryKey(params) }
  });

  const punchIn = usePunchIn();
  const punchOut = usePunchOut();
  const startBreak = useStartBreak();
  const endBreak = useEndBreak();
  const { toast } = useToast();

  const refreshToday = () => {
    queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey(params) });
  };

  const handlePunchIn = () => punchIn.mutate(undefined, { onSuccess: refreshToday });
  const handlePunchOut = () => punchOut.mutate(undefined, { onSuccess: refreshToday });

  const apiError = (error: unknown, fallback: string) => {
    const data = (error as { data?: unknown } | null)?.data;
    const msg = data && typeof data === "object" ? (data as { error?: unknown }).error : undefined;
    return typeof msg === "string" && msg.trim() ? msg : fallback;
  };
  const handleStartBreak = () => startBreak.mutate(undefined, {
    onSuccess: refreshToday,
    onError: (e) => toast({ title: "Couldn't start break", description: apiError(e, "Please try again."), variant: "destructive" }),
  });
  const handleEndBreak = () => endBreak.mutate(undefined, {
    onSuccess: refreshToday,
    onError: (e) => toast({ title: "Couldn't end break", description: apiError(e, "Please try again."), variant: "destructive" }),
  });

  const filtered = (history ?? []).filter((r) => {
    if (searchDate && !r.date.includes(searchDate)) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "extra") return (r.hoursWorked ?? 0) > 8;
    return r.status === statusFilter;
  });

  // Pagination over the filtered rows. Clamp the page so changing a filter
  // never leaves us on an out-of-range page.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const setFilterAndReset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  // Today's break/timeline state (todayRecord now carries breaks + derived flags).
  const nowStr = format(new Date(), "HH:mm");
  const timeline = buildTimeline(todayRecord, nowStr);
  const breakMinutes = todayRecord?.breakMinutes ?? 0;
  const onBreak = todayRecord?.onBreak ?? false;
  const breakBusy = startBreak.isPending || endBreak.isPending;
  const workedMinutes = timeline
    .filter((s) => s.type === "work")
    .reduce((sum, s) => sum + minsBetween(s.from, s.to), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={embedded ? "space-y-6" : "max-w-6xl mx-auto space-y-6"}
    >
      {/* Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center gap-4 ${embedded ? "sm:justify-end" : "sm:justify-between"}`}>
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track your daily attendance, breaks, and work hours</p>
          </div>
        )}
        <Button
          className="bg-primary hover:bg-primary/90 gap-2 self-start sm:self-auto"
          onClick={() => setAttendanceReqOpen(true)}
          data-testid="button-send-attendance-request"
        >
          <Send className="w-4 h-4" />
          Send Attendance Request
        </Button>
      </div>

      {/* Punch in/out quick card if today not done */}
      {!todayLoading && todayRecord && !todayRecord.punchIn && (
        <Card className="border-border bg-accent/40">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-foreground">You haven't punched in today yet.</p>
            <Button
              className="bg-primary hover:bg-primary/90 gap-2"
              onClick={handlePunchIn}
              disabled={punchIn.isPending}
              data-testid="button-punch-in"
            >
              {punchIn.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Punch In
            </Button>
          </CardContent>
        </Card>
      )}
      {!todayLoading && todayRecord?.punchIn && !todayRecord?.punchOut && (
        <Card className={onBreak ? "border-warning/40 bg-warning/10" : "border-success/30 bg-success/10"}>
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <p className={`text-sm font-medium ${onBreak ? "text-warning" : "text-success"}`}>
                {onBreak
                  ? "You're on a break — work hours are paused."
                  : `Punched in at ${formatTimeStr(todayRecord.punchIn)} — remember to punch out before you leave.`}
              </p>
              <p className="text-xs text-muted-foreground">
                Break taken:{" "}
                <span className="font-semibold text-foreground tabular-nums">{minutesToHm(breakMinutes)}</span> of {minutesToHm(BREAK_ALLOWANCE_MIN)}
                {breakMinutes < BREAK_ALLOWANCE_MIN ? ` · ${minutesToHm(BREAK_ALLOWANCE_MIN - breakMinutes)} left` : " · complete"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onBreak ? (
                <Button
                  className="bg-warning text-warning-foreground hover:bg-warning/90 gap-2"
                  onClick={handleEndBreak}
                  disabled={breakBusy}
                  data-testid="button-end-break"
                >
                  {endBreak.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Resume Work
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="border-warning/40 text-warning hover:bg-warning/10 gap-2"
                  onClick={handleStartBreak}
                  disabled={breakBusy}
                  data-testid="button-start-break"
                >
                  {startBreak.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coffee className="w-4 h-4" />}
                  Start Break
                </Button>
              )}
              <Button
                variant="outline"
                className="border-primary text-primary hover:bg-accent gap-2"
                onClick={handlePunchOut}
                disabled={punchOut.isPending}
                data-testid="button-punch-out"
              >
                {punchOut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Punch Out
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's hours — work/break blocks through the day */}
      {!todayLoading && todayRecord?.punchIn && (
        <Card className="border-border shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">Today's Hours</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your working hours from one block to the next — breaks don't count towards work time.
                </p>
              </div>
              <div className="flex gap-4 text-xs">
                <div className="text-muted-foreground">
                  Worked <span className="font-semibold text-foreground tabular-nums">{minutesToHm(workedMinutes)}</span>
                </div>
                <div className="text-muted-foreground">
                  Break <span className="font-semibold text-foreground tabular-nums">{minutesToHm(breakMinutes)}</span> / {minutesToHm(BREAK_ALLOWANCE_MIN)}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["From", "To", "Type", "Duration"].map((c) => (
                      <th key={c} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {timeline.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground text-sm">No activity yet.</td></tr>
                  ) : (
                    timeline.map((s, i) => (
                      <tr key={i} className="hover:bg-muted/50" data-testid={`row-timeline-${i}`}>
                        <td className="px-5 py-3 text-foreground tabular-nums">{formatTimeStr(s.from)}</td>
                        <td className="px-5 py-3 tabular-nums">
                          {s.ongoing ? <span className="text-muted-foreground">now</span> : <span className="text-foreground">{formatTimeStr(s.to)}</span>}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.type === "break" ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>
                            {s.type === "break" ? "Break" : "Working"}{s.ongoing ? " · ongoing" : ""}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground tabular-nums">{minutesToHm(minsBetween(s.from, s.to))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Summary Table */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {/* Table header row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">My Attendance Summary</h2>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={(v) => setFilterAndReset(() => setStatusFilter(v))}>
                <SelectTrigger className="w-36 text-sm border-border bg-card" data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="extra">Extra Hours</SelectItem>
                  <SelectItem value="half_day">Partial</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="weekend">Weekend</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 w-52 text-sm border-border bg-card"
                  placeholder="Search by date (e.g. 2026-01-01)"
                  value={searchDate}
                  onChange={(e) => setFilterAndReset(() => setSearchDate(e.target.value))}
                  data-testid="input-search-date"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {["Date", "Day", "Punch In", "Punch Out", "Total Worked", "Status", "Actions"].map((col) => (
                    <th key={col} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historyLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <Skeleton className="h-4 w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-muted-foreground text-sm">
                      No attendance records found.
                    </td>
                  </tr>
                ) : (
                  paged.map((record) => {
                    const isToday = record.date === TODAY;
                    const statusDisplay = getStatusDisplay(record);
                    return (
                      <tr key={record.id} className="hover:bg-muted/50 transition-colors" data-testid={`row-attendance-${record.id}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {format(parseISO(record.date), "MMM d, yyyy")}
                            </span>
                            {isToday && (
                              <span className="text-[10px] bg-accent text-primary px-2 py-0.5 rounded-full font-semibold">
                                Today
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">{getDayName(record.date)}</td>
                        <td className="px-5 py-3.5 text-foreground">
                          {record.punchIn ? formatTimeStr(record.punchIn) : <span className="text-muted-foreground">--</span>}
                        </td>
                        <td className="px-5 py-3.5 text-foreground">
                          {record.punchOut ? formatTimeStr(record.punchOut) : <span className="text-muted-foreground">--</span>}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-foreground tabular-nums">
                          {record.hoursWorked ? formatHoursWorked(record.hoursWorked) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusDisplay.cls}`}>
                            {statusDisplay.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 rounded-md hover:bg-accent/60 text-muted-foreground" data-testid={`button-actions-${record.id}`}>
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openCorrection(record.date)}
                                data-testid={`action-request-correction-${record.id}`}
                              >
                                <PencilLine className="w-4 h-4 mr-2" />
                                Request correction
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </CardContent>
      </Card>

      <TablePagination page={currentPage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />

      <RequestDialog
        type="attendance"
        open={attendanceReqOpen}
        onOpenChange={setAttendanceReqOpen}
      />
      <RequestDialog
        type="correction"
        open={correctionOpen}
        onOpenChange={setCorrectionOpen}
        defaultDate={correctionDate}
      />
    </motion.div>
  );
}
