import { useEffect, useState } from "react";
import { adminGetEmployeeAttendanceReport, type Employee } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, FileText } from "lucide-react";
import { format, startOfMonth, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { downloadAttendanceReportPdf } from "@/lib/attendance-report-pdf";

interface AttendanceReportDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Pull the human-readable message the API returned (ApiError carries the parsed
// JSON body on `.data`), falling back to a generic line.
function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { data?: unknown } | null)?.data;
  const msg = data && typeof data === "object" ? (data as { error?: unknown }).error : undefined;
  return typeof msg === "string" && msg.trim() ? msg : fallback;
}

const todayStr = () => format(new Date(), "yyyy-MM-dd");
const fmt = (iso: string) => {
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
};

/**
 * Lets an admin pick a period and download a PDF attendance sheet for one
 * employee. The range is clamped to [joinDate, today] both here and on the
 * server. Defaults to the current month (clamped to the join date).
 */
export function AttendanceReportDialog({ employee, open, onOpenChange }: AttendanceReportDialogProps) {
  const { toast } = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const today = todayStr();
  const joinDate = employee?.joinDate ?? "";
  // The earliest selectable date is the employee's join date.
  const minDate = joinDate && joinDate > today ? today : joinDate;

  // Reset to sensible defaults whenever the dialog opens for an employee:
  // current month start (but never before they joined) through today.
  useEffect(() => {
    if (!open || !employee) return;
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const defaultFrom = monthStart < minDate ? minDate : monthStart;
    setFrom(defaultFrom > today ? today : defaultFrom);
    setTo(today);
    setError(null);
    setLoading(false);
  }, [open, employee, minDate, today]);

  const validate = (): string | null => {
    if (!from || !to) return "Please choose both a start and end date.";
    if (minDate && from < minDate) return `The start date can't be before ${employee?.name ?? "the employee"} joined (${fmt(minDate)}).`;
    if (to > today) return "The end date can't be in the future.";
    if (from > to) return "The start date must be on or before the end date.";
    return null;
  };

  const handleDownload = async () => {
    if (!employee) return;
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const report = await adminGetEmployeeAttendanceReport({ employeeId: employee.id, from, to });
      downloadAttendanceReportPdf(report);
      toast({ title: "Attendance sheet downloaded" });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Couldn't generate the attendance sheet",
        description: apiErrorMessage(err, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Attendance sheet</DialogTitle>
          <DialogDescription>
            {employee
              ? `Choose a period for ${employee.name}, then download the PDF report. The range must fall between their join date (${fmt(joinDate)}) and today.`
              : "Choose a reporting period."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="report-from" className="text-sm font-medium text-foreground">From</label>
              <Input
                id="report-from"
                type="date"
                value={from}
                min={minDate || undefined}
                max={to || today}
                onChange={(e) => { setFrom(e.target.value); setError(null); }}
                data-testid="input-report-from"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="report-to" className="text-sm font-medium text-foreground">To</label>
              <Input
                id="report-to"
                type="date"
                value={to}
                min={from || minDate || undefined}
                max={today}
                onChange={(e) => { setTo(e.target.value); setError(null); }}
                data-testid="input-report-to"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            The sheet covers working days, days worked, holidays (and whether they were recorded),
            and leave-balance consumption for the selected period.
          </p>

          {error && <p className="text-sm text-danger" data-testid="report-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              onClick={handleDownload}
              disabled={loading || !employee}
              data-testid="button-download-report"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
