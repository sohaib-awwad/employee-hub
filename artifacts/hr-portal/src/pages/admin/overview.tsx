import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminGetOverview,
  getAdminGetOverviewQueryKey,
  useAdminApproveLeave,
  useAdminRejectLeave,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  format,
  parseISO,
  differenceInCalendarDays,
} from "date-fns";
import {
  CheckCircle2,
  Inbox,
  UserCheck,
  Users,
  Check,
  X,
  Plus,
  Megaphone,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------- helpers
const todayStr = format(new Date(), "yyyy-MM-dd");

function initials(name?: string | null): string {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase();
}

// Cycle the semantic tints for avatars (olive / blue / tan), like the export.
const AVATAR_TINTS = [
  "bg-primary/15 text-primary",
  "bg-info/15 text-info",
  "bg-warning/15 text-warning",
];
const avatarTint = (seed: number) => AVATAR_TINTS[Math.abs(seed) % AVATAR_TINTS.length];

const leaveTagClass = (type: string) =>
  type.toLowerCase() === "sick" ? "bg-info/15 text-info" : "bg-primary/15 text-primary";

function relDay(iso: string): string {
  const diff = differenceInCalendarDays(new Date(), parseISO(iso));
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  return format(parseISO(iso), "MMM d");
}

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Avatar({ name, seed, className = "h-10 w-10 text-sm" }: { name?: string | null; seed: number; className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-bold ${avatarTint(seed)} ${className}`}>
      {initials(name)}
    </span>
  );
}

// ----------------------------------------------------------------- screen
export default function AdminOverview() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: overview } = useAdminGetOverview({ query: { queryKey: getAdminGetOverviewQueryKey() } });

  const approve = useAdminApproveLeave();
  const reject = useAdminRejectLeave();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getAdminGetOverviewQueryKey() });
  };
  const onApprove = (id: number) => approve.mutate({ id }, { onSuccess: refresh });
  const onReject = (id: number) => reject.mutate({ id }, { onSuccess: refresh });
  const busyId = approve.isPending ? approve.variables?.id : reject.isPending ? reject.variables?.id : undefined;

  // --- derived data (a single aggregate call now feeds the whole screen) ---
  const now = new Date();
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "there";
  const dateLabel = format(now, "EEEE · d MMMM yyyy");

  const pendingLeaves = overview?.pendingLeaves ?? 0;
  const pendingRequests = overview?.pendingRequests ?? 0;
  const totalEmployees = overview?.totalEmployees ?? 0;

  const pendingLeaveRows = overview?.pendingLeaveItems ?? [];
  const recentRequestRows = (overview?.recentRequests ?? []).slice(0, 3);
  const outToday = overview?.outToday ?? [];

  const inOffice = overview?.presentToday ?? 0;
  const onLeaveCount = overview?.onLeaveToday ?? 0;
  const headTotal = totalEmployees;
  const notClockedIn = overview?.notClockedIn ?? 0;
  const remote = 0; // not tracked by the API yet

  const joinedThisMonth = overview?.joinedThisMonth ?? 0;

  const latest = overview?.latestAnnouncement ?? undefined;

  const ATT_SEGMENTS = [
    { label: "In office", value: inOffice, bar: "bg-success", dot: "bg-success" },
    { label: "Remote", value: remote, bar: "bg-info", dot: "bg-info" },
    { label: "On leave", value: onLeaveCount, bar: "bg-warning", dot: "bg-warning" },
    { label: "Not clocked in", value: notClockedIn, bar: "bg-muted-foreground/30", dot: "bg-muted-foreground/30" },
  ];
  const attTotal = ATT_SEGMENTS.reduce((s, x) => s + x.value, 0) || 1;
  const gradient = "linear-gradient(160deg, hsl(var(--primary) / 0.16) 0%, hsl(var(--card)) 60%)";

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">{dateLabel}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {greetingFor(now.getHours())}, {firstName}
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            You have <span className="font-semibold text-accent-foreground">{pendingLeaves} approval{pendingLeaves === 1 ? "" : "s"}</span>{" "}
            and <span className="font-semibold text-accent-foreground">{pendingRequests} request{pendingRequests === 1 ? "" : "s"}</span> waiting on you.
          </p>
        </div>
        <Button
          className="h-10 gap-2 self-start bg-primary text-primary-foreground hover:bg-primary/90 sm:self-auto"
          onClick={() => setLocation("/admin/announcements?new=1")}
          data-testid="button-new-announcement"
        >
          <Plus className="h-4 w-4" /> New announcement
        </Button>
      </div>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending approvals" icon={CheckCircle2} tone="text-primary" value={pendingLeaves} sub="needs action" subTone="text-primary" gradient href="/admin/leaves" onNav={setLocation} />
        <StatCard label="Open requests" icon={Inbox} tone="text-info" value={pendingRequests} sub={`${pendingRequests} awaiting review`} href="/admin/requests" onNav={setLocation} />
        <StatCard label="Present today" icon={UserCheck} tone="text-success" value={`${inOffice}`} suffix={`/ ${headTotal}`} progress={headTotal ? inOffice / headTotal : 0} href="/admin/attendance" onNav={setLocation} />
        <StatCard label="Headcount" icon={Users} tone="text-warning" value={totalEmployees} sub={`+${joinedThisMonth} this month`} subTone="text-success" href="/admin/employees" onNav={setLocation} />
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* LEFT */}
        <div className="flex flex-col gap-5">
          {/* Leave approvals */}
          <Card className="overflow-hidden border-border transition-all duration-200 hover:border-primary/25 hover:shadow-md">
            <div className="flex items-center justify-between px-5 py-[18px]">
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-base font-semibold text-foreground">Leave approvals</h2>
                {pendingLeaveRows.length > 0 && (
                  <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-primary/15 px-1.5 text-xs font-bold text-primary">{pendingLeaveRows.length}</span>
                )}
              </div>
              <button onClick={() => setLocation("/admin/leaves")} className="text-[13px] font-semibold text-muted-foreground hover:text-accent-foreground">View all</button>
            </div>

            {pendingLeaveRows.slice(0, 3).map((l, i) => (
              <div key={l.id} className="flex items-center gap-3.5 border-t border-border/70 px-5 py-3.5" data-testid={`overview-leave-${l.id}`}>
                <Avatar name={l.employeeName} seed={i} className="h-[42px] w-[42px] text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14.5px] font-semibold text-foreground">{l.employeeName ?? "Unknown"}</span>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${leaveTagClass(l.type)}`}>{l.type}</span>
                  </div>
                  <div className="mt-0.5 text-[13px] text-muted-foreground">
                    {format(parseISO(l.startDate), "MMM d")} – {format(parseISO(l.endDate), "MMM d")} · {l.days} day{l.days === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => onReject(l.id)} disabled={busyId === l.id} title="Decline" data-testid={`overview-reject-${l.id}`}
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-border bg-secondary text-muted-foreground transition-colors hover:border-danger/50 hover:text-danger disabled:opacity-50">
                    <X className="h-[15px] w-[15px]" />
                  </button>
                  <button onClick={() => onApprove(l.id)} disabled={busyId === l.id} data-testid={`overview-approve-${l.id}`}
                    className="flex h-[34px] items-center gap-1.5 rounded-[9px] bg-primary px-3.5 text-[13px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
                    {busyId === l.id && approve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                  </button>
                </div>
              </div>
            ))}

            {pendingLeaveRows.length === 0 && (
              <div className="border-t border-border/70 px-5 py-9 text-center">
                <div className="mx-auto mb-3 flex h-[46px] w-[46px] items-center justify-center rounded-full bg-primary/15">
                  <Check className="h-5.5 w-5.5 text-primary" />
                </div>
                <div className="font-display text-[15px] font-semibold text-foreground">All caught up</div>
                <div className="mt-1 text-[13px] text-muted-foreground">No leave requests waiting on you.</div>
              </div>
            )}
          </Card>

          {/* Recent requests */}
          <Card className="border-border transition-all duration-200 hover:border-primary/25 hover:shadow-md">
            <CardContent className="px-5 py-[18px]">
              <div className="mb-1.5 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-foreground">Recent requests</h2>
                <button onClick={() => setLocation("/admin/requests")} className="text-[13px] font-semibold text-muted-foreground hover:text-accent-foreground">View all</button>
              </div>
              {recentRequestRows.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No requests yet.</p>
              )}
              {recentRequestRows.map((r) => (
                <div key={r.id} className="flex items-center gap-3.5 border-b border-border/70 py-3.5 last:border-b-0" data-testid={`overview-request-${r.id}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-secondary text-info">
                    <Inbox className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">{r.reason}</div>
                    <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                      {r.employeeName ?? `#${r.employeeId}`} · <span className="capitalize">{r.type}</span> · {relDay(r.createdAt)}
                    </div>
                  </div>
                  <RequestStatus status={r.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-5">
          {/* Out today */}
          <Card className="border-border transition-all duration-200 hover:border-primary/25 hover:shadow-md">
            <CardContent className="px-5 py-[18px]">
              <div className="mb-3.5 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-foreground">Out today</h2>
                <span className="text-xs font-semibold text-muted-foreground">{outToday.length} {outToday.length === 1 ? "person" : "people"}</span>
              </div>
              {outToday.length === 0 && (
                <p className="py-3 text-center text-sm text-muted-foreground">Everyone's in today.</p>
              )}
              {outToday.map((l, i) => (
                <div key={l.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={l.employeeName} seed={i + 1} className="h-9 w-9 text-[13px]" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-foreground">{l.employeeName ?? "Unknown"}</div>
                    <div className="text-xs capitalize text-muted-foreground">{l.type} leave</div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[11.5px] font-medium text-muted-foreground">
                    {l.endDate === todayStr ? "today" : `until ${format(parseISO(l.endDate), "MMM d")}`}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Attendance */}
          <Card className="border-border transition-all duration-200 hover:border-primary/25 hover:shadow-md">
            <CardContent className="px-5 py-[18px]">
              <h2 className="mb-4 font-display text-base font-semibold text-foreground">Attendance</h2>
              <div className="mb-4 flex h-3 gap-0.5 overflow-hidden rounded-md">
                {ATT_SEGMENTS.map((s) => (s.value > 0 ? (
                  <div key={s.label} className={s.bar} style={{ flexGrow: s.value }} title={`${s.label}: ${s.value}`} />
                ) : null))}
              </div>
              <div className="flex flex-col gap-2.5">
                {ATT_SEGMENTS.map((s) => (
                  <div key={s.label} className="flex items-center gap-2.5 text-[13px] font-medium text-secondary-foreground">
                    <span className={`h-2.5 w-2.5 rounded-[3px] ${s.dot}`} />
                    {s.label}
                    <span className="ml-auto font-semibold text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Latest announcement */}
          <Card className="border-primary/30 transition-all duration-200 hover:border-primary/50 hover:shadow-md" style={{ background: gradient }}>
            <CardContent className="px-5 py-[18px]">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20">
                  <Megaphone className="h-[15px] w-[15px] text-primary" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">Latest announcement</span>
              </div>
              {latest ? (
                <>
                  <h3 className="mb-1.5 font-display text-base font-semibold text-foreground">{latest.title}</h3>
                  <p className="mb-3.5 text-[13.5px] leading-relaxed text-muted-foreground">{latest.body}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs capitalize text-muted-foreground">{latest.category} · {relDay(latest.publishedAt)}</span>
                    <button onClick={() => setLocation("/admin/announcements")} className="text-[13px] font-semibold text-accent-foreground hover:underline" data-testid="overview-read-announcement">Read</button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No announcements yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- sub-views
function StatCard({
  label, icon: Icon, tone, value, suffix, sub, subTone, progress, gradient, href, onNav,
}: {
  label: string;
  icon: typeof CheckCircle2;
  tone: string;
  value: number | string;
  suffix?: string;
  sub?: string;
  subTone?: string;
  progress?: number;
  gradient?: boolean;
  href: string;
  onNav: (to: string) => void;
}) {
  return (
    <Card
      onClick={() => onNav(href)}
      data-testid={`stat-${href.split("/").pop()}`}
      className={`cursor-pointer rounded-[14px] border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${gradient ? "border-primary/30 hover:border-primary/50" : "border-border hover:border-primary/40"}`}
      style={gradient ? { background: "linear-gradient(160deg, hsl(var(--primary) / 0.16) 0%, hsl(var(--card)) 60%)" } : undefined}
    >
      <CardContent className="p-[18px]">
        <div className="mb-3.5 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
          <span className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg ${gradient ? "bg-primary/15" : "bg-secondary"}`}>
            <Icon className={`h-4 w-4 ${tone}`} />
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-[32px] font-bold leading-none text-foreground">{value}</span>
          {suffix && <span className="text-[13px] font-medium text-muted-foreground">{suffix}</span>}
          {sub && <span className={`text-xs font-medium ${subTone ?? "text-muted-foreground"}`}>{sub}</span>}
        </div>
        {progress != null && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const REQ_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "New", cls: "bg-primary/15 text-primary" },
  approved: { label: "Approved", cls: "bg-success/15 text-success" },
  rejected: { label: "Rejected", cls: "bg-danger/15 text-danger" },
};

function RequestStatus({ status }: { status: string }) {
  const s = REQ_STATUS[status] ?? { label: status, cls: "bg-secondary text-muted-foreground" };
  return <span className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>;
}
