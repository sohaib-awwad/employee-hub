import { useState } from "react";
import { useListAnnouncements, getListAnnouncementsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronLeft, ChevronRight, Filter } from "lucide-react";

const PAGE_SIZE = 6;

const PRIORITY_STYLE: Record<string, string> = {
  high:   "bg-danger/15 text-danger",
  medium: "bg-info/15 text-info",
  low:    "bg-muted text-muted-foreground",
};

export default function Announcements() {
  const [activeType, setActiveType] = useState<"announcement" | "event">("announcement");
  const [page, setPage] = useState(1);
  const [priority, setPriority] = useState("all");
  const [search, setSearch] = useState("");

  // Type, priority, and search are all applied server-side now, so pagination
  // and the filters no longer fight each other.
  const params = {
    type: activeType,
    page,
    limit: PAGE_SIZE,
    priority: priority === "all" ? undefined : (priority as "low" | "medium" | "high"),
    q: search || undefined,
  };
  const { data, isLoading } = useListAnnouncements(params, {
    query: { queryKey: getListAnnouncementsQueryKey(params) }
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Real per-type counts from the server (respect the active search/priority).
  const announcementCount = data?.announcementCount ?? 0;
  const eventCount = data?.eventCount ?? 0;

  const handleTabChange = (type: "announcement" | "event") => {
    setActiveType(type);
    setPage(1);
  };

  const handlePriorityChange = (value: string) => {
    setPriority(value);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-6xl mx-auto space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Announcements &amp; Events</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {announcementCount} announcements · {eventCount} events
        </p>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => handleTabChange("announcement")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeType === "announcement"
              ? "bg-primary text-white"
              : "bg-accent/60 text-muted-foreground hover:bg-accent"
          }`}
          data-testid="tab-announcements"
        >
          Announcements
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            activeType === "announcement" ? "bg-white/20 text-white" : "bg-card text-muted-foreground"
          }`}>
            {announcementCount}
          </span>
        </button>
        <button
          onClick={() => handleTabChange("event")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeType === "event"
              ? "bg-primary text-white"
              : "bg-accent/60 text-muted-foreground hover:bg-accent"
          }`}
          data-testid="tab-events"
        >
          Events
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            activeType === "event" ? "bg-white/20 text-white" : "bg-card text-muted-foreground"
          }`}>
            {eventCount}
          </span>
        </button>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 border-border bg-card text-sm"
            placeholder="Search announcements..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            data-testid="input-search-announcements"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={priority} onValueChange={handlePriorityChange}>
            <SelectTrigger className="w-36 border-border bg-card text-sm" data-testid="select-priority-filter">
              <SelectValue placeholder="All Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">No announcements found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="border-border shadow-sm hover:shadow-md transition-shadow h-full" data-testid={`card-announcement-${a.id}`}>
                <CardContent className="p-5 flex flex-col h-full">
                  <h3 className="font-bold text-foreground text-sm leading-snug mb-2 line-clamp-2">
                    {a.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1 line-clamp-4">
                    {a.body}
                  </p>
                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <span className="text-[10px] border border-border text-muted-foreground px-2 py-0.5 rounded font-medium">
                      {a.category}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${PRIORITY_STYLE[a.priority] ?? "bg-gray-100 text-gray-500"}`}>
                      {a.priority.charAt(0).toUpperCase() + a.priority.slice(1)}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {format(parseISO(a.publishedAt), "MMM d")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-border"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                size="icon"
                className={`h-8 w-8 text-xs ${p === page ? "bg-primary hover:bg-primary/90 border-primary" : "border-border text-muted-foreground"}`}
                onClick={() => setPage(p)}
                data-testid={`button-page-${p}`}
              >
                {p}
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-border"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              data-testid="button-next-page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
