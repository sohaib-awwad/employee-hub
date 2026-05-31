import { useState } from "react";
import { useListAttendance, getListAttendanceQueryKey, useGetTodayAttendance, getGetTodayAttendanceQueryKey, usePunchIn, usePunchOut } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Search, MoreVertical, Loader2 } from "lucide-react";

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
  if (status === "weekend") return { label: "Weekend", cls: "bg-gray-100 text-gray-500" };
  if (status === "on_leave") return { label: "On Leave", cls: "bg-blue-100 text-blue-700" };
  if (status === "absent") return { label: "Absent", cls: "bg-red-100 text-red-700" };
  if (status === "half_day") return { label: "Partial", cls: "bg-amber-100 text-amber-700" };
  if (status === "holiday") return { label: "Holiday", cls: "bg-purple-100 text-purple-700" };
  if (hoursWorked && hoursWorked > 8) return { label: "Extra Hours", cls: "bg-[#EDE9FE] text-[#6C5CE7]" };
  return { label: "Present", cls: "bg-green-100 text-green-700" };
};

const TODAY = format(new Date(), "yyyy-MM-dd");

export default function Attendance() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchDate, setSearchDate] = useState("");

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
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Attendance</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Track your daily attendance, breaks, and work hours</p>
        </div>
        <Button className="bg-[#6C5CE7] hover:bg-[#5A4FCF] text-white gap-2 self-start sm:self-auto" data-testid="button-send-attendance-request">
          <Send className="w-4 h-4" />
          Send Attendance Request
        </Button>
      </div>

      {/* Punch in/out quick card if today not done */}
      {!todayLoading && todayRecord && !todayRecord.punchIn && (
        <Card className="border-[#E5E3F3] bg-[#F8F7FF]">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-[#1A1A2E]">You haven't punched in today yet.</p>
            <Button
              className="bg-[#6C5CE7] hover:bg-[#5A4FCF] text-white gap-2"
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
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-green-800">
              Punched in at {formatTimeStr(todayRecord.punchIn)} — remember to punch out before you leave.
            </p>
            <Button
              variant="outline"
              className="border-[#6C5CE7] text-[#6C5CE7] hover:bg-[#EDE9FE] gap-2"
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
      <Card className="border-[#E5E3F3] shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {/* Table header row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-[#E5E3F3]">
            <h2 className="text-base font-semibold text-[#1A1A2E]">My Attendance Summary</h2>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 text-sm border-[#E5E3F3] bg-white" data-testid="select-status-filter">
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
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                <Input
                  className="pl-8 w-52 text-sm border-[#E5E3F3] bg-white"
                  placeholder="Search by date (e.g. 2026-01-01)"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  data-testid="input-search-date"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E3F3] bg-[#FAFAFA]">
                  {["Date", "Day", "Punch In", "Punch Out", "Total Worked", "Status", "Actions"].map((col) => (
                    <th key={col} className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F3FF]">
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
                    <td colSpan={7} className="px-5 py-14 text-center text-[#6B7280] text-sm">
                      No attendance records found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((record) => {
                    const isToday = record.date === TODAY;
                    const statusDisplay = getStatusDisplay(record);
                    return (
                      <tr key={record.id} className="hover:bg-[#FAFAFA] transition-colors" data-testid={`row-attendance-${record.id}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[#1A1A2E]">
                              {format(parseISO(record.date), "MMM d, yyyy")}
                            </span>
                            {isToday && (
                              <span className="text-[10px] bg-[#EDE9FE] text-[#6C5CE7] px-2 py-0.5 rounded-full font-semibold">
                                Today
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-[#6B7280]">{getDayName(record.date)}</td>
                        <td className="px-5 py-3.5 text-[#1A1A2E]">
                          {record.punchIn ? formatTimeStr(record.punchIn) : <span className="text-[#9CA3AF]">--</span>}
                        </td>
                        <td className="px-5 py-3.5 text-[#1A1A2E]">
                          {record.punchOut ? formatTimeStr(record.punchOut) : <span className="text-[#9CA3AF]">--</span>}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-[#1A1A2E] tabular-nums">
                          {record.hoursWorked ? formatHoursWorked(record.hoursWorked) : <span className="text-[#9CA3AF]">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusDisplay.cls}`}>
                            {statusDisplay.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <button className="p-1 rounded-md hover:bg-[#F4F3FF] text-[#6B7280]" data-testid={`button-actions-${record.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {!historyLoading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-[#E5E3F3] text-xs text-[#6B7280]">
              Showing 1–{Math.min(filtered.length, 20)} of {filtered.length}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
