// Generate iCalendar (.ics) format from events
// events: array of { uid, title, description, start, end (optional), location (optional), url (optional) }
function escapeICal(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function formatDate(date) {
  // Format: YYYYMMDD for VALUE=DATE (all-day events)
  if (typeof date === 'string') date = new Date(date);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function buildICal(events, calName = 'SIPS HR Calendar') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SIPS Healthcare//HR Eval System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICal(calName)}`,
    'X-WR-TIMEZONE:UTC',
  ];

  for (const ev of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${escapeICal(ev.uid)}@sipsconsults.com`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`);
    lines.push(`DTSTART;VALUE=DATE:${formatDate(ev.start)}`);
    if (ev.end) {
      lines.push(`DTEND;VALUE=DATE:${formatDate(ev.end)}`);
    }
    lines.push(`SUMMARY:${escapeICal(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeICal(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${escapeICal(ev.location)}`);
    if (ev.url) lines.push(`URL:${escapeICal(ev.url)}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

module.exports = { buildICal };
