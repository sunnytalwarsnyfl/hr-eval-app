import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Generic report PDF builder
// title: "Attendance Report"
// columns: [{ header, key, width? }]
// rows: array of objects matching keys
// meta: { dateRange, generatedBy }
export function generateReportPDF({ title, columns, rows, meta = {} }) {
  const doc = new jsPDF({ orientation: rows.length && columns.length > 6 ? 'landscape' : 'portrait' })

  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text(title.toUpperCase(), doc.internal.pageSize.getWidth() / 2, 18, { align: 'center' })

  doc.setFontSize(9)
  doc.setFont(undefined, 'normal')
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  let metaY = 26
  doc.text(`Generated: ${today}`, 14, metaY)
  if (meta.dateRange) {
    doc.text(`Date Range: ${meta.dateRange}`, 14, metaY + 5)
    metaY += 5
  }
  if (meta.generatedBy) {
    doc.text(`By: ${meta.generatedBy}`, 14, metaY + 5)
    metaY += 5
  }
  doc.text(`Total records: ${rows.length}`, 14, metaY + 5)

  const head = [columns.map(c => c.header)]
  const body = rows.map(row =>
    columns.map(c => {
      const val = typeof c.format === 'function' ? c.format(row[c.key], row) : row[c.key]
      if (val === null || val === undefined) return ''
      return String(val)
    })
  )

  autoTable(doc, {
    startY: metaY + 12,
    head,
    body,
    theme: 'striped',
    styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontSize: 8 },
    margin: { left: 8, right: 8 },
    didDrawPage: (data) => {
      const pageNumber = data.pageNumber
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text(
        `Page ${pageNumber} — SIPS Healthcare HR Evaluation System`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 6,
        { align: 'center' }
      )
    },
  })

  const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  const filename = `${safeTitle}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

// PDF configs use the CSV header labels as keys, since the CSV is parsed back into rows.
// Keep these aligned with the CSV column labels in backend/routes/reports.js export endpoints.
export const REPORT_PDF_CONFIGS = {
  evaluations: {
    title: 'Evaluations Report',
    columns: [
      { header: 'Date', key: 'Date' },
      { header: 'Employee', key: 'Employee' },
      { header: 'Type', key: 'Type' },
      { header: 'Department', key: 'Department' },
      { header: 'Score', key: 'Score', format: (v, r) => `${v}/${r['Max']}` },
      { header: 'Pass', key: 'Passed' },
      { header: 'Status', key: 'Status' },
    ],
  },
  attendance: {
    title: 'Attendance Report',
    columns: [
      { header: 'Date', key: 'Date' },
      { header: 'Employee', key: 'Employee' },
      { header: 'Code', key: 'Code' },
      { header: 'Type', key: 'Type' },
      { header: 'Pts', key: 'Points' },
      { header: 'Acc', key: 'Accumulated' },
      { header: 'Roll-Off', key: 'Roll-Off Date' },
      { header: 'Ack', key: 'Acknowledged' },
    ],
  },
  qa: {
    title: 'QA Report',
    columns: [
      { header: 'Date', key: 'Date' },
      { header: 'Employee', key: 'Employee' },
      { header: 'Issue Type', key: 'Issue Type' },
      { header: 'Pts', key: 'Points' },
      { header: 'Acc', key: 'Accumulated' },
      { header: 'Action', key: 'Action Required' },
      { header: 'Status', key: 'Status' },
    ],
  },
  disciplinary: {
    title: 'Disciplinary Report',
    columns: [
      { header: 'Incident', key: 'Incident Date' },
      { header: 'Employee', key: 'Employee' },
      { header: 'Action Level', key: 'Action Level' },
      { header: 'Status', key: 'Status' },
      { header: 'Issuance', key: 'Issuance Date' },
      { header: 'Monitoring', key: 'Monitoring' },
      { header: 'Roll-Off', key: 'Roll-Off Date' },
    ],
  },
  pip: {
    title: 'PIP Tracking Report',
    columns: [
      { header: 'Created', key: 'Created' },
      { header: 'Employee', key: 'Employee' },
      { header: 'Department', key: 'Department' },
      { header: 'Status', key: 'Status' },
      { header: 'Monitoring', key: 'Monitoring' },
      { header: 'Next Review', key: 'Next Review' },
    ],
  },
  compliance: {
    title: 'Compliance Records',
    columns: [
      { header: 'Employee', key: 'Employee' },
      { header: 'Department', key: 'Department' },
      { header: 'Requirement', key: 'Requirement' },
      { header: 'Expiration', key: 'Expiration' },
      { header: 'Renewed', key: 'Renewed' },
      { header: 'On Time', key: 'On Time' },
    ],
  },
  'belt-levels': {
    title: 'Belt Level Distribution',
    columns: [
      { header: 'Belt Level', key: 'Belt Level' },
      { header: 'Count', key: 'Count' },
    ],
  },
  'evals-due': {
    title: 'Evaluations Due',
    columns: [
      { header: 'Employee', key: 'Employee' },
      { header: 'Department', key: 'Department' },
      { header: 'Job Title', key: 'Job Title' },
      { header: 'Belt', key: 'Belt' },
      { header: 'Manager', key: 'Manager' },
      { header: 'Last Eval', key: 'Last Eval' },
      { header: 'Days Since', key: 'Days Since' },
    ],
  },
}
