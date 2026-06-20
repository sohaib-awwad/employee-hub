import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetMyProfile,
  getGetMyProfileQueryKey,
  useListAnnouncements,
  getListAnnouncementsQueryKey,
} from "@workspace/api-client-react";
import { 
  LayoutDashboard, 
  Clock, 
  CalendarDays, 
  Bell,
  Menu,
  X,
  Sparkles,
  Plane,
  CalendarRange,
  Pencil,
  LogOut
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutConfirm } from "@/components/logout-confirm";

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/attendance", label: "Attendance", icon: Clock },
  { href: "/leave-requests", label: "Leave Requests", icon: CalendarDays },
  { href: "/announcements", label: "Announcements & Events", icon: Bell },
];

export default function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: profile, isLoading } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() }
  });

  // Unread announcement badge: counts announcements the user hasn't opened yet.
  // "Seen" state is the highest announcement id the user has viewed, stored
  // per-user in localStorage; opening the Announcements page marks everything
  // currently published as seen, which clears the badge.
  // Only the last 90 days, matching the Announcements page — so the badge can't
  // get stuck on an old announcement the page no longer shows.
  const annParams = { page: 1, limit: 20, maxAgeDays: 90 };
  const { data: annData } = useListAnnouncements(annParams, {
    query: { queryKey: getListAnnouncementsQueryKey(annParams) },
  });
  const announcements = annData?.items ?? [];
  const latestAnnouncementId = announcements.reduce((max, a) => Math.max(max, a.id), 0);

  const seenStorageKey = profile?.id ? `olive:announcements-seen:${profile.id}` : null;
  const [seenAnnouncementId, setSeenAnnouncementId] = useState(0);

  // Load the per-user "seen" marker once the profile (and so the key) is known.
  useEffect(() => {
    if (!seenStorageKey) return;
    const stored = Number(localStorage.getItem(seenStorageKey) ?? 0);
    setSeenAnnouncementId(Number.isFinite(stored) ? stored : 0);
  }, [seenStorageKey]);

  // Viewing the Announcements page marks everything currently published as seen.
  useEffect(() => {
    if (!seenStorageKey || location !== "/announcements" || latestAnnouncementId === 0) return;
    localStorage.setItem(seenStorageKey, String(latestAnnouncementId));
    setSeenAnnouncementId(latestAnnouncementId);
  }, [location, latestAnnouncementId, seenStorageKey]);

  const unreadAnnouncements = announcements.filter((a) => a.id > seenAnnouncementId).length;
  const unreadBadge = unreadAnnouncements > 9 ? "9+" : String(unreadAnnouncements);

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar-background border-r border-sidebar-border">
        {/* Logo — top padding matches the body content (md:p-8) so the wordmark
            and the page heading begin on the same line. */}
        <div className="px-6 pt-8 pb-4 flex items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="shrink-0 text-primary">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-4H7l5-8v4h4l-5 8z" fill="currentColor"/>
          </svg>
          <span className="font-bold text-xl tracking-tight text-foreground">Olive</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all relative ${
                  isActive
                    ? "bg-accent text-primary"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-md" />
                )}
                <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
                {item.label}
                {item.href === "/announcements" && unreadAnnouncements > 0 && (
                  <span
                    className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-xs font-semibold text-primary"
                    data-testid="nav-announcements-badge"
                  >
                    {unreadBadge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User + controls (mirrors the admin sidebar) */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                {profile?.avatarInitials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">
                {isLoading ? "…" : profile?.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {profile?.position}
              </p>
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-card border-b border-sidebar-border z-20">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="shrink-0 text-primary">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-4H7l5-8v4h4l-5 8z" fill="currentColor"/>
            </svg>
            <span className="font-bold text-lg text-foreground">Olive</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => setLocation("/announcements")}
              className="relative p-1.5 text-muted-foreground"
              data-testid="button-notifications-mobile"
            >
              <Bell className="w-5 h-5" />
              {unreadAnnouncements > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground border-2 border-card"
                  data-testid="nav-announcements-badge-mobile"
                >
                  {unreadBadge}
                </span>
              )}
            </button>
            <Button variant="ghost" size="icon" className="text-foreground" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </header>

        {/* Mobile Drawer Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute inset-0 top-[65px] bg-card z-10 p-4">
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link 
                    key={item.href} 
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all ${
                      isActive 
                        ? "bg-accent text-primary" 
                        : "text-muted-foreground hover:bg-accent/60"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
              <LogoutConfirm>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-muted-foreground hover:bg-accent/60 w-full"
                  data-testid="button-logout-mobile"
                >
                  <LogOut className="w-5 h-5" />
                  Log out
                </button>
              </LogoutConfirm>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          {children}
        </main>
        
        {/* Floating Quick Actions Button */}
        <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50">
          <Popover>
            <PopoverTrigger asChild>
              <Button className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl bg-primary hover:bg-primary/90 p-0">
                <Sparkles className="h-6 w-6 text-white" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2 rounded-xl border-border shadow-xl" sideOffset={16}>
              <div className="flex flex-col space-y-1">
                <Button variant="ghost" className="justify-start px-3 text-foreground hover:bg-accent/60 hover:text-primary" onClick={() => setLocation('/leave-requests')}>
                  <Plane className="mr-2 h-4 w-4" />
                  Apply Leave
                </Button>
                <Button variant="ghost" className="justify-start px-3 text-foreground hover:bg-accent/60 hover:text-primary" onClick={() => setLocation('/attendance')}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Request Correction
                </Button>
                <Button variant="ghost" className="justify-start px-3 text-foreground hover:bg-accent/60 hover:text-primary">
                  <CalendarRange className="mr-2 h-4 w-4" />
                  View Holidays
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-around px-2 py-2 pb-safe z-40">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex flex-col items-center justify-center p-2 min-w-[64px] ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-medium tracking-tight whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

      </div>
    </div>
  );
}
