import { Link } from "wouter";
import { useAdminGetOverview, getAdminGetOverviewQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarCheck, Inbox, Users, Megaphone, ChevronRight } from "lucide-react";

export default function AdminOverview() {
  const { data } = useAdminGetOverview({
    query: { queryKey: getAdminGetOverviewQueryKey() },
  });

  const cards = [
    { label: "Pending leave approvals", value: data?.pendingLeaves ?? 0, icon: CalendarCheck, href: "/admin/leaves", accent: "text-amber-600 bg-amber-100" },
    { label: "Pending requests", value: data?.pendingRequests ?? 0, icon: Inbox, href: "/admin/requests", accent: "text-blue-600 bg-blue-100" },
    { label: "Employees", value: data?.totalEmployees ?? 0, icon: Users, href: "/admin/employees", accent: "text-[#6C5CE7] bg-[#EDE9FE]" },
    { label: "Announcements", value: data?.totalAnnouncements ?? 0, icon: Megaphone, href: "/admin/announcements", accent: "text-green-600 bg-green-100" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Approvals, staff, and announcements at a glance.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} data-testid={`overview-card-${c.href.split("/").pop()}`}>
            <Card className="border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.accent}`}>
                  <c.icon className="w-5 h-5" />
                </div>
                <p className="text-3xl font-bold text-foreground mt-3">{c.value}</p>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  {c.label} <ChevronRight className="w-3.5 h-3.5" />
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
