import { useListHolidays, getListHolidaysQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { format, isPast, isToday } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Holidays() {
  const { data: holidays, isLoading } = useListHolidays(undefined, {
    query: { queryKey: getListHolidaysQueryKey() }
  });

  const getHolidayTypeBadge = (type: string) => {
    switch (type) {
      case 'public': return <Badge variant="secondary" className="bg-blue-50 text-blue-700">Public Holiday</Badge>;
      case 'company': return <Badge variant="secondary" className="bg-primary/10 text-primary">Company Holiday</Badge>;
      case 'optional': return <Badge variant="secondary" className="bg-gray-100 text-gray-600">Optional</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Holidays</h1>
        <p className="text-gray-500 text-sm mt-1">{new Date().getFullYear()} Calendar Year</p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))
        ) : holidays?.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed text-gray-500">
            No holidays scheduled for this year.
          </div>
        ) : (
          holidays?.map((holiday) => {
            const holidayDate = new Date(holiday.date);
            const isPassed = isPast(holidayDate) && !isToday(holidayDate);
            const isUpcoming = !isPassed && !isToday(holidayDate);

            return (
              <Card 
                key={holiday.id} 
                className={`overflow-hidden transition-all ${
                  isPassed ? 'opacity-60 bg-gray-50' : 
                  isToday(holidayDate) ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 
                  'hover:shadow-md'
                }`}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    <div className={`p-6 flex flex-col items-center justify-center min-w-[120px] ${
                      isPassed ? 'bg-gray-100 text-gray-500' :
                      isUpcoming ? 'bg-primary/10 text-primary' :
                      'bg-primary text-primary-foreground'
                    }`}>
                      <span className="text-3xl font-bold tracking-tight leading-none">{format(holidayDate, "dd")}</span>
                      <span className="text-sm font-medium uppercase tracking-wider mt-1">{format(holidayDate, "MMM")}</span>
                    </div>
                    
                    <div className="p-6 flex-1 flex flex-col justify-center">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{holiday.name}</h3>
                            {getHolidayTypeBadge(holiday.type)}
                          </div>
                          <p className="text-sm text-gray-500 capitalize">{holiday.dayOfWeek}</p>
                          {holiday.description && (
                            <p className="text-sm text-gray-600 mt-2">{holiday.description}</p>
                          )}
                        </div>
                        {isUpcoming && (
                          <Badge variant="outline" className="shrink-0 border-primary/20 text-primary bg-white">Upcoming</Badge>
                        )}
                        {isToday(holidayDate) && (
                          <Badge className="shrink-0">Today</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
