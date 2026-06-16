import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
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
import { useAuth } from "@/lib/auth";

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/attendance", label: "Attendance", icon: Clock },
  { href: "/leave-requests", label: "Leave Requests", icon: CalendarDays },
  { href: "/announcements", label: "Announcements & Events", icon: Bell },
];

export default function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { logout } = useAuth();
  const { data: profile, isLoading } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() }
  });

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar-background border-r border-sidebar-border">
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-4H7l5-8v4h4l-5 8z" fill="#22C55E"/>
          </svg>
          <span className="font-bold text-xl tracking-tight text-[#1A1A2E]">Olive</span>
        </div>

        {/* User Profile Card */}
        <div className="px-4 pb-6">
          {isLoading ? (
             <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
                <div className="h-3 bg-gray-200 rounded animate-pulse w-32" />
              </div>
            </div>
          ) : profile ? (
            <div className="flex items-center gap-3 px-2">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/20 text-primary font-bold">
                  {profile.avatarInitials}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-[#1A1A2E] truncate">
                  {profile.name}
                </p>
                <p className="text-xs text-[#6B7280] truncate font-medium">
                  {profile.position}
                </p>
              </div>
            </div>
          ) : null}
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
                    ? "bg-[#EDE9FE] text-[#6C5CE7]" 
                    : "text-[#6B7280] hover:bg-[#F4F3FF] hover:text-[#1A1A2E]"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#6C5CE7] rounded-r-md" />
                )}
                <item.icon className={`w-5 h-5 ${isActive ? "text-[#6C5CE7]" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-end px-8 py-4 bg-background">
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-[#6B7280] hover:text-[#1A1A2E] transition-colors rounded-full hover:bg-white">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-background"></span>
            </button>
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                {profile?.avatarInitials}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-[#6B7280] hover:text-[#1A1A2E]"
              onClick={() => logout()}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </Button>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-sidebar-border z-20">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-4H7l5-8v4h4l-5 8z" fill="#22C55E"/>
            </svg>
            <span className="font-bold text-lg text-[#1A1A2E]">Olive</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-1.5 text-[#6B7280]">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <Button variant="ghost" size="icon" className="text-[#1A1A2E]" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </header>

        {/* Mobile Drawer Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute inset-0 top-[65px] bg-white z-10 p-4">
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
                        ? "bg-[#EDE9FE] text-[#6C5CE7]" 
                        : "text-[#6B7280] hover:bg-[#F4F3FF]"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={() => { setIsMobileMenuOpen(false); logout(); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-[#6B7280] hover:bg-[#F4F3FF] w-full"
                data-testid="button-logout-mobile"
              >
                <LogOut className="w-5 h-5" />
                Log out
              </button>
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
              <Button className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl bg-[#6C5CE7] hover:bg-[#5A4FCF] p-0">
                <Sparkles className="h-6 w-6 text-white" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2 rounded-xl border-[#E5E3F3] shadow-xl" sideOffset={16}>
              <div className="flex flex-col space-y-1">
                <Button variant="ghost" className="justify-start px-3 text-[#1A1A2E] hover:bg-[#F4F3FF] hover:text-[#6C5CE7]" onClick={() => setLocation('/leave-requests')}>
                  <Plane className="mr-2 h-4 w-4" />
                  Apply Leave
                </Button>
                <Button variant="ghost" className="justify-start px-3 text-[#1A1A2E] hover:bg-[#F4F3FF] hover:text-[#6C5CE7]" onClick={() => setLocation('/attendance')}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Request Correction
                </Button>
                <Button variant="ghost" className="justify-start px-3 text-[#1A1A2E] hover:bg-[#F4F3FF] hover:text-[#6C5CE7]">
                  <CalendarRange className="mr-2 h-4 w-4" />
                  View Holidays
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E3F3] flex items-center justify-around px-2 py-2 pb-safe z-40">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex flex-col items-center justify-center p-2 min-w-[64px] ${
                  isActive ? "text-[#6C5CE7]" : "text-[#6B7280]"
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
