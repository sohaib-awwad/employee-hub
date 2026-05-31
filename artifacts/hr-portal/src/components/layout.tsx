import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { 
  LayoutDashboard, 
  Clock, 
  CalendarDays, 
  CalendarRange,
  Menu,
  X
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/attendance", label: "Attendance", icon: Clock },
  { href: "/leaves", label: "Leaves", icon: CalendarDays },
  { href: "/holidays", label: "Holidays", icon: CalendarRange },
];

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: profile, isLoading } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() }
  });

  return (
    <div className="flex h-screen bg-gray-50/50 dark:bg-gray-900/50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-white dark:bg-gray-950">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">
            HR
          </div>
          <span className="font-semibold text-lg tracking-tight text-gray-900 dark:text-gray-100">Portal</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t">
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
              <Avatar>
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {profile.avatarInitials}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {profile.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {profile.position}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden flex items-center justify-between p-4 border-b bg-white dark:bg-gray-950">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">
              HR
            </div>
            <span className="font-semibold text-lg">Portal</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </Button>
        </header>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-b bg-white dark:bg-gray-950 px-4 py-2 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location === item.href;
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
