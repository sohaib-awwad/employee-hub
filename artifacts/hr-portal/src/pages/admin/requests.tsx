import { useState, useEffect } from "react";
import { useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  useAdminListRequests,
  getAdminListRequestsQueryKey,
  useAdminRejectRequest,
  getAdminGetOverviewQueryKey,
} from "@workspace/api-client-react";
import { RequestApprovalDialog, type ApprovalRequest } from "@/components/request-approval-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/table-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { format, parseISO } from "date-fns";
import { Check, X, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-success/15 text-success",
  pending: "bg-warning/15 text-warning",
  rejected: "bg-danger/15 text-danger",
};

const TABS = ["pending", "all", "approved", "rejected"] as const;

export default function AdminRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [approving, setApproving] = useState<ApprovalRequest | null>(null);
  const debouncedQ = useDebouncedValue(q.trim(), 300);

  // Any change to the filter or search resets us to the first page.
  useEffect(() => setPage(1), [tab, debouncedQ]);

  const params = {
    status: tab === "all" ? undefined : tab,
    q: debouncedQ || undefined,
    page,
    limit: PAGE_SIZE,
  };
  const { data, isLoading } = useAdminListRequests(params, {
    query: { queryKey: getAdminListRequestsQueryKey(params), placeholderData: keepPreviousData },
  });
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const reject = useAdminRejectRequest();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getAdminListRequestsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getAdminGetOverviewQueryKey() });
  };

  const onReject = (id: number) =>
    reject.mutate({ id }, {
      onSuccess: () => { refresh(); toast({ title: "Request rejected" }); },
      onError: () => toast({ title: "Failed to reject", variant: "destructive" }),
    });

  const busyId = reject.isPending ? reject.variables?.id : undefined;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Requests</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Correction and attendance requests submitted by employees.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                tab === t ? "bg-primary text-primary-foreground" : "bg-accent/60 text-muted-foreground hover:bg-accent"
              }`}
              data-testid={`tab-${t}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 border-border bg-card text-sm"
            placeholder="Search name, type, reason…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="input-search"
          />
        </div>
      </div>

      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Employee", "Type", "Date", "Reason", "Status", "Actions"].map((c) => (
                  <th key={c} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>)}</tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">No {tab === "all" ? "" : tab} requests.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/50" data-testid={`row-request-${r.id}`}>
                    <td className="px-5 py-3.5 font-medium text-foreground">{r.employeeName ?? `#${r.employeeId}`}</td>
                    <td className="px-5 py-3.5 capitalize text-muted-foreground">{r.type}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{r.date ? format(parseISO(r.date), "MMM d, yyyy") : "—"}</td>
                    <td className="px-5 py-3.5 text-muted-foreground max-w-[260px] truncate" title={r.reason}>{r.reason}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {r.status === "pending" ? (
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 gap-1 bg-success text-success-foreground hover:bg-success/90" onClick={() => setApproving({ id: r.id, employeeName: r.employeeName, date: r.date, reason: r.reason })} disabled={busyId === r.id} data-testid={`button-approve-${r.id}`}>
                            <Check className="w-3 h-3" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-danger border-danger/30 hover:bg-danger/10" onClick={() => onReject(r.id)} disabled={busyId === r.id} data-testid={`button-reject-${r.id}`}>
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

      <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      <RequestApprovalDialog
        request={approving}
        open={approving !== null}
        onOpenChange={(o) => !o && setApproving(null)}
      />
    </div>
  );
}
