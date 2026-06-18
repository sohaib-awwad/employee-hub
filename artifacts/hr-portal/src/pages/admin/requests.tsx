import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminListRequests,
  getAdminListRequestsQueryKey,
  useAdminApproveRequest,
  useAdminRejectRequest,
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
};

const TABS = ["pending", "all", "approved", "rejected"] as const;

export default function AdminRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");

  const { data: requests, isLoading } = useAdminListRequests(undefined, {
    query: { queryKey: getAdminListRequestsQueryKey() },
  });
  const approve = useAdminApproveRequest();
  const reject = useAdminRejectRequest();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getAdminListRequestsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getAdminGetOverviewQueryKey() });
  };

  const onApprove = (id: number) =>
    approve.mutate({ id }, {
      onSuccess: () => { refresh(); toast({ title: "Request approved" }); },
      onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
    });

  const onReject = (id: number) =>
    reject.mutate({ id }, {
      onSuccess: () => { refresh(); toast({ title: "Request rejected" }); },
      onError: () => toast({ title: "Failed to reject", variant: "destructive" }),
    });

  const rows = (requests ?? []).filter((r) => tab === "all" || r.status === tab);
  const busyId = approve.isPending ? approve.variables?.id : reject.isPending ? reject.variables?.id : undefined;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Requests</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Correction and attendance requests submitted by employees.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
              tab === t ? "bg-[#6C5CE7] text-white" : "bg-[#F4F3FF] text-[#6B7280] hover:bg-[#EDE9FE]"
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
              <tr className="border-b border-border bg-[#FAFAFA]">
                {["Employee", "Type", "Date", "Reason", "Status", "Actions"].map((c) => (
                  <th key={c} className="px-5 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F3FF]">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>)}</tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">No {tab === "all" ? "" : tab} requests.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-[#FAFAFA]" data-testid={`row-request-${r.id}`}>
                    <td className="px-5 py-3.5 font-medium text-foreground">{r.employeeName ?? `#${r.employeeId}`}</td>
                    <td className="px-5 py-3.5 capitalize text-[#6B7280]">{r.type}</td>
                    <td className="px-5 py-3.5 text-[#6B7280]">{r.date ? format(parseISO(r.date), "MMM d, yyyy") : "—"}</td>
                    <td className="px-5 py-3.5 text-[#6B7280] max-w-[260px] truncate" title={r.reason}>{r.reason}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {r.status === "pending" ? (
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => onApprove(r.id)} disabled={busyId === r.id} data-testid={`button-approve-${r.id}`}>
                            {busyId === r.id && approve.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => onReject(r.id)} disabled={busyId === r.id} data-testid={`button-reject-${r.id}`}>
                            <X className="w-3 h-3" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-[#9CA3AF]">—</span>
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
