import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  CalendarCheck,
  Inbox,
  Megaphone,
  Users,
  Clock,
  ShieldCheck,
  LogOut,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutConfirm } from "@/components/logout-confirm";
import { useAuth } from "@/lib/auth";
import { useAdminGetOverview, getAdminGetOverviewQueryKey } from "@workspace/api-client-react";

function initials(name?: string | null): string {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase();
}

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/leaves", label: "Leave Approvals", icon: CalendarCheck },
  { href: "/admin/requests", label: "Requests", icon: Inbox },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/employees", label: "Employees", icon: Users },
  { href: "/admin/attendance", label: "Attendance", icon: Clock },
];

function isActive(location: string, href: string): boolean {
  return href === "/admin" ? location === "/admin" : location.startsWith(href);
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: overview } = useAdminGetOverview({
    query: { queryKey: getAdminGetOverviewQueryKey() },
  });

  // Pending counts shown as badges next to the relevant nav items.
  const badgeFor = (href: string): number => {
    if (href === "/admin/leaves") return overview?.pendingLeaves ?? 0;
    if (href === "/admin/requests") return overview?.pendingRequests ?? 0;
    return 0;
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar-background border-r border-sidebar-border">
        {/* Logo — top padding matches the body content (md:p-8) so the wordmark
            and the page heading begin on the same line. */}
        <div className="px-6 pt-8 pb-4 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl tracking-tight text-foreground">Olive Admin</span>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = isActive(location, item.href);
            const badge = badgeFor(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all relative ${
                  active
                    ? "bg-accent text-primary"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-md" />
                )}
                <item.icon className={`w-5 h-5 ${active ? "text-primary" : ""}`} />
                {item.label}
                {badge > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-xs font-semibold text-primary">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                {initials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">Administrator</p>
            </div>
            <ThemeToggle />
            <LogoutConfirm>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Log out"
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </LogoutConfirm>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header + nav */}
        <header className="md:hidden bg-card border-b border-sidebar-border">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="font-bold text-foreground">Olive Admin</span>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <LogoutConfirm>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  data-testid="button-logout-mobile"
                >
                  <LogOut className="w-4 h-4" /> Log out
                </Button>
              </LogoutConfirm>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
            {NAV.map((item) => {
              const active = isActive(location, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium ${
                    active ? "bg-accent text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>

        {/* Floating quick actions (mirrors the employee dashboard) */}
        <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl bg-primary hover:bg-primary/90 p-0"
                data-testid="button-quick-actions"
              >
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-2 rounded-xl border-border shadow-xl" sideOffset={16}>
              <div className="flex flex-col space-y-1">
                <Button variant="ghost" className="justify-start px-3 text-foreground hover:bg-accent/60 hover:text-primary" onClick={() => setLocation("/admin/announcements?new=1")}>
                  <Megaphone className="mr-2 h-4 w-4" />
                  Post Announcement
                </Button>
                <Button variant="ghost" className="justify-start px-3 text-foreground hover:bg-accent/60 hover:text-primary" onClick={() => setLocation("/admin/leaves")}>
                  <CalendarCheck className="mr-2 h-4 w-4" />
                  Review Leave Approvals
                </Button>
                <Button variant="ghost" className="justify-start px-3 text-foreground hover:bg-accent/60 hover:text-primary" onClick={() => setLocation("/admin/requests")}>
                  <Inbox className="mr-2 h-4 w-4" />
                  View Pending Requests
                </Button>
                <Button variant="ghost" className="justify-start px-3 text-foreground hover:bg-accent/60 hover:text-primary" onClick={() => setLocation("/admin/employees?new=1")}>
                  <Users className="mr-2 h-4 w-4" />
                  Add Employee
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
