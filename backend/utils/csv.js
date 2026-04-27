// Simple CSV builder — no dependencies
function escapeCell(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(rows, columns) {
  // columns: [{ key, label }]
  const header = columns.map(c => escapeCell(c.label)).join(',');
  const body = rows.map(row =>
    columns.map(c => escapeCell(typeof c.format === 'function' ? c.format(row[c.key], row) : row[c.key])).join(',')
  ).join('\r\n');
  return header + '\r\n' + body;
}

function sendCSV(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + csv); // BOM for Excel UTF-8 detection
}

module.exports = { toCSV, sendCSV };
