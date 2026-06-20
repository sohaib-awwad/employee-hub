import {
  useCreateLeave,
  getListLeavesQueryKey,
  getGetLeaveBalanceQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
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
type LeaveValues = z.infer<typeof leaveSchema>;

// Pull the human-readable message the API returned (ApiError carries the parsed
// JSON body on `.data`), falling back to a generic line.
function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { data?: unknown } | null)?.data;
  const msg = data && typeof data === "object" ? (data as { error?: unknown }).error : undefined;
  return typeof msg === "string" && msg.trim() ? msg : fallback;
}

// Leave types offered when applying. Maternity is female-only and paternity
// male-only, so an employee never sees a leave type that doesn't apply to them.
export const LEAVE_TYPE_OPTIONS: { value: string; label: string; gender?: "male" | "female" }[] = [
  { value: "annual", label: "Annual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "casual", label: "Casual Leave" },
  { value: "maternity", label: "Maternity Leave", gender: "female" },
  { value: "paternity", label: "Paternity Leave", gender: "male" },
  { value: "unpaid", label: "Unpaid Leave" },
  { value: "other", label: "Other" },
];

interface LeaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// The shared "Request Leave" modal. Used by the Leave Requests page and the
// floating Quick Actions menu so both open the exact same form.
export function LeaveRequestDialog({ open, onOpenChange }: LeaveRequestDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const createLeave = useCreateLeave();

  // Only show leave types the employee is actually entitled to apply for.
  const leaveTypeOptions = LEAVE_TYPE_OPTIONS.filter((o) => !o.gender || o.gender === user?.gender);

  const form = useForm<LeaveValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { type: "annual", startDate: "", endDate: "", reason: "" },
  });

  const onSubmit = (values: LeaveValues) => {
    createLeave.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeaveBalanceQueryKey() });
        onOpenChange(false);
        form.reset();
        toast({ title: "Leave request submitted successfully" });
      },
      onError: (error) => {
        toast({
          title: "Couldn't submit leave request",
          description: apiErrorMessage(error, "Please try again."),
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={createLeave.isPending} data-testid="button-submit-leave">
                {createLeave.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Submit Request
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
