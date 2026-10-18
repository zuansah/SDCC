import { ToolDeclaration, ToolExecutionContext } from '../types';

export const helpText = {
  menu: 'Monitoring',
  summary: 'Operation ▸ Monitoring provides real-time geospatial map view of all SD-WAN edges across Indonesia. Color-coded by live status (UP, DOWN, WARNING), with clustering and telemetry.',
  mainActions: [
    'View interactive live map of all SD-WAN routers across Witel/Regional',
    'Click edge pins for live telemetry, IPsec tunnels, latency, and underlay status',
    'Filter edges by status, tenant, principal, or location',
  ],
  filters: ['Status (UP / DOWN / WARNING)', 'Tenant / Customer', 'Witel / Regional', 'Vendor / Principal'],
};

export const declarations: ToolDeclaration[] = [
  {
    name: 'search_devices',
    description: 'Searches for SD-WAN edge devices across live telemetry and inventory by text, customer/tenant, status (UP/DOWN), or witel/region.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Search term for name, serial, hostname, SID, or address' },
        tenant: { type: 'STRING', description: 'Filter by tenant/customer name (e.g. Bank Mandiri, BPJS)' },
        status: { type: 'STRING', enum: ['UP', 'DOWN', 'WARNING', 'ALL'], description: 'Edge operational state' },
        witel: { type: 'STRING', description: 'Telkom Witel or Regional' },
      },
    },
  },
  {
    name: 'get_device',
    description: 'Retrieves full joined record for a specific SD-WAN edge using its serial number, SID, hostname, or Trace ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING', description: 'Device Serial Number, SID, Hostname, or Trace ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'devices_near',
    description: 'Finds SD-WAN edge devices within a specified radius (km) of coordinates (lat, lng) or a named Indonesian city/place.',
    parameters: {
      type: 'OBJECT',
      properties: {
        lat: { type: 'NUMBER', description: 'Latitude (-11 to 6)' },
        lng: { type: 'NUMBER', description: 'Longitude (95 to 141)' },
        place: { type: 'STRING', description: 'Named place/city in Indonesia (e.g. Kendari, Bandung, Surabaya, Medan)' },
        radiusKm: { type: 'NUMBER', description: 'Search radius in kilometers (default 25km)' },
      },
    },
  },
  {
    name: 'propose_navigation_to_map',
    description: 'Proposes navigating to the Monitoring map centered on a specific device, city, or status filter.',
    parameters: {
      type: 'OBJECT',
      properties: {
        filter: { type: 'STRING', description: 'Status filter (e.g. DOWN, Bank Mandiri)' },
        deviceId: { type: 'STRING', description: 'Device serial to center map on' },
      },
    },
  },
];

// Reference coordinates for major Indonesian cities
const PLACE_COORDS: Record<string, { lat: number; lng: number }> = {
  jakarta: { lat: -6.2088, lng: 106.8456 },
  bandung: { lat: -6.9175, lng: 107.6191 },
  surabaya: { lat: -7.2575, lng: 112.7521 },
  medan: { lat: 3.5952, lng: 98.6722 },
  semarang: { lat: -6.9667, lng: 110.4167 },
  makassar: { lat: -5.1477, lng: 119.4327 },
  kendari: { lat: -3.9985, lng: 122.5126 },
  denpasar: { lat: -8.6705, lng: 115.2126 },
  palembang: { lat: -2.9761, lng: 104.7754 },
  balikpapan: { lat: -1.2379, lng: 116.8289 },
  samarinda: { lat: -0.5022, lng: 117.1536 },
  yogyakarta: { lat: -7.7956, lng: 110.3695 },
  manado: { lat: 1.4748, lng: 124.8421 },
  jayapura: { lat: -2.5916, lng: 140.6690 },
};

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const handlers = {
  search_devices: async (args: any, context: ToolExecutionContext) => {
    const assets = context.sharedData?.inventoryPayload?.assets || [];
    const ctrl = context.sharedData?.controllersPayload;
    const downSerials = new Set<string>();

    if (ctrl?.controllers) {
      Object.values(ctrl.controllers).forEach((c: any) => {
        (c.downEdges || []).forEach((d: any) => {
          if (d.serial) downSerials.add(d.serial.toLowerCase());
        });
      });
    }

    let results = assets.map((a: any) => {
      const isDown = downSerials.has((a.serial_number || '').toLowerCase());
      return {
        serial: a.serial_number,
        name: a.hostname || a.site_name || a.serial_number,
        tenant: a.tenant_name || a.tenant_canonical || 'Telkom Customer',
        sid: a.sid || '—',
        status: isDown ? 'DOWN' : (a.status || 'UP'),
        witel: a.witel || '—',
        regional: a.regional || '—',
        model: a.device_model || 'SD-WAN Edge',
        lat: a.latitude,
        lng: a.longitude,
      };
    });

    if (args.status && args.status !== 'ALL') {
      const st = args.status.toUpperCase();
      results = results.filter((r: any) => r.status.toUpperCase() === st);
    }

    if (args.tenant) {
      const tn = args.tenant.toLowerCase();
      results = results.filter((r: any) => r.tenant.toLowerCase().includes(tn));
    }

    if (args.witel) {
      const wt = args.witel.toLowerCase();
      results = results.filter((r: any) =>
        r.witel.toLowerCase().includes(wt) || r.regional.toLowerCase().includes(wt)
      );
    }

    if (args.query) {
      const q = args.query.toLowerCase();
      results = results.filter((r: any) =>
        r.serial.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.tenant.toLowerCase().includes(q) ||
        r.sid.toLowerCase().includes(q) ||
        r.witel.toLowerCase().includes(q)
      );
    }

    const total = results.length;
    return {
      total,
      count: Math.min(total, 25),
      devices: results.slice(0, 25),
    };
  },

  get_device: async (args: any, context: ToolExecutionContext) => {
    const id = (args.id || '').trim().toLowerCase();
    const assets = context.sharedData?.inventoryPayload?.assets || [];
    const ctrl = context.sharedData?.controllersPayload;
    const intel = context.sharedData?.intelligencePayload;

    const asset = assets.find((a: any) =>
      (a.serial_number || '').toLowerCase() === id ||
      (a.sid || '').toLowerCase() === id ||
      (a.hostname || '').toLowerCase() === id ||
      (a.trace_id || '').toLowerCase() === id
    );

    if (!asset) {
      return { error: `Device '${args.id}' not found in active inventory or telemetry records.` };
    }

    // Check if down in controller
    let isDown = false;
    let controllerName = 'Versa-Director-01';
    let downReason = '';

    if (ctrl?.controllers) {
      Object.entries(ctrl.controllers).forEach(([cName, c]: [string, any]) => {
        const foundDown = (c.downEdges || []).find((d: any) =>
          (d.serial || '').toLowerCase() === asset.serial_number.toLowerCase()
        );
        if (foundDown) {
          isDown = true;
          controllerName = cName;
          downReason = foundDown.reason || 'Underlay link unreachable';
        }
      });
    }

    // Check intelligence patterns
    const scheduled = intel?.scheduledPatterns?.find((p: any) =>
      p.serial.toLowerCase() === asset.serial_number.toLowerCase()
    );
    const chronic = intel?.chronicDevices?.find((c: any) =>
      c.serial.toLowerCase() === asset.serial_number.toLowerCase()
    );

    return {
      serial: asset.serial_number,
      hostname: asset.hostname || asset.site_name,
      tenant: asset.tenant_name || asset.tenant_canonical,
      sid: asset.sid || '—',
      status: isDown ? 'DOWN' : 'UP',
      controller: controllerName,
      model: asset.device_model || 'FortiGate / Versa Edge',
      location: {
        witel: asset.witel || '—',
        regional: asset.regional || '—',
        address: asset.address || '—',
        lat: asset.latitude,
        lng: asset.longitude,
      },
      telemetry: {
        isDown,
        downReason: isDown ? downReason : undefined,
        uptime: isDown ? 'Offline' : '99.94%',
      },
      aiIntelligence: {
        pattern: scheduled ? 'SCHEDULED_RECURRING' : (chronic ? 'CHRONIC' : 'NORMAL'),
        topWeekday: scheduled?.topWeekday,
        nextExpected: scheduled?.nextExpected,
        explanation: scheduled?.explanation || chronic?.explanation,
        recommendedAction: scheduled?.recommendedAction || chronic?.recommendedAction,
      },
    };
  },

  devices_near: async (args: any, context: ToolExecutionContext) => {
    let targetLat = args.lat;
    let targetLng = args.lng;
    const radius = args.radiusKm || 25;

    if (args.place) {
      const pl = args.place.trim().toLowerCase();
      const coords = PLACE_COORDS[pl];
      if (coords) {
        targetLat = coords.lat;
        targetLng = coords.lng;
      }
    }

    if (targetLat === undefined || targetLng === undefined) {
      return { error: 'Please provide either coordinates (lat, lng) or a recognised city name (e.g. Kendari, Bandung, Jakarta, Medan).' };
    }

    const assets = context.sharedData?.inventoryPayload?.assets || [];
    const nearby = assets
      .filter((a: any) => typeof a.latitude === 'number' && typeof a.longitude === 'number')
      .map((a: any) => {
        const d = distanceKm(targetLat, targetLng, a.latitude, a.longitude);
        return {
          serial: a.serial_number,
          name: a.hostname || a.site_name,
          tenant: a.tenant_name,
          distanceKm: Math.round(d * 10) / 10,
          lat: a.latitude,
          lng: a.longitude,
          status: a.status || 'UP',
        };
      })
      .filter(item => item.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return {
      searchCenter: { lat: targetLat, lng: targetLng, place: args.place },
      radiusKm: radius,
      totalFound: nearby.length,
      devices: nearby.slice(0, 25),
    };
  },

  propose_navigation_to_map: async (args: any, context: ToolExecutionContext) => {
    context.proposeAction({
      type: 'navigation',
      title: 'Navigate to Monitoring Map',
      description: `Open live map view ${args.deviceId ? `centered on ${args.deviceId}` : (args.filter ? `with filter '${args.filter}'` : '')}`,
      payload: {
        view: 'monitoring',
        deviceId: args.deviceId,
        filter: args.filter,
      },
    });

    return {
      status: 'proposed',
      action: 'navigation',
      message: 'Navigation to Monitoring map proposed.',
    };
  },
};
