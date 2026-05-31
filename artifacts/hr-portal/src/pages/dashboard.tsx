import { useGetDashboard, getGetDashboardQueryKey, usePunchIn, usePunchOut, getGetTodayAttendanceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Clock, CheckCircle2, AlertCircle, Calendar as CalendarIcon, Briefcase } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: dashboard, isLoading } = useGetDashboard({
    query: { queryKey: getGetDashboardQueryKey() }
  });

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
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-6xl mx-auto"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Good morning, {dashboard.employee.name.split(' ')[0]}
        </h1>
        <p className="text-gray-500 mt-1">{format(new Date(), "EEEE, MMMM do, yyyy")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Punch Status Card */}
        <Card className="col-span-1 shadow-sm border-gray-200/60 dark:border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center text-gray-600 dark:text-gray-400">
              <Clock className="w-4 h-4 mr-2" /> Today's Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.todayAttendance?.punchIn ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Punched In</p>
                    <p className="text-2xl font-bold tracking-tight">{format(new Date(dashboard.todayAttendance.punchIn), "h:mm a")}</p>
                  </div>
                </div>
                {!dashboard.todayAttendance.punchOut && (
                  <Button 
                    className="w-full" 
                    variant="outline" 
                    onClick={handlePunchOut}
                    disabled={punchOut.isPending}
                  >
                    {punchOut.isPending ? "Punching out..." : "Punch Out"}
                  </Button>
                )}
                {dashboard.todayAttendance.punchOut && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-gray-500">Punched out at {format(new Date(dashboard.todayAttendance.punchOut), "h:mm a")}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Not Punched In</p>
                    <p className="text-sm text-gray-500">Start your day</p>
                  </div>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handlePunchIn}
                  disabled={punchIn.isPending}
                >
                  {punchIn.isPending ? "Punching in..." : "Punch In Now"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave Balance Card */}
        <Card className="col-span-1 shadow-sm border-gray-200/60 dark:border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center text-gray-600 dark:text-gray-400">
              <Briefcase className="w-4 h-4 mr-2" /> Leave Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-bold tracking-tight">{dashboard.leaveBalance.remaining} <span className="text-base font-normal text-gray-500">days left</span></p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-gray-500">Annual</p>
                  <p className="font-semibold">{dashboard.leaveBalance.annual}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Sick</p>
                  <p className="font-semibold">{dashboard.leaveBalance.sick}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card className="col-span-1 shadow-sm border-gray-200/60 dark:border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center text-gray-600 dark:text-gray-400">
              <CalendarIcon className="w-4 h-4 mr-2" /> Monthly Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-bold tracking-tight">{dashboard.monthlyStats.attendanceRate}% <span className="text-base font-normal text-gray-500">rate</span></p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-gray-500">Present</p>
                  <p className="font-semibold text-green-600">{dashboard.monthlyStats.presentDays} days</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Absent</p>
                  <p className="font-semibold text-red-600">{dashboard.monthlyStats.absentDays} days</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </motion.div>
  );
}
