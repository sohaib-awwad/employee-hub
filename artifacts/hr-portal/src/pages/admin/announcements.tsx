import { useState, useEffect } from "react";
import { useSearchParams } from "wouter";
import { useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useListAnnouncements,
  getListAnnouncementsQueryKey,
  useAdminCreateAnnouncement,
  useAdminUpdateAnnouncement,
  useAdminDeleteAnnouncement,
  getAdminGetOverviewQueryKey,
  type AnnouncementItem,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/table-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { format, parseISO } from "date-fns";
import { Plus, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  title: z.string().min(1, "Required"),
  body: z.string().min(1, "Required"),
  category: z.string().min(1, "Required"),
  priority: z.enum(["low", "medium", "high"]),
  type: z.enum(["announcement", "event"]),
  publishedAt: z.string().min(1, "Required"),
});
type FormValues = z.infer<typeof schema>;

const PRIORITY_STYLE: Record<string, string> = {
  high: "bg-danger/15 text-danger",
  medium: "bg-info/15 text-info",
  low: "bg-muted text-muted-foreground",
};

const PAGE_SIZE = 10;

const TYPE_TABS = [
  { value: "all", label: "All" },
  { value: "announcement", label: "Announcements" },
  { value: "event", label: "Events" },
] as const;

export default function AdminAnnouncements() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementItem | null>(null);
  const [tab, setTab] = useState<(typeof TYPE_TABS)[number]["value"]>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const debouncedQ = useDebouncedValue(q.trim(), 300);

  // Any change to the type tab or search resets us to the first page.
  useEffect(() => setPage(1), [tab, debouncedQ]);

  const params = {
    type: tab === "all" ? undefined : tab,
    q: debouncedQ || undefined,
    page,
    limit: PAGE_SIZE,
  };
  const { data, isLoading } = useListAnnouncements(params, {
    query: { queryKey: getListAnnouncementsQueryKey(params), placeholderData: keepPreviousData },
  });
  const create = useAdminCreateAnnouncement();
  const update = useAdminUpdateAnnouncement();
  const remove = useAdminDeleteAnnouncement();
  const [searchParams, setSearchParams] = useSearchParams();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", body: "", category: "Company News", priority: "medium", type: "announcement", publishedAt: format(new Date(), "yyyy-MM-dd") },
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/announcements"),
    });
    queryClient.invalidateQueries({ queryKey: getAdminGetOverviewQueryKey() });
  };

  const openCreate = () => {
    setEditing(null);
    form.reset({ title: "", body: "", category: "Company News", priority: "medium", type: "announcement", publishedAt: format(new Date(), "yyyy-MM-dd") });
    setDialogOpen(true);
  };

  // Opened from the sidebar quick-actions popup (?new=1) — auto-open the dialog.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreate();
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const openEdit = (a: AnnouncementItem) => {
    setEditing(a);
    form.reset({ title: a.title, body: a.body, category: a.category, priority: a.priority, type: a.type, publishedAt: a.publishedAt.slice(0, 10) });
    setDialogOpen(true);
  };

  const onSubmit = (values: FormValues) => {
    const opts = {
      onSuccess: () => { refresh(); setDialogOpen(false); toast({ title: editing ? "Announcement updated" : "Announcement created" }); },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    };
    if (editing) update.mutate({ id: editing.id, data: values }, opts);
    else create.mutate({ data: values }, opts);
  };

  const onDelete = (a: AnnouncementItem) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    remove.mutate({ id: a.id }, {
      onSuccess: () => { refresh(); toast({ title: "Announcement deleted" }); },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const saving = create.isPending || update.isPending;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create, edit, and remove announcements and events.</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2" onClick={openCreate} data-testid="button-new-announcement">
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {TYPE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                tab === t.value ? "bg-primary text-primary-foreground" : "bg-accent/60 text-muted-foreground hover:bg-accent"
              }`}
              data-testid={`tab-${t.value}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 border-border bg-card text-sm"
            placeholder="Search title, category…"
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
                {["Title", "Type", "Category", "Priority", "Published", "Actions"].map((c) => (
                  <th key={c} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>)}</tr>
                ))
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">No announcements yet.</td></tr>
              ) : (
                items.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/50" data-testid={`row-announcement-${a.id}`}>
                    <td className="px-5 py-3.5 font-medium text-foreground max-w-[240px] truncate" title={a.title}>{a.title}</td>
                    <td className="px-5 py-3.5 capitalize text-muted-foreground">{a.type}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{a.category}</td>
                    <td className="px-5 py-3.5"><span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${PRIORITY_STYLE[a.priority]}`}>{a.priority}</span></td>
                    <td className="px-5 py-3.5 text-muted-foreground">{format(parseISO(a.publishedAt), "MMM d, yyyy")}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => openEdit(a)} data-testid={`button-edit-${a.id}`}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-danger hover:bg-danger/10" onClick={() => onDelete(a)} data-testid={`button-delete-${a.id}`}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-foreground">{editing ? "Edit Announcement" : "New Announcement"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} data-testid="input-title" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="body" render={({ field }) => (
                <FormItem><FormLabel>Body</FormLabel><FormControl><Textarea rows={3} className="resize-none" {...field} data-testid="input-body" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem><FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="announcement">Announcement</SelectItem><SelectItem value="event">Event</SelectItem></SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem><FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel><FormControl><Input {...field} data-testid="input-category" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="publishedAt" render={({ field }) => (
                  <FormItem><FormLabel>Published</FormLabel><FormControl><Input type="date" {...field} data-testid="input-published" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving} data-testid="button-save-announcement">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}{editing ? "Save" : "Create"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
