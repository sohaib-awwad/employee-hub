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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

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
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar-background border-r border-sidebar-border">
        <div className="p-6 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl tracking-tight text-foreground">Olive Admin</span>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = isActive(location, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-[#EDE9FE] text-[#6C5CE7]"
                    : "text-[#6B7280] hover:bg-[#F4F3FF] hover:text-[#1A1A2E]"
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center justify-between px-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">Administrator</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout()}
              title="Log out"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header + nav */}
        <header className="md:hidden bg-white border-b border-sidebar-border">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="font-bold text-foreground">Olive Admin</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => logout()}
              data-testid="button-logout-mobile"
            >
              <LogOut className="w-4 h-4" /> Log out
            </Button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
            {NAV.map((item) => {
              const active = isActive(location, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium ${
                    active ? "bg-[#EDE9FE] text-[#6C5CE7]" : "text-[#6B7280]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
