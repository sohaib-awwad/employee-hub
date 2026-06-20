import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import type { AttendanceReport } from "@workspace/api-client-react";

// Olive brand palette (matches the light-mode --primary token), in RGB.
const OLIVE: [number, number, number] = [116, 139, 75];
const INK: [number, number, number] = [28, 36, 23];
const MUTED: [number, number, number] = [120, 120, 120];
const BAND: [number, number, number] = [244, 247, 238];

const MARGIN = 40;

// jspdf-autotable augments the doc with `lastAutoTable` at runtime; read its
// finalY to know where the next section should start.
function lastY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 0;
}

function fmtDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

function fmtTime(t?: string | null): string {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half day",
  on_leave: "On leave",
  holiday: "Holiday",
  weekend: "Weekend",
};
const statusLabel = (s: string) => STATUS_LABEL[s] ?? s.replace(/_/g, " ");
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "employee";
}

/**
 * Render an attendance report (from the admin report endpoint) to a branded,
 * multi-section PDF and trigger a download in the browser.
 */
export function downloadAttendanceReportPdf(report: AttendanceReport): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - MARGIN * 2;
  const { employee, period, summary, leave } = report;

  // ---- Header band ------------------------------------------------------
  doc.setFillColor(...OLIVE);
  doc.rect(0, 0, pageW, 76, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Olive", MARGIN, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Employee Attendance Sheet", MARGIN, 54);
  doc.setFontSize(9);
  doc.text(
    `Generated ${format(parseISO(report.generatedAt), "MMM d, yyyy 'at' h:mm a")}`,
    pageW - MARGIN,
    34,
    { align: "right" },
  );
  doc.text(`by ${report.generatedBy}`, pageW - MARGIN, 50, { align: "right" });

  // ---- Employee + period block -----------------------------------------
  let y = 100;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(employee.name, MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`${employee.position} · ${employee.department}`, MARGIN, y + 15);

  // Right-aligned period summary.
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Reporting period", pageW - MARGIN, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(`${fmtDate(period.from)} — ${fmtDate(period.to)}`, pageW - MARGIN, y + 15, { align: "right" });

  y += 34;
  doc.setDrawColor(...OLIVE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 14;

  // Compact employee facts as a two-up label/value grid.
  const facts: [string, string][] = [
    ["Employee ID", String(employee.id)],
    ["Email", employee.email],
    ["Gender", employee.gender ? titleCase(employee.gender) : "—"],
    ["Joined", fmtDate(employee.joinDate)],
  ];
  doc.setFontSize(9);
  const colW = contentW / 2;
  facts.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * colW;
    const ly = y + row * 16;
    doc.setTextColor(...MUTED);
    doc.text(`${label}:`, x, ly);
    doc.setTextColor(...INK);
    doc.text(value, x + 64, ly);
  });
  y += Math.ceil(facts.length / 2) * 16 + 8;

  // ---- Summary ----------------------------------------------------------
  y = sectionTitle(doc, y, "Summary");
  const s = summary;
  const pairs: [string, string][] = [
    ["Calendar days", String(s.calendarDays)],
    ["Working days", String(s.workingDays)],
    ["Days worked", String(s.daysWorked)],
    ["Half days", String(s.halfDays)],
    ["Absent days", String(s.absentDays)],
    ["On leave (days)", String(s.onLeaveDays)],
    ["Weekend days", String(s.weekendDays)],
    ["Holidays", String(s.holidays)],
    ["Holidays recorded", `${s.holidaysRecorded} of ${s.holidays}`],
    ["Holidays not recorded", String(s.holidaysNotRecorded)],
    ["Total hours worked", `${s.totalHoursWorked} h`],
    ["Attendance rate", `${s.attendanceRate}%`],
  ];
  // Two metric/value pairs per row.
  const summaryBody: string[][] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const a = pairs[i];
    const b = pairs[i + 1];
    summaryBody.push([a[0], a[1], b ? b[0] : "", b ? b[1] : ""]);
  }
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3, textColor: INK },
    columnStyles: {
      0: { textColor: MUTED, cellWidth: contentW * 0.28 },
      1: { fontStyle: "bold", cellWidth: contentW * 0.22 },
      2: { textColor: MUTED, cellWidth: contentW * 0.28 },
      3: { fontStyle: "bold", cellWidth: contentW * 0.22 },
    },
    body: summaryBody,
  });
  y = lastY(doc) + 18;

  // ---- Leave balance & consumption -------------------------------------
  y = sectionTitle(doc, y, "Leave balance & consumption");
  const takenByType = new Map(leave.takenInPeriod.map((t) => [t.type, t.days]));
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "striped",
    headStyles: { fillColor: OLIVE, textColor: 255, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 4, textColor: INK },
    alternateRowStyles: { fillColor: BAND },
    head: [["Leave type", "Entitlement", "Used (total)", "Remaining", "Used in period"]],
    body: leave.balance.map((b) => [
      titleCase(b.type),
      `${b.total} d`,
      `${b.used} d`,
      `${b.remaining} d`,
      `${takenByType.get(b.type) ?? 0} d`,
    ]),
  });
  y = lastY(doc) + 14;

  if (leave.entries.length > 0) {
    y = sectionTitle(doc, y, "Approved leave during this period");
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: "striped",
      headStyles: { fillColor: OLIVE, textColor: 255, fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 4, textColor: INK },
      alternateRowStyles: { fillColor: BAND },
      head: [["Type", "From", "To", "Days", "Status"]],
      body: leave.entries.map((e) => [
        titleCase(e.type),
        fmtDate(e.startDate),
        fmtDate(e.endDate),
        String(e.days),
        titleCase(e.status),
      ]),
    });
    y = lastY(doc) + 14;
  }

  // ---- Holidays ---------------------------------------------------------
  if (report.holidays.length > 0) {
    y = sectionTitle(doc, y, "Public holidays in period");
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: "striped",
      headStyles: { fillColor: OLIVE, textColor: 255, fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 4, textColor: INK },
      alternateRowStyles: { fillColor: BAND },
      head: [["Date", "Holiday", "Type", "Recorded in attendance?"]],
      body: report.holidays.map((h) => [
        fmtDate(h.date),
        h.name,
        titleCase(h.type),
        h.recorded ? "Yes" : "No",
      ]),
    });
    y = lastY(doc) + 14;
  }

  // ---- Day-by-day sheet -------------------------------------------------
  y = sectionTitle(doc, y, "Daily attendance");
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "striped",
    headStyles: { fillColor: OLIVE, textColor: 255, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 8.5, cellPadding: 3, textColor: INK },
    alternateRowStyles: { fillColor: BAND },
    head: [["Date", "Day", "Status", "Punch in", "Punch out", "Hours", "Note"]],
    body: report.days.map((d) => [
      fmtDate(d.date),
      d.weekday,
      statusLabel(d.status),
      fmtTime(d.punchIn),
      fmtTime(d.punchOut),
      d.hoursWorked != null ? `${d.hoursWorked}` : "—",
      d.holidayName ?? d.note ?? "",
    ]),
  });

  // ---- Footer on every page --------------------------------------------
  const pages = doc.getNumberOfPages();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, pageH - 28, pageW - MARGIN, pageH - 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Confidential · Olive HR", MARGIN, pageH - 16);
    doc.text(`Page ${i} of ${pages}`, pageW - MARGIN, pageH - 16, { align: "right" });
    doc.text(`${employee.name} · ${fmtDate(period.from)} – ${fmtDate(period.to)}`, pageW / 2, pageH - 16, {
      align: "center",
    });
  }

  doc.save(`attendance_${slug(employee.name)}_${period.from}_${period.to}.pdf`);
}

// Draws a small olive section heading and returns the y to start content at.
function sectionTitle(doc: jsPDF, y: number, text: string): number {
  const pageH = doc.internal.pageSize.getHeight();
  // Avoid orphaning a heading at the very bottom of a page.
  if (y > pageH - 90) {
    doc.addPage();
    y = MARGIN + 10;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...OLIVE);
  doc.text(text, MARGIN, y);
  doc.setTextColor(...INK);
  return y + 8;
}
