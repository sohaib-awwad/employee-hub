import { useState, useEffect } from "react";
import { useGetDashboard, getGetDashboardQueryKey, usePunchIn, usePunchOut, getGetTodayAttendanceQueryKey, getListAnnouncementsQueryKey, useListAnnouncements } from "@workspace/api-client-react";
import { RequestDialog } from "@/components/request-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, differenceInDays, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, MapPin, BarChart2, Briefcase, CalendarDays, Bell, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const formatTimeStr = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
};

const formatWorkedTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
};

function CircleProgress({ value, max, color, label, sublabel }: {
  value: number; max: number; color: string; label: string; sublabel: string;
}) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const dash = pct * circ;

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20 shrink-0">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" style={{ stroke: "hsl(var(--accent))" }} strokeWidth="8" />
          <circle
            cx="40" cy="40" r={r} fill="none" style={{ stroke: color }} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-foreground">{value % 1 === 0 ? value : value.toFixed(1)}</span>
        </div>
      </div>
      <div>
        <p className="font-semibold text-foreground text-sm">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const { data: dashboard, isLoading } = useGetDashboard({
    query: { queryKey: getGetDashboardQueryKey() }
  });

  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [annTab, setAnnTab] = useState<"Announcements" | "Events">("Announcements");
  const annParams = {
    type: (annTab === "Events" ? "event" : "announcement") as "announcement" | "event",
    page: 1,
    limit: 3,
  };
  const { data: annData } = useListAnnouncements(annParams, {
    query: { queryKey: getListAnnouncementsQueryKey(annParams) },
  });
  const tabItems = annData?.items ?? [];

  const punchIn = usePunchIn();
  const punchOut = usePunchOut();

  const handlePunchIn = () => {
    punchIn.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
      }
    });
  };

  const handlePunchOut = () => {
    punchOut.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="lg:col-span-2 h-64" />
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const { todayAttendance, leaveBalance, upcomingHolidays, weeklyHours, recentAnnouncements } = dashboard;

  // Calculate worked minutes
  let workedMinutes = 0;
  if (todayAttendance.punchIn && todayAttendance.punchOut) {
    const [ih, im] = todayAttendance.punchIn.split(":").map(Number);
    const [oh, om] = todayAttendance.punchOut.split(":").map(Number);
    workedMinutes = (oh * 60 + om) - (ih * 60 + im);
  } else if (todayAttendance.punchIn && !todayAttendance.punchOut) {
    const [ih, im] = todayAttendance.punchIn.split(":").map(Number);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    // Cap the live counter at the 12h limit — the server auto-punches-out then,
    // so the timer can't keep climbing if someone forgets to punch out.
    workedMinutes = Math.min(12 * 60, Math.max(0, nowMinutes - (ih * 60 + im)));
  }

  const standardDay = 8 * 60;
  const progressPct = Math.min((workedMinutes / standardDay) * 100, 100);
  const remainingMinutes = Math.max(0, standardDay - workedMinutes);
  const extraMinutes = Math.max(0, workedMinutes - standardDay);

  const hasPunchedIn = !!todayAttendance.punchIn;
  const hasPunchedOut = !!todayAttendance.punchOut;

  // Welcome header (mirrors the admin overview greeting).
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "there";
  const dateLabel = format(now, "EEEE · d MMMM yyyy");
  const greetingSub = !hasPunchedIn
    ? "You haven't clocked in yet — have a great day."
    : !hasPunchedOut
      ? "You're clocked in. Here's your day at a glance."
      : "You're all wrapped up for today. Nice work.";

  const weekTotal = weeklyHours.reduce((s, d) => s + d.hours, 0);
  const weekDays = weeklyHours.filter(d => d.hours > 0).length;
  const maxBar = Math.max(...weeklyHours.map(d => d.hours), 1);

  const annualDetail = leaveBalance.details?.find(d => d.type === "annual");
  const sickDetail = leaveBalance.details?.find(d => d.type === "sick");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 max-w-7xl mx-auto"
    >
      {/* Welcome header — mirrors the admin overview, without the action button */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">{dateLabel}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          {greetingFor(now.getHours())}, {firstName}
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">{greetingSub}</p>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today's Attendance — spans 2 cols */}
        <Card className="lg:col-span-2 border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarDays className="w-4 h-4 text-primary" />
                Today's Attendance
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                <span className={`flex items-center gap-1.5 font-medium text-xs px-2.5 py-1 rounded-full ${hasPunchedIn && !hasPunchedOut ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${hasPunchedIn && !hasPunchedOut ? "bg-success" : "bg-muted-foreground/50"}`} />
                  {hasPunchedOut ? "Punched Out" : hasPunchedIn ? "Punched In" : "Not Started"}
                </span>
              </div>
            </div>

            <div className="mb-1">
              <span className="text-4xl font-bold text-foreground tabular-nums">
                {formatWorkedTime(workedMinutes)}
              </span>
              <span className="ml-2 text-sm text-muted-foreground font-medium">worked today</span>
            </div>

            {hasPunchedIn && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <span>
                  {formatTimeStr(todayAttendance.punchIn!)}
                  {hasPunchedOut ? ` – ${formatTimeStr(todayAttendance.punchOut!)}` : " – Now"}
                </span>
              </div>
            )}

            {/* Progress bar */}
            <div className="h-2 bg-accent rounded-full mb-5 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                { label: "REMAINING", value: formatWorkedTime(remainingMinutes) },
                { label: "EXTRA HOURS", value: `+${formatWorkedTime(extraMinutes)}` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-accent/40 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                  <p className="text-sm font-bold text-foreground tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            {/* Action row */}
            <div className="flex items-center gap-4">
              {!hasPunchedIn ? (
                <Button
                  className="bg-primary hover:bg-primary/90 font-semibold px-6 gap-2"
                  onClick={handlePunchIn}
                  disabled={punchIn.isPending}
                  data-testid="button-punch-in"
                >
                  {punchIn.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  Punch In
                </Button>
              ) : !hasPunchedOut ? (
                <Button
                  variant="outline"
                  className="border-primary text-primary hover:bg-accent font-semibold px-6 gap-2"
                  onClick={handlePunchOut}
                  disabled={punchOut.isPending}
                  data-testid="button-punch-out"
                >
                  {punchOut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  Punch Out
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground font-medium">Day complete</span>
              )}
              <button
                onClick={() => setCorrectionOpen(true)}
                className="text-sm text-primary hover:underline font-medium"
                data-testid="button-request-correction"
              >
                Request Correction
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Right column — Weekly Hours + Leave Balance */}
        <div className="flex flex-col gap-5">
          {/* Weekly Work Hours */}
          <Card className="border-border shadow-sm flex-1">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <BarChart2 className="w-4 h-4 text-primary" />
                Weekly Work Hours
              </div>
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-2xl font-bold text-foreground">{weekTotal.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">hrs this week</span>
                <span className="text-sm font-semibold text-foreground ml-2">{weekDays}</span>
                <span className="text-xs text-muted-foreground">days worked</span>
              </div>
              <div className="flex items-end gap-1.5 h-16">
                {weeklyHours.map(({ day, hours }) => (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center" style={{ height: 44 }}>
                      <div
                        className="w-full max-w-[20px] rounded-t-sm bg-primary transition-all"
                        style={{ height: `${Math.round((hours / maxBar) * 44)}px`, opacity: hours > 0 ? 1 : 0.2 }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground font-medium">{day}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Leave Balance */}
          <Card className="border-border shadow-sm flex-1">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
                <Briefcase className="w-4 h-4 text-primary" />
                Leave Balance
              </div>
              <div className="space-y-4">
                {annualDetail && (
                  <CircleProgress
                    value={annualDetail.remaining}
                    max={annualDetail.total}
                    color="#F59E0B"
                    label="Annual Leave"
                    sublabel={`${annualDetail.used} / ${annualDetail.total} days`}
                  />
                )}
                {sickDetail && (
                  <CircleProgress
                    value={sickDetail.remaining}
                    max={sickDetail.total}
                    color="hsl(var(--primary))"
                    label="Sick Leave"
                    sublabel={`${sickDetail.used} / ${sickDetail.total} days`}
                  />
                )}
              </div>
              <Link href="/leave-requests">
                <Button className="w-full mt-4 bg-primary hover:bg-primary/90 text-sm font-semibold gap-2" data-testid="button-request-leave">
                  <ChevronRight className="w-4 h-4" />
                  Request Leave
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Upcoming Holidays */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
              <CalendarDays className="w-4 h-4 text-primary" />
              Upcoming Holidays
            </div>
            <div className="space-y-4">
              {upcomingHolidays.slice(0, 4).map((h) => {
                const date = parseISO(h.date);
                const daysLeft = differenceInDays(date, new Date());
                return (
                  <div key={h.id} className="flex items-start gap-4">
                    <div className="w-12 shrink-0 text-center rounded-xl bg-primary text-primary-foreground py-1.5">
                      <div className="text-[9px] font-semibold uppercase tracking-wide opacity-80">
                        {format(date, "MMM")}
                      </div>
                      <div className="text-lg font-bold leading-tight">{format(date, "d")}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{h.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {h.dayOfWeek}, {format(date, "MMMM d")}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-muted-foreground">In {daysLeft} days</span>
                        <span className="text-[10px] bg-accent/60 text-primary px-2 py-0.5 rounded-full font-medium capitalize">
                          {h.type}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {upcomingHolidays.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No upcoming holidays</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Announcements & Events */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Bell className="w-4 h-4 text-primary" />
                Announcements &amp; Events
              </div>
              <Link href="/announcements" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
                View All <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 border-b border-border mb-4">
              {(["Announcements", "Events"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAnnTab(tab)}
                  className={`px-4 pb-2 text-sm font-medium border-b-2 ${
                    annTab === tab
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`tab-${tab.toLowerCase()}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {tabItems.map((a) => (
                <div key={a.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/60 flex items-center justify-center shrink-0 mt-0.5">
                    <Bell className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{a.title}</p>
                      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded font-medium whitespace-nowrap ${
                        a.priority === "high" ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning"
                      }`}>
                        {a.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(parseISO(a.publishedAt), "MMM d")}
                    </p>
                  </div>
                </div>
              ))}
              {tabItems.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No {annTab.toLowerCase()} to show.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <RequestDialog
        type="correction"
        open={correctionOpen}
        onOpenChange={setCorrectionOpen}
        defaultDate={format(new Date(), "yyyy-MM-dd")}
      />
    </motion.div>
  );
}
