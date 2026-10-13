import { CoworkingTask } from '../types/task';

/**
 * Builds a direct Google Calendar Web "Create Event" URL
 * When opened, Google Calendar pre-populates:
 * - Event Title
 * - Dates / Times
 * - Detailed description (with linked Project, SID, SN, Subtasks)
 * - Guest invitees (all assigned user emails)
 */
export function buildGoogleCalendarUrl(task: CoworkingTask): string {
  const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';

  const title = encodeURIComponent(`[Task] ${task.title}`);

  // Format dates: YYYYMMDDTHHmmSS / YYYYMMDDTHHmmSS or YYYYMMDD/YYYYMMDD
  let dateParam = '';
  if (task.dueDate) {
    const cleanDate = task.dueDate.replace(/-/g, ''); // YYYYMMDD
    if (task.dueTime) {
      const cleanTime = task.dueTime.replace(/:/g, '') + '00';
      const [hours, minutes] = task.dueTime.split(':').map(Number);
      const endHour = String((hours + 1) % 24).padStart(2, '0');
      const endDateTime = `${cleanDate}T${endHour}${String(minutes || 0).padStart(2, '0')}00`;
      dateParam = `&dates=${cleanDate}T${cleanTime}/${endDateTime}`;
    } else {
      // All day event: end date is next day for Google Calendar standard
      const d = new Date(task.dueDate);
      d.setDate(d.getDate() + 1);
      const nextDayStr = d.toISOString().split('T')[0].replace(/-/g, '');
      dateParam = `&dates=${cleanDate}/${nextDayStr}`;
    }
  }

  // Construct details content
  let detailsText = `${task.description || 'Co-working Task'}\n\n`;

  if (task.linkedEntities && task.linkedEntities.length > 0) {
    detailsText += `📌 Linked Entities:\n`;
    task.linkedEntities.forEach((e) => {
      detailsText += `• [${e.type.toUpperCase()}] ${e.id}${e.title ? ` - ${e.title}` : ''}${e.extraInfo ? ` (${e.extraInfo})` : ''}\n`;
    });
    detailsText += `\n`;
  }

  if (task.subtasks && task.subtasks.length > 0) {
    detailsText += `☑️ Checklist (${task.subtasks.filter((s) => s.completed).length}/${task.subtasks.length}):\n`;
    task.subtasks.forEach((s) => {
      detailsText += `• [${s.completed ? 'X' : ' '}] ${s.title}\n`;
    });
    detailsText += `\n`;
  }

  if (task.assignees && task.assignees.length > 0) {
    detailsText += `👥 Team Assignees:\n`;
    task.assignees.forEach((a) => {
      detailsText += `• ${a.name} (${a.position || a.role || 'Member'}) <${a.email}>\n`;
    });
    detailsText += `\n`;
  }

  detailsText += `Priority: ${task.priority.toUpperCase()} | Status: ${task.status.toUpperCase()}\n`;
  detailsText += `Managed via Telkom SD-WAN Command Center`;

  const detailsParam = `&details=${encodeURIComponent(detailsText)}`;

  // Guest invitees (comma-separated emails)
  let addParam = '';
  if (task.assignees && task.assignees.length > 0) {
    const emails = task.assignees.map((a) => a.email).filter(Boolean).join(',');
    if (emails) {
      addParam = `&add=${encodeURIComponent(emails)}`;
    }
  }

  return `${baseUrl}&text=${title}${dateParam}${detailsParam}${addParam}`;
}

/**
 * Downloads a standard .ics iCal file for universal calendar imports (Outlook, Apple, Google)
 */
export function downloadTaskIcs(task: CoworkingTask): void {
  const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  let startStr = nowStr;
  let endStr = nowStr;

  if (task.dueDate) {
    const cleanDate = task.dueDate.replace(/-/g, '');
    if (task.dueTime) {
      const cleanTime = task.dueTime.replace(/:/g, '') + '00';
      const [hours, minutes] = task.dueTime.split(':').map(Number);
      const endHour = String((hours + 1) % 24).padStart(2, '0');
      startStr = `${cleanDate}T${cleanTime}`;
      endStr = `${cleanDate}T${endHour}${String(minutes || 0).padStart(2, '0')}00`;
    } else {
      startStr = cleanDate;
      endStr = cleanDate;
    }
  }

  const summary = `[Task] ${task.title}`;
  const description = `${task.description || ''}\\nPriority: ${task.priority}\\nStatus: ${task.status}`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Telkom SD-WAN//Command Center Task//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:task-${task.id}@telkom-sdwan.internal`,
    `DTSTAMP:${nowStr}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `task-${task.id}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
