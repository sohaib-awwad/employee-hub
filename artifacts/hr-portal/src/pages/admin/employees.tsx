import { useState, useEffect, type MouseEvent } from "react";
import { useSearchParams } from "wouter";
import { useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useAdminListEmployees,
  getAdminListEmployeesQueryKey,
  useAdminCreateEmployee,
  useAdminUpdateEmployee,
  useAdminDeleteEmployee,
  getAdminGetOverviewQueryKey,
  type Employee,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/table-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Plus, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const PAGE_SIZE = 10;

const schema = z.object({
  name: z.string().min(1, "Required"),
  email: z.string().email("Valid email required"),
  department: z.string().min(1, "Required"),
  position: z.string().min(1, "Required"),
  joinDate: z.string().min(1, "Required"),
  gender: z.enum(["male", "female"], { errorMap: () => ({ message: "Required" }) }),
  role: z.enum(["employee", "admin"]),
  password: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function AdminEmployees() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const debouncedQ = useDebouncedValue(q.trim(), 300);

  useEffect(() => setPage(1), [debouncedQ]);

  const params = { q: debouncedQ || undefined, page, limit: PAGE_SIZE };
  const { data, isLoading } = useAdminListEmployees(params, {
    query: { queryKey: getAdminListEmployeesQueryKey(params), placeholderData: keepPreviousData },
  });
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const create = useAdminCreateEmployee();
  const update = useAdminUpdateEmployee();
  const remove = useAdminDeleteEmployee();
  const [searchParams, setSearchParams] = useSearchParams();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", department: "", position: "", joinDate: "", gender: undefined, role: "employee", password: "" },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getAdminListEmployeesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getAdminGetOverviewQueryKey() });
  };

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: "", email: "", department: "", position: "", joinDate: "", gender: undefined, role: "employee", password: "" });
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

  const openEdit = (e: Employee) => {
    setEditing(e);
    form.reset({ name: e.name, email: e.email, department: e.department, position: e.position, joinDate: e.joinDate, gender: e.gender ?? undefined, role: e.role, password: "" });
    setDialogOpen(true);
  };

  const onSubmit = (values: FormValues) => {
    if (!editing && (!values.password || values.password.length < 6)) {
      form.setError("password", { message: "At least 6 characters" });
      return;
    }
    const opts = {
      onSuccess: () => { refresh(); setDialogOpen(false); toast({ title: editing ? "Employee updated" : "Employee created" }); },
      onError: () => toast({ title: "Failed to save employee", variant: "destructive" }),
    };
    if (editing) {
      update.mutate({
        id: editing.id,
        data: {
          name: values.name,
          email: values.email,
          department: values.department,
          position: values.position,
          gender: values.gender,
          role: values.role,
          ...(values.password ? { password: values.password } : {}),
        },
      }, opts);
    } else {
      create.mutate({
        data: {
          name: values.name,
          email: values.email,
          department: values.department,
          position: values.position,
          joinDate: values.joinDate,
          gender: values.gender,
          role: values.role,
          password: values.password as string,
        },
      }, opts);
    }
  };

  const onDelete = (e: MouseEvent) => {
    e.preventDefault(); // keep the dialog open until the request resolves
    if (!deleting) return;
    remove.mutate({ id: deleting.id }, {
      onSuccess: () => { refresh(); setDeleting(null); toast({ title: "Employee deleted" }); },
      onError: () => toast({ title: "Failed to delete employee", variant: "destructive" }),
    });
  };

  const saving = create.isPending || update.isPending;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Add staff, edit details, and assign roles.</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2" onClick={openCreate} data-testid="button-new-employee">
          <Plus className="w-4 h-4" /> Add employee
        </Button>
      </div>

      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 border-border bg-card text-sm"
          placeholder="Search name, email, department…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="input-search"
        />
      </div>

      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Name", "Email", "Department", "Position", "Gender", "Role", "Actions"].map((c) => (
                  <th key={c} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>)}</tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">{total === 0 && !debouncedQ ? "No employees." : "No matching employees."}</td></tr>
              ) : (
                rows.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/50" data-testid={`row-employee-${e.id}`}>
                    <td className="px-5 py-3.5 font-medium text-foreground">{e.name}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{e.email}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{e.department}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{e.position}</td>
                    <td className="px-5 py-3.5 text-muted-foreground capitalize">{e.gender ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${e.role === "admin" ? "bg-accent text-primary" : "bg-muted text-muted-foreground"}`}>{e.role}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => openEdit(e)} data-testid={`button-edit-${e.id}`}><Pencil className="w-4 h-4" /></Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-danger hover:bg-danger/10 disabled:opacity-40"
                          onClick={() => setDeleting(e)}
                          disabled={e.id === user?.id}
                          title={e.id === user?.id ? "You can't delete your own account" : "Delete employee"}
                          data-testid={`button-delete-${e.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
          <DialogHeader><DialogTitle className="text-foreground">{editing ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} data-testid="input-name" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} data-testid="input-email" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="department" render={({ field }) => (
                  <FormItem><FormLabel>Department</FormLabel><FormControl><Input {...field} data-testid="input-department" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="position" render={({ field }) => (
                  <FormItem><FormLabel>Position</FormLabel><FormControl><Input {...field} data-testid="input-position" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="joinDate" render={({ field }) => (
                  <FormItem><FormLabel>Join date</FormLabel><FormControl><Input type="date" {...field} disabled={!!editing} data-testid="input-joindate" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-role"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="employee">Employee</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem><FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-gender"><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Determines whether maternity or paternity leave is offered.</p>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>{editing ? "New password (optional)" : "Password"}</FormLabel>
                  <FormControl><Input type="password" placeholder={editing ? "Leave blank to keep current" : ""} {...field} data-testid="input-password" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving} data-testid="button-save-employee">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}{editing ? "Save" : "Create"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the employee along with their leaves, requests, and
              attendance records. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              disabled={remove.isPending}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              data-testid="button-delete-confirm"
            >
              {remove.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
