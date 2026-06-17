import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateRequest, getListRequestsQueryKey } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  date: z.string().optional(),
  reason: z.string().min(5, "Please provide at least 5 characters"),
});
type Values = z.infer<typeof schema>;

interface RequestDialogProps {
  type: "correction" | "attendance";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fills the date field (e.g. the attendance row the user clicked). */
  defaultDate?: string;
  title?: string;
}

// Shared dialog used by the dashboard and attendance pages to submit a
// correction or attendance request to the admin queue.
export function RequestDialog({
  type,
  open,
  onOpenChange,
  defaultDate,
  title,
}: RequestDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createRequest = useCreateRequest();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { date: defaultDate ?? "", reason: "" },
  });

  // Re-seed the form whenever the dialog (re)opens for a different row.
  useEffect(() => {
    if (open) form.reset({ date: defaultDate ?? "", reason: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate]);

  const onSubmit = (values: Values) => {
    createRequest.mutate(
      { data: { type, date: values.date || null, reason: values.reason } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
          toast({
            title:
              type === "correction"
                ? "Correction request submitted"
                : "Attendance request submitted",
          });
          onOpenChange(false);
          form.reset();
        },
        onError: () =>
          toast({ title: "Failed to submit request", variant: "destructive" }),
      },
    );
  };

  const heading =
    title ??
    (type === "correction" ? "Request Correction" : "Send Attendance Request");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{heading}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-2 space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Date{type === "attendance" ? " (optional)" : ""}
                  </FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-request-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Describe your request…"
                      className="resize-none"
                      {...field}
                      data-testid="input-request-reason"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={createRequest.isPending}
                data-testid="button-submit-request"
              >
                {createRequest.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Submit
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
