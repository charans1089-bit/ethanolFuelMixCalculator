/**
 * SCRK Flex Fuel - Cloudflare Worker Fuel Proxy
 * 
 * Takes ?lat={latitude}&lon={longitude} and queries live GasBuddy station data,
 * returning CORS-enabled JSON with E85 and 93 Premium stations, prices, and maps.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};

const GASBUDDY_GRAPHQL_URL = 'https://gasbuddy.com/graphql';

const GASBUDDY_QUERY = `
query LocationBySearchTerm($brandId: Int, $cursor: String, $fuel: Int, $lat: Float, $lng: Float, $maxAge: Int, $search: String) {
  locationBySearchTerm(lat: $lat, lng: $lng, search: $search) {
    displayName
    latitude
    longitude
    stations(brandId: $brandId, cursor: $cursor, fuel: $fuel, maxAge: $maxAge) {
      count
      results {
        id
        name
        address {
          line1
          locality
          region
          postalCode
        }
        latitude
        longitude
        prices {
          fuelProduct
          credit {
            price
            postedTime
          }
          cash {
            price
            postedTime
          }
        }
      }
    }
  }
}
`;

function parseFuelPrice(priceObj) {
  if (!priceObj) return null;
  const cash = Number(priceObj.cash?.price);
  const credit = Number(priceObj.credit?.price);
  if (Number.isFinite(cash) && cash > 0) return cash;
  if (Number.isFinite(credit) && credit > 0) return credit;
  return null;
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

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const lat = parseFloat(url.searchParams.get('lat') || url.searchParams.get('latitude'));
    const lon = parseFloat(url.searchParams.get('lon') || url.searchParams.get('lng') || url.searchParams.get('longitude'));

    if (isNaN(lat) || isNaN(lon)) {
      return new Response(JSON.stringify({
        error: 'Missing or invalid lat/lon parameters. Example: /?lat=42.9&lon=-83.7'
      }), { status: 400, headers: CORS_HEADERS });
    }

    try {
      const gbResponse = await fetch(GASBUDDY_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        body: JSON.stringify({
          operationName: 'LocationBySearchTerm',
          query: GASBUDDY_QUERY,
          variables: {
            lat: lat,
            lng: lon,
            maxAge: 0,
            search: null
          }
        })
      });

      if (!gbResponse.ok) {
        return new Response(JSON.stringify({
          error: `GasBuddy upstream returned status ${gbResponse.status}`
        }), { status: 502, headers: CORS_HEADERS });
      }

      const gbData = await gbResponse.json();
      const locationInfo = gbData?.data?.locationBySearchTerm;
      const rawStations = locationInfo?.stations?.results || [];

      const e85Stations = [];
      const p93Stations = [];

      for (const st of rawStations) {
        const stLat = parseFloat(st.latitude);
        const stLon = parseFloat(st.longitude);
        const distance = calculateDistanceMiles(lat, lon, stLat, stLon);

        const stationObj = {
          id: st.id,
          name: st.name,
          address: {
            line1: st.address?.line1 || '',
            city: st.address?.locality || '',
            region: st.address?.region || '',
            postalCode: st.address?.postalCode || ''
          },
          latitude: Number.isFinite(stLat) ? stLat : null,
          longitude: Number.isFinite(stLon) ? stLon : null,
          distance: Number.isFinite(distance) ? parseFloat(distance.toFixed(2)) : null,
          distanceUnit: 'mi'
        };

        const prices = Array.isArray(st.prices) ? st.prices : [];
        for (const p of prices) {
          const product = String(p.fuelProduct || '').toLowerCase();
          const price = parseFuelPrice(p);

          if (price && price > 0) {
            if (product.includes('e85') || product.includes('ethanol') || product === '7') {
              e85Stations.push({
                ...stationObj,
                bestPrice: price,
                cash: Number(p.cash?.price) || null,
                credit: Number(p.credit?.price) || null
              });
            }
            if (product.includes('premium') || product.includes('93') || product === '3') {
              p93Stations.push({
                ...stationObj,
                bestPrice: price,
                cash: Number(p.cash?.price) || null,
                credit: Number(p.credit?.price) || null
              });
            }
          }
        }
      }

      e85Stations.sort((a, b) => a.bestPrice - b.bestPrice);
      p93Stations.sort((a, b) => a.bestPrice - b.bestPrice);

      const minE85 = e85Stations.length ? e85Stations[0].bestPrice : null;
      const min93 = p93Stations.length ? p93Stations[0].bestPrice : null;

      const payload = {
        status: 'ok',
        search: locationInfo?.displayName || `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
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
        headers: CORS_HEADERS
      });

    } catch (err) {
      return new Response(JSON.stringify({
        error: err?.message || 'Failed to fetch station prices'
      }), { status: 500, headers: CORS_HEADERS });
    }
  }
};
