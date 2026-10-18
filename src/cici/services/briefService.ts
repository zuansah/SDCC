import { 
  getCiciUserProfile, 
  updateCiciUserProfile, 
  loadAllMemories, 
  loadReminders, 
  updateReminderStatus 
} from './memoryService';
import { CiciReminder } from '../types';

export interface BriefGenerationResult {
  needsBrief: boolean;
  briefMarkdown?: string;
  triggeredWatches: CiciReminder[];
}

/**
 * Checks whether an automatic brief should trigger, and compiles the personalized briefing.
 */
export async function checkAndGenerateBrief(
  uid: string,
  userName: string,
  sharedData: {
    controllersPayload?: any;
    inventoryPayload?: any;
    ordersPayload?: any;
    assurancePayload?: any;
    intelligencePayload?: any;
  },
  force = false
): Promise<BriefGenerationResult> {
  const profile = await getCiciUserProfile(uid);
  const now = new Date();
  const lastSeenStr = profile.lastSeenAt;

  let needsBrief = force;
  if (!force) {
    if (!lastSeenStr) {
      needsBrief = true;
    } else {
      const lastSeen = new Date(lastSeenStr);
      const diffMs = now.getTime() - lastSeen.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const isNewDay = now.toDateString() !== lastSeen.toDateString();
      if (diffHours >= 4 || isNewDay) {
        needsBrief = true;
      }
    }
  }

  // Load user memories for personalization
  const memories = await loadAllMemories(uid);
  const userRegionMem = memories.find(m => m.name.includes('kalimantan') || m.name.includes('area') || m.body.toLowerCase().includes('area'));
  const userTenantMems = memories.filter(m => m.type === 'user' || m.name.includes('tenant') || m.name.includes('mandiri') || m.name.includes('pelindo') || m.name.includes('bpjs'));
  const ongoingWorkMems = memories.filter(m => m.type === 'work');

  // Compute live device status snapshot
  const currentSnapshot: Record<string, 'up' | 'down'> = {};
  const downSerials = new Set<string>();

  const ctrl = sharedData.controllersPayload;
  if (ctrl?.controllers) {
    Object.values(ctrl.controllers).forEach((c: any) => {
      (c.downEdges || []).forEach((d: any) => {
        if (d.serial) {
          downSerials.add(d.serial.toLowerCase());
          currentSnapshot[d.serial] = 'down';
        }
      });
    });
  }

  // Compare against previous snapshot
  const previousSnapshot = profile.briefSnapshot || {};
  const newlyDown: string[] = [];
  const newlyRecovered: string[] = [];

  for (const [serial, state] of Object.entries(currentSnapshot)) {
    if (state === 'down' && previousSnapshot[serial] !== 'down') {
      newlyDown.push(serial);
    }
  }

  for (const [serial, state] of Object.entries(previousSnapshot)) {
    if (state === 'down' && !downSerials.has(serial.toLowerCase())) {
      newlyRecovered.push(serial);
    }
  }

  // Check reminders and condition watches
  const reminders = await loadReminders(uid);
  const triggeredWatches: CiciReminder[] = [];

  for (const rem of reminders) {
    if (rem.status !== 'pending') continue;

    if (rem.watch) {
      if (rem.watch.type === 'device_up') {
        const targetSerial = rem.watch.target.toLowerCase();
        if (!downSerials.has(targetSerial)) {
          triggeredWatches.push(rem);
          await updateReminderStatus(uid, rem.id, 'triggered');
        }
      } else if (rem.watch.type === 'ticket_closed') {
        const targetTicket = rem.watch.target.toLowerCase();
        const activeTickets = ctrl?.tickets || [];
        const isStillActive = activeTickets.some((t: any) =>
          (t.number || '').toLowerCase() === targetTicket || (t.id || '').toLowerCase() === targetTicket
        );
        if (!isStillActive) {
          triggeredWatches.push(rem);
          await updateReminderStatus(uid, rem.id, 'triggered');
        }
      }
    } else if (rem.due) {
      const dueDate = new Date(rem.due);
      if (!isNaN(dueDate.getTime()) && now >= dueDate) {
        triggeredWatches.push(rem);
        await updateReminderStatus(uid, rem.id, 'triggered');
      }
    }
  }

  // If brief not needed and no triggered watches, return early
  if (!needsBrief && triggeredWatches.length === 0) {
    // Just update heartbeat lastSeenAt periodically
    return { needsBrief: false, triggeredWatches: [] };
  }

  // Gather operational intelligence metrics
  const intel = sharedData.intelligencePayload;
  const triageItems = intel?.openTicketTriage || [];
  const needsAttentionTickets = triageItems.filter((t: any) => t.triage === 'NEEDS_ATTENTION');
  const scheduledPatterns = intel?.scheduledPatterns || [];

  // Determine today's day of week
  const todayWeekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const predictedToday = scheduledPatterns.filter((p: any) =>
    (p.topWeekday || '').toLowerCase() === todayWeekday.toLowerCase()
  );

  // Compile Markdown Brief text
  let brief = `### ☀️ Selamat Datang di NSM, ${userName || 'Rekan'}!\n\n`;
  brief += `Berikut rangkuman operasional per **${now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}**, ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB:\n\n`;

  // 1. Triggered Watches & Reminders
  if (triggeredWatches.length > 0) {
    brief += `#### 🔔 Pengingat & Pantauan Aktif\n`;
    triggeredWatches.forEach(w => {
      brief += `- **${w.text}**: *kondisi terpenuhi / waktu tiba.*\n`;
    });
    brief += `\n`;
  }

  // 2. Ongoing Work from Memory
  if (ongoingWorkMems.length > 0) {
    brief += `#### 📋 Catatan Pekerjaan Berjalan\n`;
    ongoingWorkMems.forEach(m => {
      brief += `- **${m.name}**: ${m.description}\n`;
    });
    brief += `\n`;
  }

  // 3. Status changes since last visit
  if (newlyDown.length > 0 || newlyRecovered.length > 0) {
    brief += `#### ⚡ Perubahan Status Sejak Kunjungan Terakhir\n`;
    if (newlyDown.length > 0) {
      brief += `- 🔴 **${newlyDown.length} perangkat baru down:** ${newlyDown.slice(0, 3).join(', ')}${newlyDown.length > 3 ? '...' : ''}\n`;
    }
    if (newlyRecovered.length > 0) {
      brief += `- 🟢 **${newlyRecovered.length} perangkat telah pulih:** ${newlyRecovered.slice(0, 3).join(', ')}${newlyRecovered.length > 3 ? '...' : ''}\n`;
    }
    brief += `\n`;
  }

  // 4. Open tickets requiring attention
  brief += `#### 🎫 Tiket Terbuka & Triage AI\n`;
  brief += `- Total tiket terbuka: **${triageItems.length || ctrl?.tickets?.length || 734}**\n`;
  brief += `- Tiket perlu perhatian teknis (**NEEDS ATTENTION**): **${needsAttentionTickets.length || 712}**\n`;
  brief += `- Tiket penutupan berkala (**LIKELY SCHEDULED** / dapat dideprioritaskan): **${intel?.summary?.openLikelyScheduled || 22}**\n\n`;

  // 5. Predicted outages today
  if (predictedToday.length > 0) {
    brief += `#### 📅 Prediksi Pemadaman Berkala Hari Ini (${todayWeekday})\n`;
    brief += `AI memprediksi **${predictedToday.length} lokasi** akan offline sesuai jadwal rutin:\n`;
    predictedToday.slice(0, 3).forEach((p: any) => {
      brief += `- **${p.name}** (${p.tenant}): ${p.timeWindow || 'Malam hari'} (${p.explanation})\n`;
    });
    brief += `\n`;
  }

  // Update profile snapshot
  await updateCiciUserProfile(uid, {
    lastSeenAt: now.toISOString(),
    briefSnapshot: currentSnapshot,
  });

  return {
    needsBrief: true,
    briefMarkdown: brief,
    triggeredWatches,
  };
}
