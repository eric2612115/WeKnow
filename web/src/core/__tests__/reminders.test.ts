import { describe, expect, it } from 'vitest';
import { googleCalendarLink, icsFile } from '../reminders';

describe('reminders without calendar permission', () => {
  it('builds an all-day Google Calendar link', () => {
    const u = new URL(googleCalendarLink({ title: 'Pay City Power bill ($86.40)', date: '2026-11-28' }));
    expect(u.hostname).toBe('calendar.google.com');
    expect(u.searchParams.get('action')).toBe('TEMPLATE');
    expect(u.searchParams.get('dates')).toBe('20261128/20261129');
  });
  it('builds a timed event and an ics file with a reminder the day before', () => {
    const ics = icsFile({ title: 'Plumber visit', date: '2026-12-02T09:30' }, 'x1');
    expect(ics).toContain('DTSTART:20261202T093000');
    expect(ics).toContain('TRIGGER:-P1D');
  });
  it('refuses a malformed date', () => {
    expect(() => googleCalendarLink({ title: 'x', date: 'next tuesday' })).toThrow();
  });
});
