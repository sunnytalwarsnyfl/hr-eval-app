import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getScoreLabel } from '../constants/evalSections'

export function generateEvalPDF(evaluation, sections, pipPlan) {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text('PERFORMANCE EVALUATION', 105, 20, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.text(`Employee: ${evaluation.employee_name}`, 20, 35)
  doc.text(`Date: ${evaluation.evaluation_date}`, 20, 42)
  doc.text(`Type: ${evaluation.evaluation_type}`, 20, 49)
  doc.text(`Evaluator: ${evaluation.evaluator_name || 'N/A'}`, 20, 56)
  doc.text(`Department: ${evaluation.department || 'N/A'}`, 110, 35)
  doc.text(`Belt Level: ${evaluation.belt_level_at_eval || evaluation.belt_level || evaluation.tech_level || 'N/A'}`, 110, 42)
  doc.text(`Status: ${evaluation.status}`, 110, 49)

  let y = 68

  // HR Review details (if present)
  const hasReview = evaluation.hr_reviewed_at
    || evaluation.overall_score != null
    || evaluation.attendance_occurrences != null
    || evaluation.disciplinary_count != null
    || evaluation.compliance_status
    || evaluation.pay_increase_rate != null
    || evaluation.bonus_percentage != null
    || evaluation.belt_level_at_eval

  if (hasReview) {
    if (y > 240) { doc.addPage(); y = 20 }
    doc.setFontSize(11)
    doc.setFont(undefined, 'bold')
    doc.text('HR REVIEW DETAILS', 20, y)
    y += 7
    doc.setFontSize(9)
    doc.setFont(undefined, 'normal')

    const reviewLines = []
    if (evaluation.belt_level_at_eval) reviewLines.push(`Belt Level at Eval: ${evaluation.belt_level_at_eval}`)
    if (evaluation.attendance_occurrences != null) reviewLines.push(`Attendance Occurrences: ${evaluation.attendance_occurrences}`)
    if (evaluation.disciplinary_count != null) reviewLines.push(`Disciplinary Actions (12mo): ${evaluation.disciplinary_count}`)
    if (evaluation.compliance_status) reviewLines.push(`Compliance Status: ${evaluation.compliance_status}`)
    if (evaluation.overall_score != null) reviewLines.push(`Overall Score: ${evaluation.overall_score}`)
    if (evaluation.pay_increase_rate != null) reviewLines.push(`Pay Increase Rate: ${(evaluation.pay_increase_rate * 100).toFixed(1)}%`)
    if (evaluation.bonus_percentage != null) reviewLines.push(`Bonus Percentage: ${(evaluation.bonus_percentage * 100).toFixed(0)}%`)
    if (evaluation.hr_reviewed_at) reviewLines.push(`HR Reviewed: ${(evaluation.hr_reviewed_at + '').split('T')[0] || ''}`)

    reviewLines.forEach(line => {
      if (y > 275) { doc.addPage(); y = 20 }
      doc.text(line, 25, y)
      y += 5
    })
    y += 5
  }

  // Sections
  if (sections && sections.length > 0) {
    sections.forEach(section => {
      if (y > 250) { doc.addPage(); y = 20 }

      doc.setFontSize(11)
      doc.setFont(undefined, 'bold')
      doc.text(`${section.section_name} (${section.section_score}/${section.section_max})`, 20, y)
      y += 6

      const tableData = (section.items || []).map(item => {
        const sectionDef = { scoring: 'standard' }
        return [
          item.item_label,
          item.score.toString(),
          item.max_score.toString()
        ]
      })

      autoTable(doc, {
        startY: y,
        head: [['Item', 'Score', 'Max']],
        body: tableData,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
        columnStyles: {
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'center', cellWidth: 20 }
        },
        margin: { left: 20, right: 20 }
      })

      y = doc.lastAutoTable.finalY + 8
    })
  }

  // Score Summary
  if (y > 240) { doc.addPage(); y = 20 }

  doc.setFontSize(13)
  doc.setFont(undefined, 'bold')
  doc.text(
    `TOTAL SCORE: ${evaluation.total_score} / ${evaluation.max_score} (${Math.round(evaluation.total_score / evaluation.max_score * 100)}%)`,
    20, y
  )
  y += 8

  doc.setFontSize(14)
  doc.setTextColor(evaluation.passed ? 0 : 200, evaluation.passed ? 150 : 0, 0)
  doc.text(evaluation.passed ? 'PASS' : 'FAIL', 20, y)
  doc.setTextColor(0, 0, 0)
  y += 12

  // PIP Plan
  if (pipPlan) {
    if (y > 240) { doc.addPage(); y = 20 }
    doc.setFontSize(11)
    doc.setFont(undefined, 'bold')
    doc.text('PERFORMANCE IMPROVEMENT PLAN', 20, y)
    y += 7

    doc.setFontSize(9)
    doc.setFont(undefined, 'normal')
    if (pipPlan.action_plan) {
      doc.text('Action Plan:', 20, y); y += 5
      const lines = doc.splitTextToSize(pipPlan.action_plan, 170)
      doc.text(lines, 20, y)
      y += lines.length * 4 + 4
    }
    if (pipPlan.goals) {
      doc.text('Goals:', 20, y); y += 5
      const lines = doc.splitTextToSize(pipPlan.goals, 170)
      doc.text(lines, 20, y)
      y += lines.length * 4 + 4
    }
    if (pipPlan.next_pip_date) {
      doc.text(`Next PIP Date: ${pipPlan.next_pip_date}`, 20, y)
      y += 8
    }
  }

  // Comments
  if (evaluation.supervisor_comments) {
    if (y > 240) { doc.addPage(); y = 20 }
    doc.setFontSize(10)
    doc.setFont(undefined, 'bold')
    doc.text('Supervisor Comments:', 20, y)
    y += 6
    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(evaluation.supervisor_comments, 170)
    doc.text(lines, 20, y)
    y += lines.length * 4.5 + 8
  }

  if (evaluation.employee_comments) {
    if (y > 240) { doc.addPage(); y = 20 }
    doc.setFontSize(10)
    doc.setFont(undefined, 'bold')
    doc.text('Employee Comments:', 20, y)
    y += 6
    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(evaluation.employee_comments, 170)
    doc.text(lines, 20, y)
    y += lines.length * 4.5 + 8
  }

  // Signature lines
  if (y > 240) { doc.addPage(); y = 20 }
  doc.line(20, y + 15, 90, y + 15)
  doc.line(110, y + 15, 190, y + 15)
  doc.setFontSize(9)
  doc.text('Employee Signature / Date', 20, y + 20)
  doc.text('Supervisor Signature / Date', 110, y + 20)
  doc.line(20, y + 35, 90, y + 35)
  doc.text('HR Signature / Date', 20, y + 40)

  doc.setFontSize(8)
  doc.text('Signed Performance Evaluation must be sent to HR', 105, 285, { align: 'center' })

  const fileName = `evaluation_${evaluation.id}_${(evaluation.employee_name || 'employee').replace(/\s+/g, '_')}.pdf`
  doc.save(fileName)
}
