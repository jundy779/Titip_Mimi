export function nextReminder(entries, now = Date.now()) {
  let next;
  let earliest = Infinity;
  for (const entry of entries) {
    if (entry.done || !entry.time) continue;
    const due = entry.snoozeUntil || Date.parse(entry.time);
    if (due <= now && due < earliest) {
      earliest = due;
      next = entry;
    }
  }
  return next;
}
