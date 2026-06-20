import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

// Build a short window of page numbers around the current page (max 5).
function pageWindow(current: number, totalPages: number): number[] {
  const span = 5;
  let start = Math.max(1, current - Math.floor(span / 2));
  const end = Math.min(totalPages, start + span - 1);
  start = Math.max(1, end - span + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * Pagination footer shared by the admin tables. Renders "Showing X–Y of Z" and
 * a windowed set of page buttons. Hidden when everything fits on one page.
 */
export function TablePagination({ page, pageSize, total, onPageChange }: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0 || totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
      <p className="text-sm text-muted-foreground" data-testid="pagination-summary">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-border"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          data-testid="button-prev-page"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        {pageWindow(page, totalPages).map((p) => (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="icon"
            className={`h-8 w-8 text-xs ${
              p === page ? "bg-primary hover:bg-primary/90 border-primary text-primary-foreground" : "border-border text-muted-foreground"
            }`}
            onClick={() => onPageChange(p)}
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
          onClick={() => onPageChange(page + 1)}
          data-testid="button-next-page"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
