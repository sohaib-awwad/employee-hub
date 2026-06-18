import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useAdminListEmployees,
  getAdminListEmployeesQueryKey,
  useAdminCreateEmployee,
  useAdminUpdateEmployee,
  getAdminGetOverviewQueryKey,
  type Employee,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1, "Required"),
  email: z.string().email("Valid email required"),
  department: z.string().min(1, "Required"),
  position: z.string().min(1, "Required"),
  joinDate: z.string().min(1, "Required"),
  role: z.enum(["employee", "admin"]),
  password: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function AdminEmployees() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const { data: employees, isLoading } = useAdminListEmployees({
    query: { queryKey: getAdminListEmployeesQueryKey() },
  });
  const create = useAdminCreateEmployee();
  const update = useAdminUpdateEmployee();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", department: "", position: "", joinDate: "", role: "employee", password: "" },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getAdminListEmployeesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getAdminGetOverviewQueryKey() });
  };

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: "", email: "", department: "", position: "", joinDate: "", role: "employee", password: "" });
    setDialogOpen(true);
  };

  const openEdit = (e: Employee) => {
    setEditing(e);
    form.reset({ name: e.name, email: e.email, department: e.department, position: e.position, joinDate: e.joinDate, role: e.role, password: "" });
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
          department: values.department,
          position: values.position,
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
          role: values.role,
          password: values.password as string,
        },
      }, opts);
    }
  };

  const rows = employees ?? [];
  const saving = create.isPending || update.isPending;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Add staff, edit details, and assign roles.</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2" onClick={openCreate} data-testid="button-new-employee">
          <Plus className="w-4 h-4" /> Add employee
        </Button>
      </div>

      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Name", "Email", "Department", "Position", "Role", "Actions"].map((c) => (
                  <th key={c} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>)}</tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">No employees.</td></tr>
              ) : (
                rows.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/50" data-testid={`row-employee-${e.id}`}>
                    <td className="px-5 py-3.5 font-medium text-foreground">{e.name}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{e.email}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{e.department}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{e.position}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${e.role === "admin" ? "bg-accent text-primary" : "bg-gray-100 text-gray-600"}`}>{e.role}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => openEdit(e)} data-testid={`button-edit-${e.id}`}><Pencil className="w-4 h-4" /></Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-foreground">{editing ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} data-testid="input-name" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} disabled={!!editing} data-testid="input-email" /></FormControl><FormMessage /></FormItem>
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
    </div>
  );
}
