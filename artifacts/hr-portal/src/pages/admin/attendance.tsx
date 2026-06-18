import {
  useAdminListAttendanceToday,
  getAdminListAttendanceTodayQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const STATUS_STYLE: Record<string, string> = {
  present: "bg-green-100 text-green-700",
  absent: "bg-red-100 text-red-700",
  half_day: "bg-amber-100 text-amber-700",
  on_leave: "bg-blue-100 text-blue-700",
  holiday: "bg-purple-100 text-purple-700",
  weekend: "bg-gray-100 text-gray-500",
};

const formatTime = (t?: string | null) => {
  if (!t) return "--";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
};

export default function AdminAttendance() {
  const { data, isLoading } = useAdminListAttendanceToday({
    query: { queryKey: getAdminListAttendanceTodayQueryKey() },
  });
  const rows = data ?? [];
  const present = rows.filter((r) => r.status === "present" || r.status === "half_day").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Attendance — {format(new Date(), "MMM d, yyyy")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {present} of {rows.length} present today.
        </p>
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
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>)}</tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">No employees.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.employeeId} className="hover:bg-muted/50" data-testid={`row-attendance-${r.employeeId}`}>
                    <td className="px-5 py-3.5 font-medium text-foreground">{r.employeeName}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{r.department ?? "—"}</td>
                    <td className="px-5 py-3.5 text-foreground">{formatTime(r.punchIn)}</td>
                    <td className="px-5 py-3.5 text-foreground">{formatTime(r.punchOut)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[r.status] ?? "bg-gray-100 text-gray-500"}`}>
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
    </div>
  );
}
