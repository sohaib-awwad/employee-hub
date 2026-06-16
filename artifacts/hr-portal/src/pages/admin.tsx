import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, ShieldCheck } from "lucide-react";

// Phase 1 placeholder so the admin role has a landing page and the role-based
// redirect is real. Phase 4 fills this with the admin dashboard (leave
// approvals, announcements management, attendance overview, employee admin).
export default function AdminHome() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4 md:px-8">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground">Employee Hub — Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.name}</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => logout()}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-8 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-bold text-foreground">Admin dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Coming in Phase 4 — leave approvals, announcements management,
            attendance overview, and employee management.
          </p>
        </div>
      </main>
    </div>
  );
}
