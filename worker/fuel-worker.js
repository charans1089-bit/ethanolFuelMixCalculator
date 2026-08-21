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

function normalizeText(value) {
  return String(value || '').trim();
}

function buildAddressFromTags(tags) {
  const line1 = [tags?.['addr:housenumber'], tags?.['addr:street']].filter(Boolean).join(' ').trim();
  return {
    line1,
    line2: normalizeText(tags?.['addr:unit']),
    city: normalizeText(tags?.['addr:city'] || tags?.['addr:town'] || tags?.['addr:village']),
    region: normalizeText(tags?.['addr:state']),
    postalCode: normalizeText(tags?.['addr:postcode'])
  };
}

function buildOverpassStation(element, lat, lon, fallbackName) {
  const tags = element?.tags || {};
  const stLat = Number(element?.lat);
  const stLon = Number(element?.lon);
  if (!Number.isFinite(stLat) || !Number.isFinite(stLon)) return null;

  const address = buildAddressFromTags(tags);
  return {
    id: String(element?.id || `${stLat},${stLon}`),
    name: normalizeText(tags.name || tags.brand || tags.operator || fallbackName || 'Fuel Station'),
    bestPrice: null,
    distance: (() => {
      const dist = calculateDistanceMiles(lat, lon, stLat, stLon);
      return Number.isFinite(dist) ? parseFloat(dist.toFixed(2)) : null;
    })(),
    distanceUnit: 'mi',
    address,
    latitude: stLat,
    longitude: stLon,
    source: 'overpass'
  };
}

async function fetchOverpassStations(query) {
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'User-Agent': 'SCRK-FlexFuel/2.0 (contact: charans1089@gmail.com)'
    },
    body: query
  });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data?.elements) ? data.elements : [];
}

const NLR_API_URL = 'https://developer.nlr.gov/api/alt-fuel-stations/v1/nearest.json';
const DEFAULT_NLR_KEY = 'CWNYli7U9J8lNy38iRrSl0EceyXCjjTPsYeH1ffU';

const KNOWN_DUAL_FUEL_BRANDS = [
  'sheetz', 'wawa', 'sunoco', 'speedway', 'meijer', 'buc-ee', 'cumberland',
  'mobil', 'exxon', 'shell', 'bp', 'marathon', 'thorntons', 'casey',
  'kwik trip', 'quiktrip', 'circle k', 'getgo', 'turkey hill', 'pilot',
  'flying j', "love's", 'racetrac', 'murphy', 'phillips 66', 'sinclair',
  'citgo', 'valero', 'chevron'
];

function isKnownDualFuelBrand(name) {
  const lower = String(name || '').toLowerCase();
  return KNOWN_DUAL_FUEL_BRANDS.some(b => lower.includes(b));
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

    // 1. Query NLR (National Laboratory of the Rockies AFDC API) for verified nearby E85 stations
    try {
      const apiKey = env.NLR_API_KEY || DEFAULT_NLR_KEY;
      const nlrUrl = `${NLR_API_URL}?api_key=${encodeURIComponent(apiKey)}&fuel_type=E85&latitude=${lat}&longitude=${lon}&radius=35&status=E&access=public&limit=20`;
      const nlrRes = await fetch(nlrUrl, {
        headers: { 'User-Agent': 'SCRK-FlexFuel/2.0' }
      });
      if (nlrRes.ok) {
        const nlrData = await nlrRes.json();
        const rawStations = nlrData.fuel_stations || [];
        for (const st of rawStations) {
          const stLat = parseFloat(st.latitude);
          const stLon = parseFloat(st.longitude);
          const dist = calculateDistanceMiles(lat, lon, stLat, stLon) ?? parseFloat(st.distance);

          if (!locationName && (st.city || st.state)) {
            locationName = [st.city, st.state].filter(Boolean).join(', ');
          }

          const stName = st.station_name || 'E85 Station';
          const isDual = isKnownDualFuelBrand(stName);

          e85Stations.push({
            id: String(st.id),
            name: stName,
            brand: isDual ? stName : null,
            phone: st.station_phone || null,
            accessDaysTime: st.access_days_time || null,
            cardsAccepted: st.cards_accepted || null,
            hasBoth: isDual,
            fuelTypes: isDual ? ['E85', '93'] : ['E85'],
            bestPrice: null,
            distance: Number.isFinite(dist) ? parseFloat(dist.toFixed(2)) : null,
            distanceUnit: 'mi',
            address: {
              line1: st.street_address || '',
              city: st.city || '',
              region: st.state || '',
              postalCode: st.zip || ''
            },
            latitude: Number.isFinite(stLat) ? stLat : null,
            longitude: Number.isFinite(stLon) ? stLon : null,
            source: 'nlr'
          });
        }
      }
    } catch (e) { }

    // 2. Query Overpass for amenity=fuel stations explicitly tagged with E85 support
    try {
      const e85Query = `[out:json][timeout:15];(
        node(around:30000,${lat},${lon})[amenity=fuel][fuel:e85=yes];
        way(around:30000,${lat},${lon})[amenity=fuel][fuel:e85=yes];
        relation(around:30000,${lat},${lon})[amenity=fuel][fuel:e85=yes];
      );out center tags;`;
      const e85Elements = await fetchOverpassStations(e85Query);
      for (const el of e85Elements) {
        const station = buildOverpassStation({
          ...el,
          lat: el.lat ?? el.center?.lat,
          lon: el.lon ?? el.center?.lon
        }, lat, lon, 'E85 Station');
        if (station) {
          if (!locationName && (station.address.city || station.address.region)) {
            locationName = [station.address.city, station.address.region].filter(Boolean).join(', ');
          }
          const isDual = isKnownDualFuelBrand(station.name);
          station.hasBoth = isDual;
          station.fuelTypes = isDual ? ['E85', '93'] : ['E85'];
          e85Stations.push(station);
        }
      }
    } catch (e) { }

    // 3. Query Overpass for real nearby fuel stations (93 candidates)
    try {
      const p93Query = `[out:json][timeout:15];(
        node(around:12000,${lat},${lon})[amenity=fuel];
        way(around:12000,${lat},${lon})[amenity=fuel];
        relation(around:12000,${lat},${lon})[amenity=fuel];
      );out center tags;`;
      const p93Elements = await fetchOverpassStations(p93Query);
      for (const el of p93Elements) {
        const station = buildOverpassStation({
          ...el,
          lat: el.lat ?? el.center?.lat,
          lon: el.lon ?? el.center?.lon
        }, lat, lon, 'Fuel Station');
        if (station) {
          if (!locationName && (station.address.city || station.address.region)) {
            locationName = [station.address.city, station.address.region].filter(Boolean).join(', ');
          }
          station.fuelTypes = ['93'];
          p93Stations.push(station);
        }
      }
    } catch (e) { }

    e85Stations = dedupeStations(e85Stations);
    p93Stations = dedupeStations(p93Stations);

    // Cross-reference E85 stations with 93 stations: if within 0.1 miles, tag as dual-fuel
    for (const e85St of e85Stations) {
      if (!e85St.hasBoth && Number.isFinite(e85St.latitude) && Number.isFinite(e85St.longitude)) {
        const near93 = p93Stations.some(p93 => {
          if (!Number.isFinite(p93.latitude) || !Number.isFinite(p93.longitude)) return false;
          const dist = calculateDistanceMiles(e85St.latitude, e85St.longitude, p93.latitude, p93.longitude);
          return Number.isFinite(dist) && dist <= 0.1;
        });
        if (near93) {
          e85St.hasBoth = true;
          e85St.fuelTypes = ['E85', '93'];
        }
      }
    }

    e85Stations.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
    p93Stations.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

    const minE85 = e85Stations.map(st => Number(st?.bestPrice)).find(value => Number.isFinite(value) && value > 0) ?? null;
    const min93 = p93Stations.map(st => Number(st?.bestPrice)).find(value => Number.isFinite(value) && value > 0) ?? null;

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
