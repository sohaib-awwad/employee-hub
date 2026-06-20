import { useState, useEffect } from "react";
import { useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  useAdminListLeaves,
  getAdminListLeavesQueryKey,
  useAdminApproveLeave,
  useAdminRejectLeave,
  getAdminGetOverviewQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/table-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { format, parseISO } from "date-fns";
import { Check, X, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-success/15 text-success",
  pending: "bg-warning/15 text-warning",
  rejected: "bg-danger/15 text-danger",
  cancelled: "bg-muted text-muted-foreground",
};

const TABS = ["pending", "all", "approved", "rejected"] as const;

export default function AdminLeaves() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const debouncedQ = useDebouncedValue(q.trim(), 300);

  // Any change to the filter or search resets us to the first page.
  useEffect(() => setPage(1), [tab, debouncedQ]);

  const params = {
    status: tab === "all" ? undefined : tab,
    q: debouncedQ || undefined,
    page,
    limit: PAGE_SIZE,
  };
  const { data, isLoading } = useAdminListLeaves(params, {
    query: { queryKey: getAdminListLeavesQueryKey(params), placeholderData: keepPreviousData },
  });
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

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

  const busyId = approve.isPending ? approve.variables?.id : reject.isPending ? reject.variables?.id : undefined;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Leave Approvals</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Approve or reject leave requests — approved days update the employee's balance.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
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
                          <Button size="sm" className="h-7 gap-1 bg-success text-success-foreground hover:bg-success/90" onClick={() => onApprove(l.id)} disabled={busyId === l.id} data-testid={`button-approve-${l.id}`}>
                            {busyId === l.id && approve.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-danger border-danger/30 hover:bg-danger/10" onClick={() => onReject(l.id)} disabled={busyId === l.id} data-testid={`button-reject-${l.id}`}>
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
    </div>
  );
}
