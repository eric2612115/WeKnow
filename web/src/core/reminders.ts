// Reminders without any calendar permission: an "add to Google Calendar" link the person saves themselves,
// and an .ics file for any other calendar app. Google Calendar then does the reminding.

export interface Reminder {
  title: string; // e.g. "Pay City Power bill ($86.40)"
  date: string; // YYYY-MM-DD (all-day) or YYYY-MM-DDTHH:mm (local time)
  details?: string;
}

const compact = (d: string) => d.replace(/[-:]/g, '');

function range(date: string): [string, string] {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + 1);
    return [compact(date), compact(next.toISOString().slice(0, 10))];
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date)) {
    const start = new Date(date);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const local = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
    return [local(start), local(end)];
  }
  throw new Error(`bad reminder date ${date}`);
}

export function googleCalendarLink(r: Reminder): string {
  const [start, end] = range(r.date);
  const p = new URLSearchParams({ action: 'TEMPLATE', text: r.title.slice(0, 120), dates: `${start}/${end}` });
  if (r.details) p.set('details', r.details.slice(0, 500));
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function icsFile(r: Reminder, uid: string): string {
  const [start, end] = range(r.date);
  const allDay = start.length === 8;
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WeKnow//EN',
    'BEGIN:VEVENT',
    `UID:${uid}@weknow`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
    allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`,
    `SUMMARY:${esc(r.title)}`,
    r.details ? `DESCRIPTION:${esc(r.details)}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(r.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}
