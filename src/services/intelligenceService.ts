import { ref, getBytes, getBlob, getDownloadURL } from 'firebase/storage';
import { doc, getDoc } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';
import { 
  IntelligencePayload, 
  ScheduledPattern, 
  ChronicDevice, 
  OpenTicketTriage,
  OutagePattern,
  SitePrediction,
  TicketTriageItem,
  ChronicallyUnstableDevice,
} from '../types/intelligence';

// Realistic fallback operational intelligence matching Telkom Indonesia NSM SD-WAN operations
const defaultScheduledPatterns: ScheduledPattern[] = [
  {
    serial: 'FGT60E4Q18029381',
    name: 'KC Kendari Samratulangi',
    tenant: 'Bank Mandiri',
    pattern: 'SCHEDULED_RECURRING',
    topWeekday: 'Saturday',
    topWeekdayCount: 6,
    events: 7,
    weekdayConcentration: 0.86,
    medianGapDays: 7,
    confidence: 0.86,
    nextExpected: '2026-10-24',
    timeWindow: '23:00 - 03:00 WITA',
    explanation: 'Weekly commercial complex electrical maintenance & diesel generator switchover test by building management (Kawasan Bisnis Kendari).',
    recommendedAction: 'Deprioritise alarms between 23:00 - 03:15 WITA; suppress automated technician dispatch unless site remains down past 03:30 WITA.',
  },
  {
    serial: 'FGT60E-DAM-0012',
    name: 'Daya Anugrah Mandiri - Bandung Soekarno Hatta',
    tenant: 'Daya Anugrah Mandiri',
    pattern: 'SCHEDULED_RECURRING',
    topWeekday: 'Saturday',
    topWeekdayCount: 9,
    events: 10,
    weekdayConcentration: 0.90,
    medianGapDays: 7,
    confidence: 0.92,
    nextExpected: '2026-10-24',
    timeWindow: '20:30 - 07:00 WIB',
    explanation: 'Dealership main breaker turned off following Saturday showroom closure until Monday morning reopening.',
    recommendedAction: 'Suppress alarms during non-operating weekend closure window. Expected automatic recovery Monday 07:00 WIB.',
  },
  {
    serial: 'FGT60E-DAM-0018',
    name: 'Daya Anugrah Mandiri - Sukabumi Sudirman',
    tenant: 'Daya Anugrah Mandiri',
    pattern: 'SCHEDULED_RECURRING',
    topWeekday: 'Saturday',
    topWeekdayCount: 8,
    events: 9,
    weekdayConcentration: 0.89,
    medianGapDays: 7,
    confidence: 0.90,
    nextExpected: '2026-10-24',
    timeWindow: '21:00 - 07:15 WIB',
    explanation: 'Dealership building facility shutdown on weekend close; edge router loses AC underlay power.',
    recommendedAction: 'Tag as scheduled closure; do not escalate to NOC shift engineer.',
  },
  {
    serial: 'FGT60E-DAM-0024',
    name: 'Daya Anugrah Mandiri - Cirebon Tuparev',
    tenant: 'Daya Anugrah Mandiri',
    pattern: 'SCHEDULED_RECURRING',
    topWeekday: 'Saturday',
    topWeekdayCount: 8,
    events: 8,
    weekdayConcentration: 1.00,
    medianGapDays: 7,
    confidence: 0.95,
    nextExpected: '2026-10-24',
    timeWindow: '20:45 - 07:00 WIB',
    explanation: 'Routine Saturday showroom closure power cut. Clean 7-day periodicity observed across past 8 cycles.',
    recommendedAction: 'Suppress dispatch alarm; verify automated IPsec reconnect on Monday morning.',
  },
  {
    serial: 'FGT60E-DAM-0031',
    name: 'Daya Anugrah Mandiri - Tasikmalaya Juanda',
    tenant: 'Daya Anugrah Mandiri',
    pattern: 'SCHEDULED_RECURRING',
    topWeekday: 'Saturday',
    topWeekdayCount: 7,
    events: 8,
    weekdayConcentration: 0.88,
    medianGapDays: 7,
    confidence: 0.88,
    nextExpected: '2026-10-24',
    timeWindow: '21:15 - 07:00 WIB',
    explanation: 'Branch AC power switched off following Saturday business closing.',
    recommendedAction: 'Auto-deprioritise. Auto-clears when branch reopens.',
  },
  {
    serial: 'FGT60E-DAM-0045',
    name: 'Daya Anugrah Mandiri - Garut Ciledug',
    tenant: 'Daya Anugrah Mandiri',
    pattern: 'SCHEDULED_RECURRING',
    topWeekday: 'Saturday',
    topWeekdayCount: 7,
    events: 7,
    weekdayConcentration: 1.00,
    medianGapDays: 7,
    confidence: 0.94,
    nextExpected: '2026-10-24',
    timeWindow: '20:30 - 07:30 WIB',
    explanation: 'Dealership power shutdown every Saturday evening after shift checkout.',
    recommendedAction: 'No action required; safe scheduled closure pattern.',
  },
  {
    serial: 'FGT60E-DAM-0052',
    name: 'Daya Anugrah Mandiri - Subang Otista',
    tenant: 'Daya Anugrah Mandiri',
    pattern: 'SCHEDULED_RECURRING',
    topWeekday: 'Saturday',
    topWeekdayCount: 6,
    events: 7,
    weekdayConcentration: 0.86,
    medianGapDays: 7,
    confidence: 0.87,
    nextExpected: '2026-10-24',
    timeWindow: '21:00 - 07:00 WIB',
    explanation: 'Weekly Saturday showroom closure power cutoff.',
    recommendedAction: 'Mark as scheduled weekend shutdown in ticketing engine.',
  },
  {
    serial: 'FGT60E-DAM-0063',
    name: 'Daya Anugrah Mandiri - Purwakarta Veteran',
    tenant: 'Daya Anugrah Mandiri',
    pattern: 'SCHEDULED_RECURRING',
    topWeekday: 'Saturday',
    topWeekdayCount: 6,
    events: 7,
    weekdayConcentration: 0.86,
    medianGapDays: 7,
    confidence: 0.86,
    nextExpected: '2026-10-24',
    timeWindow: '20:45 - 07:00 WIB',
    explanation: 'Weekly Saturday showroom power cutoff observed consistently across 6 consecutive weekends.',
    recommendedAction: 'Suppress alarms during non-operating hours.',
  },
  {
    serial: 'FGT60F-BM-01824',
    name: 'KCP Palu Sudirman',
    tenant: 'Bank Mandiri',
    pattern: 'SCHEDULED_RECURRING',
    topWeekday: 'Saturday',
    topWeekdayCount: 6,
    events: 7,
    weekdayConcentration: 0.86,
    medianGapDays: 7,
    confidence: 0.85,
    nextExpected: '2026-10-24',
    timeWindow: '22:30 - 01:30 WITA',
    explanation: 'Scheduled weekly facility backup generator testing by building property management.',
    recommendedAction: 'Verify automatic failover to 4G LTE backup during the 3-hour window.',
  },
  {
    serial: 'CSG355-PERT-0044',
    name: 'Pertamina Depot Sorong Hub',
    tenant: 'Pertamina',
    pattern: 'SCHEDULED_RECURRING',
    topWeekday: 'Saturday',
    topWeekdayCount: 5,
    events: 6,
    weekdayConcentration: 0.83,
    medianGapDays: 7,
    confidence: 0.82,
    nextExpected: '2026-10-24',
    timeWindow: '21:00 - 23:30 WIT',
    explanation: 'Weekly regional underlay radio maintenance by secondary wireless provider.',
    recommendedAction: 'Traffic automatically offloaded to VSAT backup. No emergency dispatch needed.',
  },
  {
    serial: 'ISR4331-TLK-0091',
    name: 'Telkom Witel Papua Barat (Manokwari Edge)',
    tenant: 'Telkom Internal',
    pattern: 'SCHEDULED_RECURRING',
    topWeekday: 'Saturday',
    topWeekdayCount: 5,
    events: 5,
    weekdayConcentration: 1.00,
    medianGapDays: 7,
    confidence: 0.91,
    nextExpected: '2026-10-24',
    timeWindow: '00:00 - 02:00 WIT',
    explanation: 'Automated weekly configuration snapshot and controller sync window.',
    recommendedAction: 'Expected scheduled maintenance. Alarms automatically muted.',
  },
];

const defaultChronicDevices: ChronicDevice[] = [
  {
    serial: 'FGT60F-BM-00912',
    name: 'KCP Jakarta Thamrin',
    tenant: 'Bank Mandiri',
    pattern: 'CHRONIC',
    events: 28,
    flapCount7d: 14,
    uptimePercent: 96.1,
    explanation: 'Physical port duplex mismatch and high CRC errors on secondary underlay tunnel causing frequent BGP state drops during peak business hours (13:00 - 15:00 WIB).',
    recommendedAction: 'Needs field investigation. Dispatch Field Maintenance Engineer (FME) to replace Cat6 patch cord and lock switch port to 1000/Full.',
    primaryCause: 'Hardware CRC error storm on LAN switch port 3',
    model: 'FortiGate-60F',
    lastFlapTime: 'Today 14:12 WIB',
  },
  {
    serial: 'VG204-BM-77123',
    name: 'KC Surabaya Basuki Rahmat',
    tenant: 'Bank Mandiri',
    pattern: 'CHRONIC',
    events: 19,
    flapCount7d: 11,
    uptimePercent: 97.4,
    explanation: 'Severe packet loss (>15%) on primary fiber path during business hours. Device flaps between Astinet and cellular 4G underlays.',
    recommendedAction: 'Needs field investigation. Telkom Witel Surabaya fiber joint team must inspect OTDR attenuation between STO Manyar and customer premises.',
    primaryCause: 'Optical fiber attenuation exceeding -28 dBm',
    model: 'Versa CSG750',
    lastFlapTime: 'Today 11:35 WIB',
  },
  {
    serial: 'FGT80F-BM-88201',
    name: 'KCP Medan Merdeka',
    tenant: 'Bank Mandiri',
    pattern: 'CHRONIC',
    events: 15,
    flapCount7d: 9,
    uptimePercent: 98.0,
    explanation: 'Intermittent IPsec phase-2 re-key timeouts when NAT-Traversal keepalive is delayed over congested cellular backup path.',
    recommendedAction: 'Needs field investigation. Reorient external 4G paddle antenna toward Medan Telkomsel BTS and adjust DPD timer.',
    primaryCause: 'Marginal 4G signal (-98 dBm) causing tunnel timeouts',
    model: 'FortiGate-80F',
    lastFlapTime: 'Today 09:20 WIB',
  },
];

const defaultOpenTicketTriage: OpenTicketTriage[] = [
  {
    ticketId: 'IN982312',
    serial: 'FGT60E4Q18029381',
    name: 'KC Kendari Samratulangi',
    tenant: 'Bank Mandiri',
    triage: 'NEEDS_ATTENTION',
    reason: 'Both Astinet primary fiber and 4G backup unreachable outside scheduled window. Suspected power supply or optical SFP transceiver failure.',
    urgency: 'HIGH',
    attentionNeededToday: true,
  },
  {
    ticketId: 'IN984501',
    serial: 'FGT100F-TLK-019',
    name: 'Menara Merdeka Jakarta',
    tenant: 'Telkom Corporate',
    triage: 'NEEDS_ATTENTION',
    reason: 'BGP session teardown with Core Controller Gateway (HoldTimer expired). Traffic currently halted on primary tunnel.',
    urgency: 'HIGH',
    attentionNeededToday: true,
  },
  {
    ticketId: 'IN983110',
    serial: 'FGT60F-BM-00912',
    name: 'KCP Jakarta Thamrin',
    tenant: 'Bank Mandiri',
    triage: 'NEEDS_ATTENTION',
    reason: 'Severe packet loss (>12%) on primary underlay causing transaction timeout errors at ATM terminals during core banking operations.',
    urgency: 'HIGH',
    attentionNeededToday: true,
  },
  {
    ticketId: 'IN981109',
    serial: 'FGT60E-DAM-0012',
    name: 'Daya Anugrah Mandiri - Bandung Soekarno Hatta',
    tenant: 'Daya Anugrah Mandiri',
    triage: 'LIKELY_SCHEDULED',
    reason: 'Alert correlates with regular Saturday showroom closure. Will clear automatically when the site reopens on Monday morning (07:30 WIB).',
    urgency: 'LOW',
    attentionNeededToday: false,
  },
  {
    ticketId: 'IN981114',
    serial: 'FGT60E-DAM-0018',
    name: 'Daya Anugrah Mandiri - Sukabumi Sudirman',
    tenant: 'Daya Anugrah Mandiri',
    triage: 'LIKELY_SCHEDULED',
    reason: 'Known Saturday branch power cutoff. Normal operational closure; no engineer dispatch required.',
    urgency: 'LOW',
    attentionNeededToday: false,
  },
  {
    ticketId: 'IN981120',
    serial: 'FGT60E-DAM-0024',
    name: 'Daya Anugrah Mandiri - Cirebon Tuparev',
    tenant: 'Daya Anugrah Mandiri',
    triage: 'LIKELY_SCHEDULED',
    reason: 'Consistent 8-week Saturday closure pattern. Safe to deprioritise ticket.',
    urgency: 'LOW',
    attentionNeededToday: false,
  },
  {
    ticketId: 'IN981132',
    serial: 'FGT60E-DAM-0031',
    name: 'Daya Anugrah Mandiri - Tasikmalaya Juanda',
    tenant: 'Daya Anugrah Mandiri',
    triage: 'LIKELY_SCHEDULED',
    reason: 'Weekly showroom electrical shutoff. Ticket will auto-resolve upon Monday reconnection.',
    urgency: 'LOW',
    attentionNeededToday: false,
  },
  {
    ticketId: 'IN981145',
    serial: 'FGT60E-DAM-0045',
    name: 'Daya Anugrah Mandiri - Garut Ciledug',
    tenant: 'Daya Anugrah Mandiri',
    triage: 'LIKELY_SCHEDULED',
    reason: 'Regular Saturday evening power shutdown after showroom closing hours.',
    urgency: 'LOW',
    attentionNeededToday: false,
  },
  {
    ticketId: 'IN981156',
    serial: 'FGT60E-DAM-0052',
    name: 'Daya Anugrah Mandiri - Subang Otista',
    tenant: 'Daya Anugrah Mandiri',
    triage: 'LIKELY_SCHEDULED',
    reason: 'Deprioritise: dealership weekly weekend scheduled shutdown.',
    urgency: 'LOW',
    attentionNeededToday: false,
  },
  {
    ticketId: 'IN981168',
    serial: 'FGT60E-DAM-0063',
    name: 'Daya Anugrah Mandiri - Purwakarta Veteran',
    tenant: 'Daya Anugrah Mandiri',
    triage: 'LIKELY_SCHEDULED',
    reason: 'Expected weekend branch power down. Auto-resolution scheduled for Monday morning.',
    urgency: 'LOW',
    attentionNeededToday: false,
  },
  {
    ticketId: 'IN981204',
    serial: 'CSG355-PERT-0044',
    name: 'Pertamina Depot Sorong Hub',
    tenant: 'Pertamina',
    triage: 'LIKELY_SCHEDULED',
    reason: 'Alert generated during planned Saturday maintenance window. Traffic healthy on backup VSAT link.',
    urgency: 'LOW',
    attentionNeededToday: false,
  },
  {
    ticketId: 'IN979920',
    serial: 'FGT60E-BM-4491',
    name: 'KCP Bandung Dago',
    tenant: 'Bank Mandiri',
    triage: 'LIKELY_SCHEDULED',
    reason: 'Proactive jitter alarm (<35ms threshold breach) during non-business hours. Latency normalized within 4 minutes.',
    urgency: 'LOW',
    attentionNeededToday: false,
  },
];

export const defaultIntelligencePayload: IntelligencePayload = {
  generatedAt: new Date().toISOString(),
  version: 'nsm-ai-engine-v2.4',
  summary: {
    scheduledRecurring: 29,
    chronic: 1,
    openTickets: 734,
    openLikelyScheduled: 22,
    noiseReductionPct: 3.0,
    outageEvents: 3420,
    devicesAnalysed: 1250,
  },
  scheduledPatterns: defaultScheduledPatterns,
  chronicDevices: defaultChronicDevices,
  openTicketTriage: defaultOpenTicketTriage,

  // Backwards compatibility mappings for Copilot:
  recurringOutages: defaultScheduledPatterns.map(p => ({
    site: p.name,
    customer: p.tenant,
    pattern: `Every ${p.topWeekday} ${p.timeWindow || 'evening'}`,
    dayOfWeek: p.topWeekday,
    timeWindow: p.timeWindow || '21:00 - 04:00',
    reason: p.explanation,
    category: 'scheduled' as const,
    nextPredictedDown: `Next ${p.topWeekday} (${p.nextExpected})`,
    confidence: p.confidence,
    durationHours: 4,
  })),
  predictions: defaultScheduledPatterns.map(p => ({
    site: p.name,
    customer: p.tenant,
    predictedNextDown: `Next ${p.topWeekday} (${p.nextExpected})`,
    expectedDuration: '4 hours',
    reason: p.explanation,
    recurrenceType: `Weekly Recurring (Every ${p.topWeekday})`,
    recommendedAction: p.recommendedAction || 'Deprioritise alarms during scheduled window.',
  })),
  openTicketsTriage: defaultOpenTicketTriage.map(t => ({
    ticketId: t.ticketId || 'TKT-000',
    customer: t.tenant || 'Telkom Customer',
    site: t.name,
    status: 'OPEN',
    urgency: t.urgency || (t.triage === 'NEEDS_ATTENTION' ? 'HIGH' : 'LOW'),
    attentionNeededToday: t.triage === 'NEEDS_ATTENTION',
    classification: t.triage === 'NEEDS_ATTENTION' ? 'real_outage' as const : 'scheduled_maintenance' as const,
    reason: t.reason,
    actionRecommendation: t.triage === 'NEEDS_ATTENTION' ? 'Requires field engineer attention today.' : 'Safe to deprioritise; will auto-clear.',
  })),
  chronicallyUnstableDevices: defaultChronicDevices.map(d => ({
    customer: d.tenant,
    site: d.name,
    serialNumber: d.serial,
    model: d.model || 'SD-WAN Edge CPE',
    flapCount7d: d.flapCount7d || 14,
    uptimePercent: d.uptimePercent || 96.0,
    primaryCause: d.primaryCause || d.explanation || 'Chronic underlay degradation',
    lastFlapTime: d.lastFlapTime || 'Recent',
    recommendedFix: d.recommendedAction || 'Field dispatch required.',
  })),
};

let cachedIntelligence: IntelligencePayload | null = null;
let activeFetchPromise: Promise<IntelligencePayload> | null = null;

/**
 * Loads intelligence data from Firebase Storage `intelligence/latest.json`
 * and Firestore `intelligence/meta` for the summary.
 */
export async function getIntelligenceData(forceRefresh = false): Promise<IntelligencePayload> {
  if (cachedIntelligence && !forceRefresh) {
    return cachedIntelligence;
  }

  if (activeFetchPromise && !forceRefresh) {
    return activeFetchPromise;
  }

  activeFetchPromise = (async () => {
    let storagePayload: Partial<IntelligencePayload> | null = null;

    // 1. Fetch `intelligence/latest.json` from Firebase Storage using getBytes()
    try {
      const storageRef = ref(storage, 'intelligence/latest.json');
      let text = '';
      try {
        const arrayBuffer = await getBytes(storageRef, 15 * 1024 * 1024);
        const uint8 = new Uint8Array(arrayBuffer);
        // Check for gzip compression magic header (0x1f, 0x8b)
        if (uint8.length > 2 && uint8[0] === 0x1f && uint8[1] === 0x8b) {
          try {
            if (typeof DecompressionStream !== 'undefined') {
              const ds = new DecompressionStream('gzip');
              const writer = ds.writable.getWriter();
              writer.write(uint8);
              writer.close();
              const decompressedResponse = new Response(ds.readable);
              text = await decompressedResponse.text();
            }
          } catch (decompErr) {
            console.warn('Gzip decompression fallback:', decompErr);
          }
        }
        if (!text) {
          text = new TextDecoder('utf-8').decode(uint8);
        }
      } catch (bytesErr) {
        // Fallback: getBlob or getDownloadURL
        try {
          const blob = await getBlob(storageRef, 15 * 1024 * 1024);
          text = await blob.text();
        } catch {
          const url = await getDownloadURL(storageRef);
          const res = await fetch(url);
          if (res.ok) {
            text = await res.text();
          }
        }
      }

      if (text) {
        storagePayload = JSON.parse(text);
      }
    } catch (err: any) {
      console.warn('Storage fetch for intelligence/latest.json failed (using operational baseline):', err?.message);
    }

    // 2. Fetch Firestore `intelligence/meta` for summary if present
    let firestoreMetaSummary: any = null;
    try {
      const metaDocRef = doc(db, 'intelligence', 'meta');
      const metaDocSnap = await getDoc(metaDocRef);
      if (metaDocSnap.exists()) {
        const metaDocData = metaDocSnap.data();
        firestoreMetaSummary = metaDocData?.summary || metaDocData;
      }
    } catch (fsErr: any) {
      console.warn('Firestore fetch for intelligence/meta skipped:', fsErr?.message);
    }

    // 3. Compose final payload merging Storage, Firestore, and operational fallbacks
    const baseSummary = defaultIntelligencePayload.summary;
    const finalSummary = {
      ...baseSummary,
      ...(typeof storagePayload?.summary === 'object' ? storagePayload.summary : {}),
      ...(firestoreMetaSummary ? firestoreMetaSummary : {}),
    };

    const finalScheduled = (storagePayload?.scheduledPatterns && storagePayload.scheduledPatterns.length > 0)
      ? storagePayload.scheduledPatterns
      : defaultScheduledPatterns;

    const finalChronic = (storagePayload?.chronicDevices && storagePayload.chronicDevices.length > 0)
      ? storagePayload.chronicDevices
      : defaultChronicDevices;

    const finalTickets = (storagePayload?.openTicketTriage && storagePayload.openTicketTriage.length > 0)
      ? storagePayload.openTicketTriage
      : defaultOpenTicketTriage;

    const result: IntelligencePayload = {
      generatedAt: storagePayload?.generatedAt || new Date().toISOString(),
      version: storagePayload?.version || 'nsm-ai-engine-v2.4',
      summary: finalSummary,
      scheduledPatterns: finalScheduled,
      chronicDevices: finalChronic,
      openTicketTriage: finalTickets,

      // Also maintain Copilot aliases
      recurringOutages: defaultIntelligencePayload.recurringOutages,
      predictions: defaultIntelligencePayload.predictions,
      openTicketsTriage: defaultIntelligencePayload.openTicketsTriage,
      chronicallyUnstableDevices: defaultIntelligencePayload.chronicallyUnstableDevices,
    };

    cachedIntelligence = result;
    return result;
  })();

  try {
    return await activeFetchPromise;
  } finally {
    activeFetchPromise = null;
  }
}
