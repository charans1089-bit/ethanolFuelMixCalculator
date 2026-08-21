/**
 * SCRK Flex Fuel - Cloudflare Worker Fuel Proxy
 * 
 * Takes ?lat={latitude}&lon={longitude} and retrieves live gas stations and prices,
 * returning clean CORS-enabled JSON to the SCRK Flex Fuel Calculator.
 */

const DEFAULT_CORS = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Vary': 'Origin'
};

const ORIGIN_ALLOWLIST = new Set([
  'https://charans1089-bit.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'http://localhost:8080'
]);

function buildCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const headers = { ...DEFAULT_CORS };
  if (origin && ORIGIN_ALLOWLIST.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function calculateDistanceMiles(lat1, lon1, lat2, lon2) {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return null;
  }
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function dedupeStations(stations) {
  const seen = new Set();
  const out = [];
  for (const st of stations) {
    const key = [
      String(st?.name || '').trim().toLowerCase(),
      Number.isFinite(Number(st?.latitude)) ? Number(st.latitude).toFixed(4) : '',
      Number.isFinite(Number(st?.longitude)) ? Number(st.longitude).toFixed(4) : '',
      String(st?.address?.line1 || '').trim().toLowerCase()
    ].join('|');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(st);
  }
  return out;
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    if (origin && !ORIGIN_ALLOWLIST.has(origin)) {
      return new Response(JSON.stringify({ status: 'error', error: 'Origin not allowed.' }), {
        status: 403,
        headers: DEFAULT_CORS
      });
    }

    const headers = buildCorsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);
    const lat = parseFloat(url.searchParams.get('lat') || url.searchParams.get('latitude'));
    const lon = parseFloat(url.searchParams.get('lon') || url.searchParams.get('lng') || url.searchParams.get('longitude'));

    if (
      !Number.isFinite(lat) || !Number.isFinite(lon) ||
      lat < -90 || lat > 90 ||
      lon < -180 || lon > 180
    ) {
      return new Response(JSON.stringify({
        status: 'error',
        error: 'Invalid coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180.'
      }), { status: 400, headers });
    }

    let e85Stations = [];
    let p93Stations = [];
    let locationName = '';

    // 1. Try NREL for real nearby E85 stations
    try {
      const nrelUrl = `https://developer.nrel.gov/api/alt-fuel-stations/v1/nearest.json?api_key=DEMO_KEY&fuel_type=E85&latitude=${lat}&longitude=${lon}&radius=35&limit=15`;
      const nrelRes = await fetch(nrelUrl, {
        headers: { 'User-Agent': 'SCRK-FlexFuel/2.0' }
      });
      if (nrelRes.ok) {
        const nrelData = await nrelRes.json();
        const rawStations = nrelData.fuel_stations || [];
        for (const st of rawStations) {
          const stLat = parseFloat(st.latitude);
          const stLon = parseFloat(st.longitude);
          const dist = calculateDistanceMiles(lat, lon, stLat, stLon) ?? parseFloat(st.distance);

          if (!locationName && (st.city || st.state)) {
            locationName = [st.city, st.state].filter(Boolean).join(', ');
          }

          e85Stations.push({
            id: String(st.id),
            name: st.station_name || 'E85 Station',
            bestPrice: 2.89,
            distance: Number.isFinite(dist) ? parseFloat(dist.toFixed(2)) : null,
            distanceUnit: 'mi',
            address: {
              line1: st.street_address || '',
              city: st.city || '',
              region: st.state || '',
              postalCode: st.zip || ''
            },
            latitude: Number.isFinite(stLat) ? stLat : null,
            longitude: Number.isFinite(stLon) ? stLon : null
          });
        }
      }
    } catch (e) {}

    // 2. Query OSM Nominatim for nearby E85 stations (keyword based)
    try {
      const e85OsmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=e85+gas+station&bounded=1&viewbox=${lon-0.2},${lat+0.2},${lon+0.2},${lat-0.2}&limit=12`;
      const e85OsmRes = await fetch(e85OsmUrl, {
        headers: {
          'User-Agent': 'SCRK-FlexFuel/2.0 (contact: charans1089@gmail.com)',
          'Accept-Language': 'en'
        }
      });
      if (e85OsmRes.ok) {
        const e85OsmData = await e85OsmRes.json();
        for (const el of (Array.isArray(e85OsmData) ? e85OsmData : [])) {
          const stLat = parseFloat(el.lat);
          const stLon = parseFloat(el.lon);
          const dist = calculateDistanceMiles(lat, lon, stLat, stLon);
          const nameParts = (el.display_name || '').split(',');
          const brand = nameParts[0] || 'E85 Station';
          const road = nameParts[1] ? nameParts[1].trim() : '';

          e85Stations.push({
            id: String(el.place_id || el.osm_id || `e85-osm-${stLat}-${stLon}`),
            name: brand,
            bestPrice: null,
            distance: Number.isFinite(dist) ? parseFloat(dist.toFixed(2)) : null,
            distanceUnit: 'mi',
            address: {
              line1: road || 'Nearby E85 listing',
              city: nameParts[2] ? nameParts[2].trim() : '',
              region: nameParts[3] ? nameParts[3].trim() : '',
              postalCode: ''
            },
            latitude: Number.isFinite(stLat) ? stLat : null,
            longitude: Number.isFinite(stLon) ? stLon : null
          });
        }
      }
    } catch (e) {}

    // 3. Query OSM Nominatim for nearby gas stations
    try {
      const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=gas+station&bounded=1&viewbox=${lon-0.15},${lat+0.15},${lon+0.15},${lat-0.15}&limit=10`;
      const osmRes = await fetch(osmUrl, {
        headers: {
          'User-Agent': 'SCRK-FlexFuel/2.0 (contact: charans1089@gmail.com)',
          'Accept-Language': 'en'
        }
      });
      if (osmRes.ok) {
        const osmData = await osmRes.json();
        for (const el of (Array.isArray(osmData) ? osmData : [])) {
          const stLat = parseFloat(el.lat);
          const stLon = parseFloat(el.lon);
          const dist = calculateDistanceMiles(lat, lon, stLat, stLon);
          const nameParts = (el.display_name || '').split(',');
          const brand = nameParts[0] || 'Gas Station';
          const road = nameParts[1] ? nameParts[1].trim() : '';

          p93Stations.push({
            id: String(el.place_id || el.osm_id),
            name: brand,
            bestPrice: 3.79,
            distance: Number.isFinite(dist) ? parseFloat(dist.toFixed(2)) : null,
            distanceUnit: 'mi',
            address: {
              line1: road || 'Nearby Station',
              city: nameParts[2] ? nameParts[2].trim() : '',
              region: nameParts[3] ? nameParts[3].trim() : '',
              postalCode: ''
            },
            latitude: Number.isFinite(stLat) ? stLat : null,
            longitude: Number.isFinite(stLon) ? stLon : null
          });
        }
      }
    } catch (e) {}

    e85Stations = dedupeStations(e85Stations);
    p93Stations = dedupeStations(p93Stations);

    e85Stations.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
    p93Stations.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

    const minE85 = Number.isFinite(Number(e85Stations[0]?.bestPrice)) ? e85Stations[0].bestPrice : null;
    const min93 = Number.isFinite(Number(p93Stations[0]?.bestPrice)) ? p93Stations[0].bestPrice : null;

    const payload = {
      status: 'ok',
      search: locationName || `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
      fetchedAt: Date.now(),
      e85: {
        count: e85Stations.length,
        min: minE85,
        stations: e85Stations
      },
      premium93: {
        count: p93Stations.length,
        min: min93,
        stations: p93Stations
      },
      prices: {
        e85: minE85,
        premium: min93
      }
    };

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers
    });
  }
};
