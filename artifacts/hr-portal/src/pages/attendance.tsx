import { useState } from "react";
import { useListAttendance, getListAttendanceQueryKey, useGetTodayAttendance, getGetTodayAttendanceQueryKey, usePunchIn, usePunchOut } from "@workspace/api-client-react";
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
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Search, MoreVertical, Loader2, PencilLine, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;

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

export default function Attendance() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchDate, setSearchDate] = useState("");
  const [page, setPage] = useState(1);
  const [attendanceReqOpen, setAttendanceReqOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionDate, setCorrectionDate] = useState<string | undefined>(undefined);

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

  const handlePunchIn = () => {
    punchIn.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey(params) });
      }
    });
  };

  const handlePunchOut = () => {
    punchOut.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey(params) });
      }
    });
  };

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-6xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your daily attendance, breaks, and work hours</p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 text-white gap-2 self-start sm:self-auto"
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
              className="bg-primary hover:bg-primary/90 text-white gap-2"
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
        <Card className="border-success/30 bg-success/10">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-success">
              Punched in at {formatTimeStr(todayRecord.punchIn)} — remember to punch out before you leave.
            </p>
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

          {/* Footer with real pagination */}
          {!historyLoading && filtered.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
              <span>
                Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 border-border"
                    disabled={currentPage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="font-medium text-foreground">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 border-border"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
