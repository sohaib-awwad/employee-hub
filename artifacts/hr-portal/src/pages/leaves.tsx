import { useListLeaves, getListLeavesQueryKey, useGetLeaveBalance, getGetLeaveBalanceQueryKey, useCreateLeave, useCancelLeave } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const leaveSchema = z.object({
  type: z.enum(["annual", "sick", "casual", "maternity", "paternity", "unpaid", "other"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
});

export default function Leaves() {
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    defaultValues: {
      type: "annual",
      startDate: "",
      endDate: "",
      reason: "",
    },
  });

  const onSubmit = (values: z.infer<typeof leaveSchema>) => {
    createLeave.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeaveBalanceQueryKey() });
        setIsApplyOpen(false);
        form.reset();
        toast({ title: "Leave applied successfully" });
      },
      onError: () => {
        toast({ title: "Failed to apply leave", variant: "destructive" });
      }
    });
  };

  const handleCancel = (id: number) => {
    cancelLeave.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeaveBalanceQueryKey() });
        toast({ title: "Leave cancelled" });
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none shadow-none">Approved</Badge>;
      case 'pending': return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-none shadow-none">Pending</Badge>;
      case 'rejected': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-none shadow-none">Rejected</Badge>;
      case 'cancelled': return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100 border-none shadow-none">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leaves</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your time off</p>
        </div>
        
        <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
          <DialogTrigger asChild>
            <Button>Apply Leave</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leave Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="annual">Annual Leave</SelectItem>
                          <SelectItem value="sick">Sick Leave</SelectItem>
                          <SelectItem value="casual">Casual Leave</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Please provide a reason..." className="resize-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createLeave.isPending}>
                    {createLeave.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {balanceLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : balance ? (
          <>
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-primary">Available</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight text-primary">{balance.remaining}</span>
                  <span className="text-sm font-medium text-primary/80">days</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-500">Annual</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight">{balance.annual}</span>
                  <span className="text-sm text-gray-500">days</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-500">Sick</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight">{balance.sick}</span>
                  <span className="text-sm text-gray-500">days</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-500">Casual</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight">{balance.casual}</span>
                  <span className="text-sm text-gray-500">days</span>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* History */}
      <div className="pt-4">
        <h2 className="text-lg font-semibold mb-4">Request History</h2>
        <div className="space-y-3">
          {leavesLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)
          ) : leaves?.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-dashed text-gray-500">
              No leave requests found.
            </div>
          ) : (
            leaves?.map((leave) => (
              <Card key={leave.id} className="overflow-hidden border-gray-200/60 shadow-sm transition-all hover:shadow-md">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold capitalize text-gray-900 dark:text-gray-100">{leave.type} Leave</span>
                        {getStatusBadge(leave.status)}
                      </div>
                      <p className="text-sm text-gray-500">
                        {format(new Date(leave.startDate), "MMM d, yyyy")} - {format(new Date(leave.endDate), "MMM d, yyyy")} ({leave.days} days)
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm w-full sm:w-auto">
                      <div className="text-gray-600 italic truncate max-w-[200px] flex-1 sm:flex-initial">
                        "{leave.reason}"
                      </div>
                      {leave.status === 'pending' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
                          onClick={() => handleCancel(leave.id)}
                          disabled={cancelLeave.isPending}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
