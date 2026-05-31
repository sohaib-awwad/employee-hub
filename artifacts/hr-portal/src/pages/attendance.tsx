import { useState, useEffect } from "react";
import { useListAttendance, getListAttendanceQueryKey, useGetTodayAttendance, getGetTodayAttendanceQueryKey, usePunchIn, usePunchOut } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Attendance() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: todayRecord, isLoading: todayLoading } = useGetTodayAttendance({
    query: { queryKey: getGetTodayAttendanceQueryKey() }
  });

  const { data: history, isLoading: historyLoading } = useListAttendance(undefined, {
    query: { queryKey: getListAttendanceQueryKey() }
  });

  const punchIn = usePunchIn();
  const punchOut = usePunchOut();

  const handlePunchIn = () => {
    punchIn.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      }
    });
  };

  const handlePunchOut = () => {
    punchOut.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      }
    });
  };

  const formatTimeStr = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none shadow-none">Present</Badge>;
      case 'absent': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-none shadow-none">Absent</Badge>;
      case 'half_day': return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-none shadow-none">Half Day</Badge>;
      case 'on_leave': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none shadow-none">On Leave</Badge>;
      case 'holiday': return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-none shadow-none">Holiday</Badge>;
      case 'weekend': return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100 border-none shadow-none">Weekend</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-8"
    >
      <div className="flex flex-col md:flex-row gap-8 items-start">
        
        {/* Live Clock Card */}
        <Card className="w-full md:w-1/3 bg-primary text-primary-foreground border-none shadow-md">
          <CardContent className="p-8 text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-medium opacity-90">{format(currentTime, "EEEE, MMMM d")}</h2>
              <div className="text-5xl font-bold tracking-tighter tabular-nums">
                {format(currentTime, "HH:mm:ss")}
              </div>
            </div>

            {todayLoading ? (
              <Skeleton className="h-12 w-full bg-white/20" />
            ) : (
              <div className="space-y-4">
                {!todayRecord?.punchIn ? (
                  <Button 
                    size="lg" 
                    className="w-full bg-white text-primary hover:bg-gray-100 font-semibold h-14 text-lg shadow-sm"
                    onClick={handlePunchIn}
                    disabled={punchIn.isPending}
                  >
                    {punchIn.isPending ? "Punching in..." : "Punch In"}
                  </Button>
                ) : !todayRecord.punchOut ? (
                  <div className="space-y-3">
                    <p className="text-sm opacity-90">Punched in at {format(new Date(todayRecord.punchIn), "h:mm a")}</p>
                    <Button 
                      size="lg" 
                      variant="outline"
                      className="w-full border-white/30 hover:bg-white/10 text-white font-semibold h-14 text-lg"
                      onClick={handlePunchOut}
                      disabled={punchOut.isPending}
                    >
                      {punchOut.isPending ? "Punching out..." : "Punch Out"}
                    </Button>
                  </div>
                ) : (
                  <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                    <p className="font-medium">Day Complete</p>
                    <p className="text-sm opacity-80 mt-1">Punched out at {format(new Date(todayRecord.punchOut), "h:mm a")}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* History Table */}
        <div className="flex-1 w-full">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Monthly Log</h2>
          <Card className="border-gray-200/60 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/80 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500">Date</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Status</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Punch In</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Punch Out</th>
                    <th className="px-6 py-4 font-medium text-gray-500 text-right">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {historyLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-12 ml-auto" /></td>
                      </tr>
                    ))
                  ) : history?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        No attendance records found.
                      </td>
                    </tr>
                  ) : (
                    history?.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                          {format(new Date(record.date), "MMM d, yyyy")}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(record.status)}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {record.punchIn ? formatTimeStr(record.punchIn) : "-"}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {record.punchOut ? formatTimeStr(record.punchOut) : "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-medium">
                          {record.hoursWorked ? `${record.hoursWorked.toFixed(1)}h` : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
