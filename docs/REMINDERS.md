# Reminders

VaultKey uses per-entry rotation intervals and per-account `nextPasswordChangeAt` dates.

## Behavior

- Due: within 7 days.
- Overdue: past the scheduled date.
- Snooze: postpones the reminder date (7-day default in UI).
- Recurring: based on `reminderIntervalDays`.
- Missed reminders are recomputed on reopen from stored dates.

## Timezone

Dates are stored as epoch milliseconds and formatted with the browser's local timezone. Calendar-date arithmetic uses local dates; avoid UTC conversion of calendar dates.

## Notification permissions

- Granted: browser notifications may be shown while the tab/page is active.
- Denied / unavailable: in-app reminders remain the fallback.
- Browser notifications are NOT guaranteed while the browser or app is closed.

## Limitations

- No guaranteed background execution.
- No server-side scheduling.