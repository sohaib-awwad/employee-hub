import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminApproveRequest,
  getAdminListRequestsQueryKey,
  getAdminGetOverviewQueryKey,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// The standard workday (minutes); anything beyond counts as overtime — matches
// the dashboard's 8h baseline and the "Extra Hours" status elsewhere.
const STANDARD_DAY_MIN = 8 * 60;

export interface ApprovalRequest {
  id: number;
  employeeName?: string | null;
  date?: string | null;
  reason: string;
}

interface RequestApprovalDialogProps {
  request: ApprovalRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { data?: unknown } | null)?.data;
  const msg = data && typeof data === "object" ? (data as { error?: unknown }).error : undefined;
  return typeof msg === "string" && msg.trim() ? msg : fallback;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hm = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const fmtDate = (iso: string) => {
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
};

/**
 * Shown when an admin approves a request: the admin sets the employee's work
 * window for the target day and sees the resulting total + overtime hours.
 * Confirming writes the corrected attendance and approves the request.
 */
export function RequestApprovalDialog({ request, open, onOpenChange }: RequestApprovalDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const approve = useAdminApproveRequest();

  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");

  // Re-seed the form whenever the dialog opens for a request.
  useEffect(() => {
    if (open && request) {
      setDate(request.date ?? "");
      setStart("09:00");
      setEnd("17:00");
    }
  }, [open, request]);

  const totalMin = toMin(end) - toMin(start);
  const validWindow = totalMin > 0;
  const overtimeMin = Math.max(0, totalMin - STANDARD_DAY_MIN);
  const error = !date
    ? "Pick the date to correct."
    : !validWindow
      ? "End time must be after the start time."
      : null;

  const handleApprove = () => {
    if (!request || error) return;
    approve.mutate(
      { id: request.id, data: { date, punchIn: start, punchOut: end } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListRequestsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getAdminGetOverviewQueryKey() });
          toast({ title: "Request approved", description: `Attendance set to ${hm(totalMin)} for ${fmtDate(date)}.` });
          onOpenChange(false);
        },
        onError: (e) =>
          toast({
            title: "Couldn't approve the request",
            description: apiErrorMessage(e, "Please try again."),
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Approve &amp; correct hours</DialogTitle>
          <DialogDescription>
            {request
              ? `Set ${request.employeeName ?? "the employee"}'s working hours for this day. Approving writes the corrected attendance record.`
              : "Set the corrected working hours."}
          </DialogDescription>
        </DialogHeader>

        {request && (
          <div className="space-y-4 mt-2">
            {/* Context */}
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium text-foreground">{request.employeeName ?? `#${request.id}`}</p>
              <p className="text-muted-foreground mt-0.5 italic">“{request.reason}”</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="ap-date" className="text-sm font-medium text-foreground">Date</label>
                <Input
                  id="ap-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  data-testid="input-approval-date"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ap-start" className="text-sm font-medium text-foreground">Start</label>
                <Input
                  id="ap-start"
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  data-testid="input-approval-start"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ap-end" className="text-sm font-medium text-foreground">End</label>
                <Input
                  id="ap-end"
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  data-testid="input-approval-end"
                />
              </div>
            </div>

            {/* Live totals */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-accent/50 p-3">
                <p className="text-xs text-muted-foreground">Total worked</p>
                <p className="text-lg font-bold text-foreground tabular-nums" data-testid="approval-total">
                  {validWindow ? hm(totalMin) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-accent/50 p-3">
                <p className="text-xs text-muted-foreground">Overtime (&gt; 8h)</p>
                <p className="text-lg font-bold text-primary tabular-nums" data-testid="approval-overtime">
                  {validWindow ? hm(overtimeMin) : "—"}
                </p>
              </div>
            </div>

            {error && <p className="text-sm text-danger" data-testid="approval-error">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={approve.isPending}>
                Close
              </Button>
              <Button
                type="button"
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                onClick={handleApprove}
                disabled={approve.isPending || !!error}
                data-testid="button-confirm-approval"
              >
                {approve.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Approve &amp; apply
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
