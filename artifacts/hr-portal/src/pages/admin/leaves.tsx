import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminListLeaves,
  getAdminListLeavesQueryKey,
  useAdminApproveLeave,
  useAdminRejectLeave,
  getAdminGetOverviewQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const TABS = ["pending", "all", "approved", "rejected"] as const;

export default function AdminLeaves() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");

  const { data: leaves, isLoading } = useAdminListLeaves(undefined, {
    query: { queryKey: getAdminListLeavesQueryKey() },
  });
  const approve = useAdminApproveLeave();
  const reject = useAdminRejectLeave();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getAdminListLeavesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getAdminGetOverviewQueryKey() });
  };

  const onApprove = (id: number) =>
    approve.mutate({ id }, {
      onSuccess: () => { refresh(); toast({ title: "Leave approved" }); },
      onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
    });

  const onReject = (id: number) =>
    reject.mutate({ id }, {
      onSuccess: () => { refresh(); toast({ title: "Leave rejected" }); },
      onError: () => toast({ title: "Failed to reject", variant: "destructive" }),
    });

  const rows = (leaves ?? []).filter((l) => tab === "all" || l.status === tab);
  const busyId = approve.isPending ? approve.variables?.id : reject.isPending ? reject.variables?.id : undefined;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Leave Approvals</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Approve or reject leave requests — approved days update the employee's balance.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
              tab === t ? "bg-primary text-white" : "bg-accent/60 text-muted-foreground hover:bg-accent"
            }`}
            data-testid={`tab-${t}`}
          >
            {t}
          </button>
        ))}
      </div>

      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Employee", "Type", "Dates", "Days", "Reason", "Status", "Actions"].map((c) => (
                  <th key={c} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>)}</tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">No {tab === "all" ? "" : tab} leave requests.</td></tr>
              ) : (
                rows.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/50" data-testid={`row-leave-${l.id}`}>
                    <td className="px-5 py-3.5 font-medium text-foreground">{l.employeeName ?? "Unknown"}</td>
                    <td className="px-5 py-3.5 capitalize text-muted-foreground">{l.type}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {format(parseISO(l.startDate), "MMM d")} – {format(parseISO(l.endDate), "MMM d, yyyy")}
                    </td>
                    <td className="px-5 py-3.5 text-foreground">{l.days}</td>
                    <td className="px-5 py-3.5 text-muted-foreground max-w-[220px] truncate" title={l.reason}>{l.reason}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[l.status]}`}>{l.status}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {l.status === "pending" ? (
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => onApprove(l.id)} disabled={busyId === l.id} data-testid={`button-approve-${l.id}`}>
                            {busyId === l.id && approve.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => onReject(l.id)} disabled={busyId === l.id} data-testid={`button-reject-${l.id}`}>
                            <X className="w-3 h-3" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
