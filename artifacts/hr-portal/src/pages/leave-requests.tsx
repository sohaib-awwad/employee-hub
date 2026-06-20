import { useState } from "react";
import { useListLeaves, getListLeavesQueryKey, useGetLeaveBalance, getGetLeaveBalanceQueryKey, useCreateLeave, useCancelLeave } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Plane, Thermometer, Coffee, Baby, Wallet, MoreHorizontal, Loader2, Heart } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const leaveSchema = z.object({
  type: z.enum(["annual", "sick", "casual", "maternity", "paternity", "unpaid", "other"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
});

// Pull the human-readable message the API returned (ApiError carries the parsed
// JSON body on `.data`), falling back to a generic line.
function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { data?: unknown } | null)?.data;
  const msg = data && typeof data === "object" ? (data as { error?: unknown }).error : undefined;
  return typeof msg === "string" && msg.trim() ? msg : fallback;
}

// Leave types offered when applying. Maternity is female-only and paternity
// male-only, so an employee never sees a leave type that doesn't apply to them.
const LEAVE_TYPE_OPTIONS: { value: string; label: string; gender?: "male" | "female" }[] = [
  { value: "annual", label: "Annual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "casual", label: "Casual Leave" },
  { value: "maternity", label: "Maternity Leave", gender: "female" },
  { value: "paternity", label: "Paternity Leave", gender: "male" },
  { value: "unpaid", label: "Unpaid Leave" },
  { value: "other", label: "Other" },
];

const LEAVE_TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string; barColor: string }> = {
  annual:    { label: "Annual Leave",    icon: <Plane className="w-5 h-5" />,          color: "text-info bg-info/15",        barColor: "bg-info" },
  sick:      { label: "Sick Leave",      icon: <Thermometer className="w-5 h-5" />,    color: "text-warning bg-warning/15",  barColor: "bg-warning" },
  casual:    { label: "Casual Leave",    icon: <Coffee className="w-5 h-5" />,         color: "text-success bg-success/15",  barColor: "bg-success" },
  maternity: { label: "Maternity Leave", icon: <Baby className="w-5 h-5" />,           color: "text-danger bg-danger/15",    barColor: "bg-danger" },
  paternity: { label: "Paternity Leave", icon: <Baby className="w-5 h-5" />,           color: "text-primary bg-primary/15",  barColor: "bg-primary" },
  unpaid:    { label: "Unpaid Leave",    icon: <Wallet className="w-5 h-5" />,         color: "text-muted-foreground bg-muted", barColor: "bg-muted-foreground/40" },
  other:     { label: "Other Leave",     icon: <MoreHorizontal className="w-5 h-5" />, color: "text-muted-foreground bg-muted", barColor: "bg-muted-foreground/40" },
};

const STATUS_STYLE: Record<string, string> = {
  approved:  "bg-success/15 text-success",
  pending:   "bg-warning/15 text-warning",
  rejected:  "bg-danger/15 text-danger",
  cancelled: "bg-muted text-muted-foreground",
};

const MAIN_TYPES = ["annual", "sick", "casual", "unpaid"];
const COMPANY_TYPES = ["maternity", "paternity", "other"];

export default function LeaveRequests() {
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Only show leave types the employee is actually entitled to apply for.
  const leaveTypeOptions = LEAVE_TYPE_OPTIONS.filter((o) => !o.gender || o.gender === user?.gender);

  const { data: balance, isLoading: balanceLoading } = useGetLeaveBalance({
    query: { queryKey: getGetLeaveBalanceQueryKey() }
  });

  const { data: leaves, isLoading: leavesLoading } = useListLeaves({
    query: { queryKey: getListLeavesQueryKey() }
  });

  const createLeave = useCreateLeave();
  const cancelLeave = useCancelLeave();

  const form = useForm<z.infer<typeof leaveSchema>>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { type: "annual", startDate: "", endDate: "", reason: "" },
  });

  const onSubmit = (values: z.infer<typeof leaveSchema>) => {
    createLeave.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeaveBalanceQueryKey() });
        setIsApplyOpen(false);
        form.reset();
        toast({ title: "Leave request submitted successfully" });
      },
      onError: (error) => {
        toast({
          title: "Couldn't submit leave request",
          description: apiErrorMessage(error, "Please try again."),
          variant: "destructive",
        });
      }
    });
  };

  const handleCancel = (id: number) => {
    cancelLeave.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeaveBalanceQueryKey() });
        toast({ title: "Leave request cancelled" });
      }
    });
  };

  const filteredLeaves = (leaves ?? []).filter((l) => {
    if (activeTab !== "all" && l.status !== activeTab) return false;
    if (typeFilter !== "all" && l.type !== typeFilter) return false;
    if (searchQuery && !l.type.includes(searchQuery.toLowerCase()) && !l.reason.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: leaves?.length ?? 0,
    pending: leaves?.filter(l => l.status === "pending").length ?? 0,
    approved: leaves?.filter(l => l.status === "approved").length ?? 0,
    rejected: leaves?.filter(l => l.status === "rejected").length ?? 0,
  };

  const mainDetails = balance?.details?.filter(d => MAIN_TYPES.includes(d.type)) ?? [];
  const companyDetails = balance?.details?.filter(d => COMPANY_TYPES.includes(d.type)) ?? [];

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
          <h1 className="text-2xl font-bold text-foreground">Leave Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your leave applications and track your balances.</p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 text-white gap-2 self-start sm:self-auto"
          onClick={() => setIsApplyOpen(true)}
          data-testid="button-request-leave"
        >
          <Plus className="w-4 h-4" />
          Request Leave
        </Button>
      </div>

      {/* Leave Balances */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <h2 className="text-sm font-semibold text-foreground">Leave Balances</h2>
        </div>
        {balanceLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mainDetails.map((d) => {
              const meta = LEAVE_TYPE_META[d.type];
              const pct = d.total > 0 ? (d.used / d.total) * 100 : 0;
              return (
                <Card key={d.type} className="border-border shadow-sm" data-testid={`card-leave-balance-${d.type}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta?.color ?? "text-gray-600 bg-gray-100"}`}>
                          {meta?.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{meta?.label ?? d.type}</p>
                          <p className="text-xs text-muted-foreground">{d.remaining} days remaining</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-primary">{d.remaining % 1 === 0 ? d.remaining : d.remaining.toFixed(2)}</span>
                        <span className="text-xs text-muted-foreground ml-1">/ {d.total}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-accent rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${meta?.barColor ?? "bg-primary"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>Used: {d.used}</span>
                      <span>Total Entitlement: {d.total}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Company Leave Balances */}
      {companyDetails.length > 0 && !balanceLoading && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <h2 className="text-sm font-semibold text-foreground">Company Leave Balances</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companyDetails.map((d) => {
              const meta = LEAVE_TYPE_META[d.type];
              const pct = d.total > 0 ? (d.used / d.total) * 100 : 0;
              return (
                <Card key={d.type} className="border-border shadow-sm" data-testid={`card-company-leave-balance-${d.type}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta?.color ?? "text-gray-600 bg-gray-100"}`}>
                          {meta?.icon ?? <Heart className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{meta?.label ?? d.type}</p>
                          <p className="text-xs text-muted-foreground">{d.remaining} days remaining</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-primary">{d.remaining}</span>
                        <span className="text-xs text-muted-foreground ml-1">/ {d.total}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-accent rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${meta?.barColor ?? "bg-primary"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>Used: {d.used}</span>
                      <span>Total Entitlement: {d.total}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Leave Request History */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="p-5 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">Leave Request History</h2>
              <div className="flex flex-wrap gap-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-36 text-sm border-border" data-testid="select-leave-type-filter">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {leaveTypeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 w-44 text-sm border-border"
                    placeholder="Search requests..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-leaves"
                  />
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mt-4 flex-wrap">
              {(["all", "pending", "approved", "rejected"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize flex items-center gap-1.5 ${
                    activeTab === tab
                      ? "bg-primary text-white"
                      : "bg-accent/60 text-muted-foreground hover:bg-accent hover:text-primary"
                  }`}
                  data-testid={`tab-leaves-${tab}`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeTab === tab ? "bg-white/20 text-white" : "bg-white text-muted-foreground"
                  }`}>
                    {counts[tab]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {["Leave Type", "Start Date", "End Date", "Days", "Status", ""].map((col, i) => (
                    <th key={i} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leavesLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                      ))}
                    </tr>
                  ))
                ) : filteredLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground text-sm">
                      No leave requests found.
                    </td>
                  </tr>
                ) : (
                  filteredLeaves.map((leave) => (
                    <tr key={leave.id} className="hover:bg-muted/50 transition-colors" data-testid={`row-leave-${leave.id}`}>
                      <td className="px-5 py-3.5 font-medium text-foreground capitalize">
                        {LEAVE_TYPE_META[leave.type]?.label ?? leave.type}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {format(parseISO(leave.startDate), "MMM d, yyyy")}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {format(parseISO(leave.endDate), "MMM d, yyyy")}
                      </td>
                      <td className="px-5 py-3.5 text-foreground font-medium">{leave.days}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[leave.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {leave.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {leave.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger hover:bg-danger/10 h-7 px-3 text-xs"
                            onClick={() => handleCancel(leave.id)}
                            disabled={cancelLeave.isPending}
                            data-testid={`button-cancel-leave-${leave.id}`}
                          >
                            {cancelLeave.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cancel"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Apply Leave Dialog */}
      <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Request Leave</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leave Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-leave-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leaveTypeOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-start-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-end-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="reason" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Please provide a reason..." className="resize-none" rows={3} {...field} data-testid="input-reason" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsApplyOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-white" disabled={createLeave.isPending} data-testid="button-submit-leave">
                  {createLeave.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Submit Request
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
