import { useState, useEffect } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import {
  useAdminListAttendanceToday,
  getAdminListAttendanceTodayQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/table-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import Attendance from "@/pages/attendance";
import { format } from "date-fns";
import { Search, ArrowUpDown } from "lucide-react";

const PAGE_SIZE = 10;

const STATUS_STYLE: Record<string, string> = {
  present: "bg-success/15 text-success",
  absent: "bg-danger/15 text-danger",
  half_day: "bg-warning/15 text-warning",
  on_leave: "bg-info/15 text-info",
  holiday: "bg-primary/15 text-primary",
  weekend: "bg-muted text-muted-foreground",
};

// Fixed set of filters — server-side paging means we no longer see every row,
// so we can't derive the tabs from the data.
const STATUS_TABS = ["all", "present", "absent", "half_day", "on_leave"] as const;

const formatTime = (t?: string | null) => {
  if (!t) return "--";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
};

type SortKey = "name" | "punchIn" | "status";

export default function AdminAttendance() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(1);
  const debouncedQ = useDebouncedValue(q.trim(), 300);

  // Any change to the filter, search, or sort resets us to the first page.
  useEffect(() => setPage(1), [tab, debouncedQ, sort]);

  const params = {
    status: tab === "all" ? undefined : tab,
    q: debouncedQ || undefined,
    sort,
    page,
    limit: PAGE_SIZE,
  };
  const { data, isLoading } = useAdminListAttendanceToday(params, {
    query: { queryKey: getAdminListAttendanceTodayQueryKey(params), placeholderData: keepPreviousData },
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const present = data?.presentToday ?? 0;
  const totalEmployees = data?.totalEmployees ?? 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your own attendance and the team's, for {format(new Date(), "MMM d, yyyy")}.
        </p>
      </div>

      {/* My Attendance — the admin is an employee too (punch in/out, breaks, hours). */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <h2 className="text-base font-semibold text-foreground">My Attendance</h2>
        </div>
        <Attendance embedded />
      </section>

      {/* Team overview */}
      <div className="flex items-center gap-2 pt-2">
        <div className="w-1 h-5 bg-primary rounded-full" />
        <h2 className="text-base font-semibold text-foreground">Team Attendance</h2>
        <span className="text-sm text-muted-foreground">· {present} of {totalEmployees} present today</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                tab === t ? "bg-primary text-primary-foreground" : "bg-accent/60 text-muted-foreground hover:bg-accent"
              }`}
              data-testid={`tab-${t}`}
            >
              {t === "all" ? "All" : t.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 border-border bg-card text-sm"
              placeholder="Search name, department…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-36 gap-2 border-border bg-card text-sm" data-testid="select-sort">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="punchIn">Punch in</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Employee", "Department", "Punch In", "Punch Out", "Status"].map((c) => (
                  <th key={c} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>)}</tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">{totalEmployees === 0 ? "No employees." : "No matching records."}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.employeeId} className="hover:bg-muted/50" data-testid={`row-attendance-${r.employeeId}`}>
                    <td className="px-5 py-3.5 font-medium text-foreground">{r.employeeName}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{r.department ?? "—"}</td>
                    <td className="px-5 py-3.5 text-foreground">{formatTime(r.punchIn)}</td>
                    <td className="px-5 py-3.5 text-foreground">{formatTime(r.punchOut)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[r.status] ?? "bg-muted text-muted-foreground"}`}>
                        {r.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
    </div>
  );
}
