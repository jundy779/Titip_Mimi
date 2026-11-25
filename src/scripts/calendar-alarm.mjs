const stamp = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escapeText = text => text.replace(/\\/g, '\\\\').replace(/\r\n?|\n/g, '\\n').replace(/[,;]/g, char => '\\' + char);
function fold(line) {
  let width = 0;
  let result = '';
  const encoder = new TextEncoder();
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (width + bytes > 75) { result += '\r\n '; width = 1; }
    result += char;
    width += bytes;
  }
  return result;
}
export function calendarAlarm(entry, page, now = new Date()) {
  const url = new URL('./', page);
  url.searchParams.set('agenda', entry.reminderId);
  const due = new Date(entry.snoozeUntil || entry.time);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Titip Mimi//Agenda//ID', 'BEGIN:VEVENT',
    'UID:' + escapeText(entry.reminderId) + '@titip-mimi', 'DTSTAMP:' + stamp(now), 'DTSTART:' + stamp(due),
    'SUMMARY:' + escapeText(entry.title), 'URL:' + url.href, 'DESCRIPTION:Buka agenda Mimi: ' + url.href,
    'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Waktunya agenda Mimi', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'];
  return lines.map(fold).join('\r\n') + '\r\n';
}
export function downloadAlarm(entry) {
  const file = new Blob([calendarAlarm(entry, location.href)], {type:'text/calendar;charset=utf-8'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = 'pengingat-mimi.ics';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 60000);
}
