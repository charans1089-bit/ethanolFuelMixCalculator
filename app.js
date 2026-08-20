const TANK = 16.6;
// 9 Full Ticks to properly support 'F' = 16.6
const LEVELS = [
  { gal: 0, label: 'E' },
  { gal: 2.1, label: '⅛' },
  { gal: 4.2, label: '¼' },
  { gal: 6.2, label: '⅜' },
  { gal: 8.3, label: '½' },
  { gal: 10.4, label: '⅝' },
  { gal: 12.5, label: '¾' },
  { gal: 14.5, label: '⅞' },
  { gal: 16.6, label: 'F' }
];

const GOOGLE_FORM_ACTION_URL = "https://docs.google.com/forms/d/e/1FAIpQLScfYRQp2e6oH524g83RI2Hf2xDz1DRJLj2mt2uc8xBrLJ8g9g/formResponse";
const FORM_ENTRY_DATE = "entry.1873002234";
const FORM_ENTRY_STATION = "entry.490270945";
const FORM_ENTRY_E85 = "entry.391979914";
const FORM_ENTRY_93 = "entry.1998665240";
const FORM_ENTRY_ETH = "entry.1111191565";
const TODO_FORM_ENTRY_AP_ETH = "TODO_SET_AP_ETH_FORM_ENTRY_ID";
const TODO_FORM_ENTRY_STATION_ETH = "TODO_SET_STATION_ETH_FORM_ENTRY_ID";
const TODO_FORM_ENTRY_FILL_COST = "TODO_SET_FILL_COST_FORM_ENTRY_ID";
const TODO_FORM_ENTRY_FILL_MODE = "TODO_SET_FILL_MODE_FORM_ENTRY_ID";
const TODO_FORM_ENTRY_AMBIENT_TEMP = "TODO_SET_AMBIENT_TEMP_FORM_ENTRY_ID";
const TODO_FORM_ENTRY_MAX_ETH = "TODO_SET_MAX_ETH_FORM_ENTRY_ID";
const TODO_FORM_ENTRY_PRICE_E85 = "TODO_SET_PRICE_E85_FORM_ENTRY_ID";
const TODO_FORM_ENTRY_PRICE_93 = "TODO_SET_PRICE_93_FORM_ENTRY_ID";
const TODO_FORM_ENTRY_ACTUAL_E85 = "TODO_SET_ACTUAL_E85_FORM_ENTRY_ID";
const TODO_FORM_ENTRY_ACTUAL_93 = "TODO_SET_ACTUAL_93_FORM_ENTRY_ID";

const DEFAULTS = {
  curEth: 10,
  tgtEth: 45,
  maxEth: 70,
  pumpE85: 85,
  pumpGas: 10,
  ambientTempF: 70,
  priceE85: 2.89,
  price93: 3.79,
  fillMode: 'full',
  addGallons: 0,
  syncEnabled: true
};

const WEATHER_API_BASE = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_REVERSE_GEOCODE_BASE = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const WEATHER_REVERSE_GEOCODE_FALLBACK_BASE = 'https://nominatim.openstreetmap.org/reverse';
const WEATHER_CACHE_KEY = 'wrxWeatherCache';
const FUEL_PRICES_SNAPSHOT_PATH = 'data/fuel-prices.json';
const FUEL_PRICES_CACHE_KEY = 'wrxFuelPricesSnapshot';

let fuelLogs = [];
let currentE85Needed = '0.00';
let currentC93Needed = '0.00';
let currentEthResult = 0;
let lastModalTrigger = null;
let currentMode = 'calc';
let editingLogId = null;

function safeGetItem(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (e) {
    return fallback;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (e) {
  }
}

function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
  }
}

function clampNumber(value, min, max, fallback) {
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function floor2(n) {
  return Math.floor(n * 100) / 100;
}

function escHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseOptionalNumber(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const raw = String(el.value).trim();
  if (raw === '') return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function formatOptionalNumber(value) {
  return value === null || value === undefined || value === ''
    ? '—'
    : Number(value).toFixed(2);
}

function formatMoney(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return '$' + Number(value).toFixed(2);
}

function safeFixed(value, digits) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
}

function formatWeatherCacheTime(value) {
  const ts = Number(value);
  if (!Number.isFinite(ts)) return 'recently';
  try {
    return new Date(ts).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
  } catch (e) {
    return 'recently';
  }
}

function monthSeason(monthIndex) {
  if (monthIndex === 11 || monthIndex === 0 || monthIndex === 1) return 'winter';
  if (monthIndex >= 2 && monthIndex <= 4) return 'spring';
  if (monthIndex >= 5 && monthIndex <= 7) return 'summer';
  return 'fall';
}

function defaultAmbientFromSeason() {
  const season = monthSeason(new Date().getMonth());
  if (season === 'winter') return 30;
  if (season === 'spring') return 55;
  if (season === 'summer') return 85;
  return 60;
}

function getWeatherCache() {
  const raw = safeGetItem(WEATHER_CACHE_KEY, '');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && Number.isFinite(Number(parsed.tempF)) ? parsed : null;
  } catch (e) {
    return null;
  }
}

function saveWeatherCache(tempF, sourceLabel, detailLabel) {
  const payload = {
    tempF: Number(tempF),
    sourceLabel: sourceLabel || 'Open-Meteo',
    detailLabel: detailLabel || '',
    updatedAt: Date.now()
  };
  safeSetItem(WEATHER_CACHE_KEY, JSON.stringify(payload));
}

function setWeatherSourceLabel(message, kind) {
  const sourceEl = document.getElementById('weather-source-label');
  if (sourceEl) {
    sourceEl.textContent = message;
    sourceEl.dataset.kind = kind || 'info';
  }
}

function updateWeatherUIStatus(message, kind) {
  const statusEl = document.getElementById('weather-status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.dataset.kind = kind || 'info';
  }
}

function getFuelSnapshotCache() {
  const raw = safeGetItem(FUEL_PRICES_CACHE_KEY, '');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function saveFuelSnapshotCache(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  safeSetItem(FUEL_PRICES_CACHE_KEY, JSON.stringify(snapshot));
}

function setFuelSourceLabel(message, kind) {
  const sourceEl = document.getElementById('fuel-source-label');
  if (sourceEl) {
    sourceEl.textContent = message;
    sourceEl.dataset.kind = kind || 'info';
  }
}

function updateFuelUIStatus(message, kind) {
  const statusEl = document.getElementById('fuel-status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.dataset.kind = kind || 'info';
  }
}

function formatFuelTime(value) {
  if (!value) return 'unknown time';
  try {
    return new Date(value).toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return 'unknown time';
  }
}

function formatStationAddress(station) {
  if (!station || typeof station !== 'object') return 'Address unavailable';
  const address = station.address || {};
  const part1 = [address.line1, address.line2].filter(Boolean).join(' ').trim();
  const part2 = [address.city, address.region, address.postalCode].filter(Boolean).join(' ').trim();
  const combined = [part1, part2].filter(Boolean).join(', ').trim();
  return combined || 'Address unavailable';
}

function getPricedStations(group) {
  const stations = Array.isArray(group?.stations) ? group.stations : [];
  if (!stations.length) return [];

  const normalized = stations.map(station => {
    const bestPrice = Number(station?.bestPrice ?? station?.cash ?? station?.credit);
    const distance = Number(station?.distance);
    return {
      station,
      bestPrice: Number.isFinite(bestPrice) && bestPrice > 0 ? bestPrice : Number.POSITIVE_INFINITY,
      distance: Number.isFinite(distance) ? distance : Number.POSITIVE_INFINITY
    };
  }).filter(item => Number.isFinite(item.bestPrice));

  return normalized;
}

function getBestStation(group) {
  const normalized = getPricedStations(group);
  if (!normalized.length) return null;
  normalized.sort((a, b) => (a.bestPrice - b.bestPrice) || (a.distance - b.distance));
  return normalized[0].station;
}

function getNearestStation(group) {
  const normalized = getPricedStations(group).filter(item => Number.isFinite(item.distance));
  if (!normalized.length) return null;
  normalized.sort((a, b) => (a.distance - b.distance) || (a.bestPrice - b.bestPrice));
  return normalized[0].station;
}

function stationIdentity(station) {
  if (!station || typeof station !== 'object') return '';
  const name = String(station?.name || '').trim().toLowerCase();
  const addr = formatStationAddress(station).trim().toLowerCase();
  const id = String(station?.id ?? '').trim().toLowerCase();
  return `${id}|${name}|${addr}`;
}

function getNearestDifferentStation(group, selectedStation) {
  const selectedKey = stationIdentity(selectedStation);
  const normalized = getPricedStations(group)
    .filter(item => Number.isFinite(item.distance))
    .filter(item => stationIdentity(item.station) !== selectedKey);

  if (!normalized.length) return null;
  normalized.sort((a, b) => (a.distance - b.distance) || (a.bestPrice - b.bestPrice));
  return normalized[0].station;
}

function toMiles(distanceValue, unitValue) {
  const d = Number(distanceValue);
  if (!Number.isFinite(d)) return null;

  const unit = String(unitValue || '').trim().toLowerCase();
  if (unit === 'mi' || unit === 'mile' || unit === 'miles') return d;
  if (unit === 'km' || unit === 'kilometer' || unit === 'kilometers') return d * 0.621371;
  if (unit === 'm' || unit === 'meter' || unit === 'meters') return d / 1609.344;
  if (unit === 'ft' || unit === 'foot' || unit === 'feet') return d / 5280;

  return d;
}

function pickCoordinate(station, keys) {
  for (const key of keys) {
    const value = Number(station?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function buildGoogleMapsUrl(station) {
  if (!station || typeof station !== 'object') return null;

  const lat = pickCoordinate(station, ['latitude', 'lat']);
  const lon = pickCoordinate(station, ['longitude', 'lng', 'lon']);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lon}`)}`;
  }

  const address = formatStationAddress(station);
  const name = String(station?.name || '').trim();
  const query = [name, address].filter(Boolean).join(' ').trim();
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function formatStationDistanceMiles(station) {
  const miles = toMiles(
    station?.distance,
    station?.distanceUnit ?? station?.distance_unit ?? station?.distanceUnits
  );
  if (!Number.isFinite(miles)) return 'distance n/a';
  if (miles === 0) return 'at search point';
  if (miles < 0.1) return '<0.1 mi';
  if (miles < 10) return `${miles.toFixed(2)} mi`;
  return `${miles.toFixed(1)} mi`;
}

function formatStationSummary(station) {
  if (!station) return 'no station data';
  const name = station?.name || 'Unknown station';
  const addr = formatStationAddress(station);
  const price = Number(station?.bestPrice ?? station?.cash ?? station?.credit);
  const priceText = Number.isFinite(price) && price > 0 ? `$${price.toFixed(2)}/gal` : 'Price unavailable';
  const distanceText = formatStationDistanceMiles(station);
  return `${name} · ${addr} · ${priceText} · ${distanceText}`;
}

function formatStationSummaryHtml(station) {
  if (!station) return 'no station data';
  const summary = formatStationSummary(station);
  const mapsUrl = buildGoogleMapsUrl(station);
  if (!mapsUrl) return escHtml(summary);
  return `${escHtml(summary)} · <a class="fuel-map-link" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">map</a>`;
}

function setFuelStationLine(id, label, cheapestStation, nearestStation) {
  const el = document.getElementById(id);
  if (!el) return;
  const cheapestText = formatStationSummaryHtml(cheapestStation);
  const nearestText = nearestStation
    ? formatStationSummaryHtml(nearestStation)
    : 'same as lowest (no different nearby station in snapshot)';
  el.innerHTML = `${escHtml(label)} lowest: ${cheapestText} | nearest: ${nearestText}`;
}

function syncFuelModeFromCurrentInput() {
  const cached = getFuelSnapshotCache();
  if (!cached) return;

  const e85Station = getBestStation(cached.e85);
  const p93Station = getBestStation(cached.premium93);
  const snapshotE85 = Number(e85Station?.bestPrice ?? e85Station?.cash ?? e85Station?.credit);
  const snapshot93 = Number(p93Station?.bestPrice ?? p93Station?.cash ?? p93Station?.credit);
  const currentE85 = clampNumber(getValue('inp-price-e85', DEFAULTS.priceE85), 0, 999, DEFAULTS.priceE85);
  const current93 = clampNumber(getValue('inp-price-93', DEFAULTS.price93), 0, 999, DEFAULTS.price93);

  const e85Diff = Number.isFinite(snapshotE85) ? Math.abs(currentE85 - snapshotE85) : 0;
  const p93Diff = Number.isFinite(snapshot93) ? Math.abs(current93 - snapshot93) : 0;
  if (e85Diff > 0.001 || p93Diff > 0.001) {
    setFuelSourceLabel('Manual prices · not using snapshot values', 'info');
    updateFuelUIStatus('Manual price edits override auto-filled values.', 'info');
  }
}

async function fetchFuelPriceSnapshot() {
  const cacheBuster = `v=${Date.now()}`;
  const url = `${FUEL_PRICES_SNAPSHOT_PATH}?${cacheBuster}`;
  const response = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Fuel snapshot fetch failed (${response.status})`);
  }
  return response.json();
}

function applyFuelSnapshot(snapshot, sourceKind) {
  const e85Station = getBestStation(snapshot?.e85);
  const p93Station = getBestStation(snapshot?.premium93);
  const e85Nearest = getNearestDifferentStation(snapshot?.e85, e85Station);
  const p93Nearest = getNearestDifferentStation(snapshot?.premium93, p93Station);
  const e85Price = Number(e85Station?.bestPrice ?? e85Station?.cash ?? e85Station?.credit);
  const p93Price = Number(p93Station?.bestPrice ?? p93Station?.cash ?? p93Station?.credit);

  let applied = false;
  if (Number.isFinite(e85Price) && e85Price > 0) {
    setValue('inp-price-e85', e85Price.toFixed(2));
    safeSetItem('priceE85', e85Price.toFixed(2));
    applied = true;
  }
  if (Number.isFinite(p93Price) && p93Price > 0) {
    setValue('inp-price-93', p93Price.toFixed(2));
    safeSetItem('price93', p93Price.toFixed(2));
    applied = true;
  }

  setFuelStationLine('fuel-station-e85', 'E85', e85Station, e85Nearest);
  setFuelStationLine('fuel-station-93', '93', p93Station, p93Nearest);

  const search = String(snapshot?.search || 'Configured location');
  const generatedAt = formatFuelTime(snapshot?.generatedAt);
  setFuelSourceLabel(`Fuel snapshot · ${search} · ${generatedAt}`, sourceKind || 'live');

  if (applied) {
    updateFuelUIStatus('Auto-filled E85 and 93 prices from fuel snapshot.', sourceKind || 'live');
    calculateBlend();
    return true;
  }

  updateFuelUIStatus('Snapshot loaded, but no station prices were available.', 'error');
  return false;
}

async function useFuelPriceSnapshotAuto() {
  updateFuelUIStatus('Loading fuel prices...', 'info');
  try {
    const snapshot = await fetchFuelPriceSnapshot();
    saveFuelSnapshotCache(snapshot);
    applyFuelSnapshot(snapshot, 'live');
  } catch (error) {
    const cached = getFuelSnapshotCache();
    if (cached) {
      applyFuelSnapshot(cached, 'cache');
      updateFuelUIStatus('Using cached fuel snapshot data.', 'cache');
      return;
    }
    updateFuelUIStatus(`Fuel prices unavailable · ${error?.message || 'Use manual prices'}`, 'error');
  }
}

function applyAmbientWeather(tempF, sourceLabel, detailLabel, persist = true) {
  const temp = clampNumber(tempF, -40, 140, defaultAmbientFromSeason());
  setValue('inp-amb-temp', temp.toFixed(0));
  if (persist) {
    safeSetItem('ambientTempF', temp);
    saveWeatherCache(temp, sourceLabel, detailLabel);
  }
  setWeatherSourceLabel(
    `${sourceLabel || 'Live weather'}${detailLabel ? ` · ${detailLabel}` : ''} · ${safeFixed(temp, 0)}°F`,
    'live'
  );
  updateWeatherUIStatus('Live weather updated.', 'live');
  calculateBlend();
}

function syncWeatherModeFromCurrentInput() {
  const cached = getWeatherCache();
  if (!cached) return;

  const currentTemp = clampNumber(getValue('inp-amb-temp', defaultAmbientFromSeason()), -40, 140, defaultAmbientFromSeason());
  const sourceEl = document.getElementById('weather-source-label');
  const statusEl = document.getElementById('weather-status');

  if (Math.abs(currentTemp - Number(cached.tempF)) > 0.1) {
    if (sourceEl) sourceEl.textContent = 'Manual input · not using API';
    if (statusEl) statusEl.textContent = 'Manual input overrides the live weather value.';
    if (sourceEl) delete sourceEl.dataset.kind;
    if (statusEl) delete statusEl.dataset.kind;
  }
}

async function fetchOpenMeteoWeather(lat, lon) {
  const url = new URL(WEATHER_API_BASE);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('current_weather', 'true');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url.toString(), { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Weather lookup failed (${response.status})`);
  }
  const data = await response.json();
  const tempF = Number(data?.current_weather?.temperature);
  if (!Number.isFinite(tempF)) {
    throw new Error('No current weather temperature returned');
  }
  return { tempF, raw: data };
}

async function reverseGeocodeLocation(lat, lon) {
  try {
    const url = new URL(WEATHER_REVERSE_GEOCODE_BASE);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('localityLanguage', 'en');

    const response = await fetch(url.toString(), { method: 'GET' });
    if (response.ok) {
      const data = await response.json();
      const city = data?.city || data?.locality || '';
      const stateCodeRaw = String(data?.principalSubdivisionCode || '');
      const stateCode = stateCodeRaw.includes('-') ? stateCodeRaw.split('-').pop() : stateCodeRaw;
      const stateName = data?.principalSubdivision || '';
      const countryCode = data?.countryCode || '';

      if (city && stateCode) return `${city}, ${stateCode}`;
      if (city && stateName) return `${city}, ${stateName}`;
      if (city) return city;
      if (stateCode) return stateCode;
      if (countryCode) return countryCode;
    }
  } catch (e) {
  }

  try {
    const url = new URL(WEATHER_REVERSE_GEOCODE_FALLBACK_BASE);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('zoom', '10');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept-Language': 'en' }
    });
    if (!response.ok) return null;

    const data = await response.json();
    const city = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.municipality || data?.name || '';
    const stateCodeRaw = String(data?.address?.['ISO3166-2-lvl4'] || '');
    const stateCode = stateCodeRaw.includes('-') ? stateCodeRaw.split('-').pop() : stateCodeRaw;
    const stateName = data?.address?.state || '';
    const countryCode = String(data?.address?.country_code || '').toUpperCase();

    if (city && stateCode) return `${city}, ${stateCode}`;
    if (city && stateName) return `${city}, ${stateName}`;
    if (city) return city;
    if (stateCode) return stateCode;
    return countryCode || null;
  } catch (e) {
    return null;
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not available in this browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000
    });
  });
}

async function useLiveWeather() {
  const statusEl = document.getElementById('weather-status');
  if (statusEl) {
    statusEl.textContent = 'Getting location and weather...';
    statusEl.dataset.kind = 'info';
  }

  try {
    const position = await getCurrentPosition();
    const { latitude, longitude } = position.coords;
    const weather = await fetchOpenMeteoWeather(latitude, longitude);
    const place = await reverseGeocodeLocation(latitude, longitude).catch(() => null);
    const loc = place || 'Location unavailable';
    applyAmbientWeather(weather.tempF, 'Open-Meteo live weather', loc, true);
  } catch (error) {
    const cached = getWeatherCache();
    if (cached) {
      setWeatherSourceLabel(
        `Using cached weather · ${cached.sourceLabel || 'Open-Meteo'} · ${formatWeatherCacheTime(cached.updatedAt)}`,
        'cache'
      );
      updateWeatherUIStatus('Using cached weather data.', 'cache');
      setValue('inp-amb-temp', Number(cached.tempF).toFixed(0));
      safeSetItem('ambientTempF', Number(cached.tempF));
      calculateBlend();
      return;
    }

    updateWeatherUIStatus(`Live weather unavailable · ${error?.message || 'Manual input still available'}`, 'error');
  }
}

function suggestedTargetForTemp(tempF) {
  const t = Number(tempF);
  if (!Number.isFinite(t)) return 'E50-E60';
  if (t >= 70) return 'E70+';
  if (t >= 60) return 'E60-E70';
  if (t >= 40) return 'E50-E60';
  if (t >= 25) return 'E40-E50';
  if (t >= 0) return 'E30-E40';
  return 'E20-E30';
}

function targetLabelForTemp(tempF) {
  return suggestedTargetForTemp(tempF);
}

function estimateStationEthFromLog(log) {
  const actualE85 = Number(log.actualE85);
  const actual93 = Number(log.actual93);
  const apEth = Number(log.apEth);
  const curGal = Number(log.curGal);
  const curEth = Number(log.curEth);
  const pumpGas = Number(log.pumpGas);

  if (!Number.isFinite(actualE85) || !Number.isFinite(actual93) || !Number.isFinite(apEth) || !Number.isFinite(curGal) || !Number.isFinite(curEth) || !Number.isFinite(pumpGas) || actualE85 <= 0) {
    return null;
  }

  const estimate = ((apEth * TANK) - (curGal * curEth) - (actual93 * pumpGas)) / actualE85;
  if (!Number.isFinite(estimate)) return null;
  return clampNumber(estimate, 0, 100, null);
}

function buildStationInsights(logs) {
  const byStation = new Map();

  logs.forEach(log => {
    const key = String(log.station || 'Unknown').trim() || 'Unknown';
    const estimate = estimateStationEthFromLog(log);
    if (estimate === null) return;

    const entry = byStation.get(key) || { station: key, samples: [], lastSeen: log.date };
    entry.samples.unshift({ estimate, date: log.date, id: log.id });
    entry.samples = entry.samples.slice(0, 5);
    entry.lastSeen = log.date;
    byStation.set(key, entry);
  });

  return Array.from(byStation.values()).map(entry => {
    const values = entry.samples.map(s => s.estimate);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const spread = values.length > 1 ? Math.max(...values) - Math.min(...values) : 0;
    const confidence = values.length >= 5 && spread <= 4 ? 'High' : values.length >= 3 ? 'Medium' : 'Low';
    return {
      station: entry.station,
      avg,
      samples: values.length,
      spread,
      confidence,
      lastSeen: entry.lastSeen,
      note: values.length < 2 ? 'Needs more logged fills' : spread > 6 ? 'Check pump labels vs AP trace' : 'Rolling average from recent fills'
    };
  }).sort((a, b) => b.samples - a.samples || a.station.localeCompare(b.station));
}

function calcFillCost(volumeE85, volume93, priceE85, price93) {
  const e85 = Number(volumeE85);
  const p85 = Number(priceE85);
  const g93 = Number(volume93);
  const p93 = Number(price93);
  if (![e85, p85, g93, p93].every(Number.isFinite)) return null;
  return (e85 * p85) + (g93 * p93);
}

function escCsv(v) {
  return '"' + String(v ?? '').replace(/"/g, '""') + '"';
}

function getValue(id, fallback) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  const value = el.value;
  return value === '' || value === null || value === undefined ? fallback : value;
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function getCheckedMode() {
  const checked = document.querySelector('input[name="fill-mode"]:checked');
  return normalizeFillMode(checked ? checked.value : safeGetItem('fillMode', DEFAULTS.fillMode));
}

function normalizeFillMode(mode) {
  return mode === 'add' ? 'add' : 'full';
}

function syncModeUI(mode) {
  mode = normalizeFillMode(mode);
  const addWrap = document.getElementById('add-volume-wrap');
  if (addWrap) addWrap.hidden = mode !== 'add';
  const radios = document.querySelectorAll('input[name="fill-mode"]');
  radios.forEach(r => { r.checked = r.value === mode; });
}

function setActiveButton(id) {
  const ids = ['btn-calc', 'btn-table', 'btn-log', 'btn-sim', 'btn-ref'];
  ids.forEach(btnId => {
    const el = document.getElementById(btnId);
    if (el) el.classList.toggle('active', btnId === id);
  });
}

function isSimOpen() {
  const el = document.getElementById('sim-modal');
  return el && el.classList.contains('show');
}

function isRefOpen() {
  const el = document.getElementById('ref-modal');
  return el && el.style.display === 'flex';
}

function lockBodyScroll(lock) {
  document.body.classList.toggle('modal-open', !!lock);
}

function restoreFocus() {
  if (lastModalTrigger && typeof lastModalTrigger.focus === 'function') {
    lastModalTrigger.focus({ preventScroll: true });
  }
  lastModalTrigger = null;
}

function focusFirstInModal(selector) {
  const el = document.querySelector(selector);
  if (el && typeof el.focus === 'function') {
    setTimeout(() => el.focus({ preventScroll: true }), 0);
  }
}

function getInputs() {
  return {
    curGal: clampNumber(getValue('inp-gal', 0), 0, TANK, 0),
    curEth: clampNumber(getValue('inp-eth', DEFAULTS.curEth), 0, 100, DEFAULTS.curEth),
    tgtEth: clampNumber(getValue('inp-tgt', DEFAULTS.tgtEth), 0, 100, DEFAULTS.tgtEth),
    maxEth: clampNumber(getValue('inp-max-eth', DEFAULTS.maxEth), 0, 100, DEFAULTS.maxEth),
    pumpE85: clampNumber(getValue('inp-pump-e85', DEFAULTS.pumpE85), 40, 100, DEFAULTS.pumpE85),
    pumpGas: clampNumber(getValue('inp-pump-gas', DEFAULTS.pumpGas), 0, 15, DEFAULTS.pumpGas),
    ambientTempF: clampNumber(getValue('inp-amb-temp', defaultAmbientFromSeason()), -40, 140, defaultAmbientFromSeason()),
    priceE85: clampNumber(getValue('inp-price-e85', DEFAULTS.priceE85), 0, 999, DEFAULTS.priceE85),
    price93: clampNumber(getValue('inp-price-93', DEFAULTS.price93), 0, 999, DEFAULTS.price93),
    addGallons: clampNumber(getValue('inp-add-gal', DEFAULTS.addGallons), 0, TANK, DEFAULTS.addGallons),
    fillMode: getCheckedMode(),
    syncEnabled: document.getElementById('chk-sync') ? document.getElementById('chk-sync').checked : DEFAULTS.syncEnabled
  };
}

function sanitizeAndPersistInputs() {
  const inputs = getInputs();

  setValue('inp-gal', inputs.curGal.toFixed(1));
  setValue('inp-eth', inputs.curEth.toFixed(0));
  setValue('inp-tgt', inputs.tgtEth.toFixed(0));
  setValue('inp-max-eth', inputs.maxEth.toFixed(0));
  setValue('inp-pump-e85', inputs.pumpE85.toFixed(0));
  setValue('inp-pump-gas', inputs.pumpGas.toFixed(0));
  setValue('inp-amb-temp', inputs.ambientTempF.toFixed(0));
  setValue('inp-price-e85', inputs.priceE85.toFixed(2));
  setValue('inp-price-93', inputs.price93.toFixed(2));
  setValue('inp-add-gal', inputs.addGallons.toFixed(1));

  const matchIndex = LEVELS.findIndex(l => Math.abs(l.gal - inputs.curGal) < 0.1);
  document.getElementById('sl').value = matchIndex === -1 ? 0 : matchIndex;

  safeSetItem('curEth', inputs.curEth);
  safeSetItem('tgtEth', inputs.tgtEth);
  safeSetItem('maxEth', inputs.maxEth);
  safeSetItem('pumpE85', inputs.pumpE85);
  safeSetItem('pumpGas', inputs.pumpGas);
  safeSetItem('ambientTempF', inputs.ambientTempF);
  safeSetItem('priceE85', inputs.priceE85);
  safeSetItem('price93', inputs.price93);
  safeSetItem('fillMode', inputs.fillMode);
  safeSetItem('addGallons', inputs.addGallons);
  safeSetItem('logSyncEnabled', inputs.syncEnabled ? '1' : '0');

  syncModeUI(inputs.fillMode);
}

function computeBlend(curGal, curEth, tgtEth, pumpE85, pumpGas, fillMode, addGallons) {
  const emptySpace = Math.max(0, TANK - curGal);
  const requestedVolume = fillMode === 'add' ? Math.max(0, addGallons) : emptySpace;
  const fillVolume = Math.min(emptySpace, requestedVolume);
  const denom = pumpE85 - pumpGas;

  if (denom <= 0) {
    return {
      error: 'PUMP E85 % MUST EXCEED PUMP GAS %',
      emptySpace,
      fillVolume: 0,
      requestedVolume,
      idealE85: 0,
      rawE85: 0,
      e85Display: 0,
      c93Display: 0,
      resultEth: 0,
      lowE85: 0,
      highE85: 0,
      lowEth: 0,
      highEth: 0,
      limited: false
    };
  }

  const idealE85 = ((tgtEth * TANK) - (curGal * curEth) - (fillVolume * pumpGas)) / denom;
  const rawE85 = Math.max(0, Math.min(idealE85, fillVolume));
  const e85Display = floor2(rawE85);
  const c93Display = round2(Math.max(0, fillVolume - e85Display));
  const resultEth = Math.round(((curGal * curEth) + (e85Display * pumpE85) + (c93Display * pumpGas)) / TANK);

  const lowE85 = Math.max(0, e85Display - 0.1);
  const highE85 = e85Display + 0.1;
  const low93 = Math.max(0, c93Display + 0.1);
  const high93 = Math.max(0, c93Display - 0.1);
  const lowEth = Math.round(((curGal * curEth) + (lowE85 * pumpE85) + (low93 * pumpGas)) / TANK);
  const highEth = Math.round(((curGal * curEth) + (highE85 * pumpE85) + (high93 * pumpGas)) / TANK);

  return {
    error: '',
    emptySpace,
    requestedVolume,
    fillVolume,
    idealE85,
    rawE85,
    e85Display,
    c93Display,
    resultEth,
    lowE85,
    highE85,
    lowEth,
    highEth,
    limited: fillMode === 'add' && requestedVolume > emptySpace + 1e-9
  };
}

function getEffectiveTarget(inputs) {
  const cappedTarget = Math.min(inputs.tgtEth, inputs.maxEth);
  return {
    targetEth: cappedTarget,
    capped: inputs.tgtEth > inputs.maxEth + 1e-9
  };
}

function updateStaticTable(targetEth) {
  const tbody = document.getElementById('static-chart-body');
  if (!tbody) return;

  const inputs = getInputs();
  tbody.innerHTML = LEVELS.map((l, i) => {
    const row = computeBlend(l.gal, inputs.curEth, targetEth, inputs.pumpE85, inputs.pumpGas, 'full', 0);
    const empty = row.fillVolume;
    const w = (l.gal / TANK) * 100;
    return `<tr ${i === 0 ? 'class="lf"' : ''}>
     <td><div class="gcell"><div><div class="glv">${l.label} Tank</div><div class="gsub">~${l.gal.toFixed(1)} gal remaining<div class="fbw"><div class="fb" style="width:${w}%"></div></div></div></div></div></td>
     <td><span class="tv">${empty.toFixed(1)} gal</span></td>
     <td><span class="ev">${row.e85Display.toFixed(2)}<span class="u">gal</span></span></td>
     <td><span class="cv">${row.c93Display.toFixed(2)}<span class="u">gal</span></span></td>
   </tr>`;
  }).join('');
}

function updateMathText(inputs, result, targetEth, targetCapped) {
  const mathLive = document.getElementById('live-math');
  if (!mathLive) return;
  if (result.error) {
    mathLive.textContent = result.error;
    return;
  }

  const fillDesc = inputs.fillMode === 'add'
    ? `${result.fillVolume.toFixed(1)} added gal`
    : `${result.fillVolume.toFixed(1)} empty gal`;

  const capNote = targetCapped ? ` [CEILING E${inputs.maxEth.toFixed(0)} APPLIED]` : '';
  mathLive.textContent = `E85 Needed = ((${targetEth.toFixed(1)} × ${TANK.toFixed(1)}) - (${inputs.curEth.toFixed(1)} × ${inputs.curGal.toFixed(1)}) - (${inputs.pumpGas.toFixed(1)} × ${fillDesc})) / (${inputs.pumpE85.toFixed(1)} - ${inputs.pumpGas.toFixed(1)}) = ${result.e85Display.toFixed(2)}${capNote}`;
}

function updateResultUI(inputs, result, targetEth, targetCapped) {
  const needle = document.getElementById('needle-reading');
  if (needle) {
    needle.innerHTML = inputs.curGal <= 0.1 ? 'E &mdash; <em>Empty</em>' : `${inputs.curGal.toFixed(1)} <em>Gal Left</em>`;
  }

  const curp = (inputs.curGal / TANK) * 100;
  const e85p = (result.e85Display / TANK) * 100;
  const c93p = (result.c93Display / TANK) * 100;

  document.getElementById('gex').style.width = curp + '%';
  document.getElementById('gex').style.left = '0%';
  document.getElementById('ge').style.width = e85p + '%';
  document.getElementById('ge').style.left = curp + '%';
  document.getElementById('gc').style.width = c93p + '%';
  document.getElementById('gc').style.left = (curp + e85p) + '%';

  document.getElementById('llex').style.opacity = curp > 12 ? '1' : '0';
  document.getElementById('lle').style.opacity = e85p > 12 ? '1' : '0';
  document.getElementById('llc').style.opacity = c93p > 12 ? '1' : '0';

  ['ve', 'vc', 'vx'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  });

  currentE85Needed = result.e85Display.toFixed(2);
  currentC93Needed = result.c93Display.toFixed(2);
  currentEthResult = result.resultEth;

  document.getElementById('ve').textContent = currentE85Needed;
  document.getElementById('vc').textContent = currentC93Needed;
  document.getElementById('vx').textContent = '~E' + result.resultEth;

  document.getElementById('ve-range').textContent = `${result.e85Display.toFixed(1)} gal (${result.lowE85.toFixed(1)} to ${result.highE85.toFixed(1)} gives E${result.lowEth} to E${result.highEth})`;
  document.getElementById('i1').textContent = currentE85Needed + ' gal';
  document.getElementById('i2').textContent = currentC93Needed + ' gal';
  document.getElementById('i3').textContent = '~' + result.resultEth + '%' + (targetCapped ? ` capped at E${inputs.maxEth.toFixed(0)}` : '');

  const badge = document.getElementById('ebadge');
  const capMsg = targetCapped ? `⚠ TARGET LIMITED TO CEILING E${inputs.maxEth.toFixed(0)}` : '';
  if (result.limited) {
    badge.className = 'ebadge low';
    badge.textContent = '⚠ ADD VOLUME LIMITED TO REMAINING SPACE';
  } else if (targetCapped) {
    badge.className = 'ebadge low';
    badge.textContent = capMsg;
  } else if (result.resultEth < targetEth - 2) {
    badge.className = 'ebadge low';
    badge.textContent = '⚠ TANK TOO FULL TO REACH TARGET';
  } else {
    badge.className = 'ebadge sweet';
    badge.textContent = '✓ SCRK TUNED — SAFE BLEND';
  }

  updateMathText(inputs, result, targetEth, targetCapped);

  const matchIndex = LEVELS.findIndex(l => Math.abs(l.gal - inputs.curGal) < 0.1);
  document.querySelectorAll('.main-t').forEach((t, i) => {
    t.classList.toggle('on', i === matchIndex);
  });
}

function calculateBlend() {
  const inputs = getInputs();
  const targetState = getEffectiveTarget(inputs);
  safeSetItem('curEth', inputs.curEth);
  safeSetItem('tgtEth', inputs.tgtEth);
  safeSetItem('maxEth', inputs.maxEth);
  safeSetItem('pumpE85', inputs.pumpE85);
  safeSetItem('pumpGas', inputs.pumpGas);
  safeSetItem('ambientTempF', inputs.ambientTempF);
  safeSetItem('priceE85', inputs.priceE85);
  safeSetItem('price93', inputs.price93);
  safeSetItem('fillMode', inputs.fillMode);
  safeSetItem('addGallons', inputs.addGallons);
  safeSetItem('logSyncEnabled', inputs.syncEnabled ? '1' : '0');

  syncModeUI(inputs.fillMode);

  const result = computeBlend(inputs.curGal, inputs.curEth, targetState.targetEth, inputs.pumpE85, inputs.pumpGas, inputs.fillMode, inputs.addGallons);
  updateResultUI(inputs, result, targetState.targetEth, targetState.capped);
  updateStaticTable(targetState.targetEth);
  renderAdvisorPanels(inputs, result, targetState);
}

function handleInput() {
  calculateBlend();
}

function commitInput() {
  sanitizeAndPersistInputs();
  syncWeatherModeFromCurrentInput();
  syncFuelModeFromCurrentInput();
  calculateBlend();
}

function setTick(i) {
  document.getElementById('sl').value = i;
  document.getElementById('inp-gal').value = LEVELS[i].gal.toFixed(1);
  calculateBlend();
}

function setSimTick(i) {
  document.getElementById('sim-sl-cur').value = i;
  runSim();
}

function onSlide(v) {
  document.getElementById('inp-gal').value = LEVELS[v].gal.toFixed(1);
  calculateBlend();
}

function onSimSlide(v) {
  runSim();
}

function setFillMode(mode) {
  mode = normalizeFillMode(mode);
  safeSetItem('fillMode', mode);
  syncModeUI(mode);
  calculateBlend();
}

function setSyncEnabled(enabled) {
  safeSetItem('logSyncEnabled', enabled ? '1' : '0');
}

function setSaveButtonState(isEditing) {
  const btn = document.querySelector('.save-log-btn');
  if (!btn) return;
  btn.innerHTML = isEditing
    ? '<span class="btn-icon">✎</span> UPDATE TELEMETRY'
    : '<span class="btn-icon">💾</span> SAVE TELEMETRY';
}

function setEditBanner(visible, log) {
  const banner = document.getElementById('log-edit-banner');
  const title = document.getElementById('log-edit-title');
  if (!banner || !title) return;
  banner.hidden = !visible;
  if (visible && log) {
    title.textContent = `Editing ${log.station} · ${log.date}`;
  }
}

function clearLogEditMode() {
  editingLogId = null;
  setSaveButtonState(false);
  setEditBanner(false);
}

function beginLogEdit(id) {
  const log = fuelLogs.find(item => item.id === id);
  if (!log) return;

  editingLogId = id;
  setSaveButtonState(true);
  setEditBanner(true, log);

  setValue('inp-gal', log.curGal ?? getValue('inp-gal', 0));
  setValue('inp-eth', log.curEth ?? getValue('inp-eth', DEFAULTS.curEth));
  setValue('inp-tgt', log.tgtEth ?? getValue('inp-tgt', DEFAULTS.tgtEth));
  setValue('inp-max-eth', log.maxEth ?? getValue('inp-max-eth', DEFAULTS.maxEth));
  setValue('inp-pump-e85', log.pumpE85 ?? getValue('inp-pump-e85', DEFAULTS.pumpE85));
  setValue('inp-pump-gas', log.pumpGas ?? getValue('inp-pump-gas', DEFAULTS.pumpGas));
  setValue('inp-amb-temp', log.ambientTempF ?? getValue('inp-amb-temp', defaultAmbientFromSeason()));
  setValue('inp-price-e85', log.priceE85 ?? getValue('inp-price-e85', DEFAULTS.priceE85));
  setValue('inp-price-93', log.price93 ?? getValue('inp-price-93', DEFAULTS.price93));
  setValue('inp-add-gal', log.addGallons ?? getValue('inp-add-gal', DEFAULTS.addGallons));
  syncModeUI(log.fillMode ?? getCheckedMode());
  setValue('inp-station', log.station ?? '');
  setValue('inp-act-e85', log.actualE85 ?? '');
  setValue('inp-act-93', log.actual93 ?? '');
  setValue('inp-ap-eth', log.apEth ?? '');

  calculateBlend();

  const stationInput = document.getElementById('inp-station');
  if (stationInput && typeof stationInput.focus === 'function') {
    stationInput.focus({ preventScroll: true });
  }
  stationInput?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}

function cancelLogEdit() {
  clearLogEditMode();
  document.getElementById('inp-station').value = '';
  const actualE85El = document.getElementById('inp-act-e85');
  const actual93El = document.getElementById('inp-act-93');
  const apEthEl = document.getElementById('inp-ap-eth');
  if (actualE85El) actualE85El.value = '';
  if (actual93El) actual93El.value = '';
  if (apEthEl) apEthEl.value = '';
}

function saveFillUpLog() {
  sanitizeAndPersistInputs();
  calculateBlend();

  const inputs = getInputs();
  const wasEditing = editingLogId !== null;
  const station = document.getElementById('inp-station').value.trim() || 'Unknown';
  const actualE85 = parseOptionalNumber('inp-act-e85');
  const actual93 = parseOptionalNumber('inp-act-93');
  const apEth = parseOptionalNumber('inp-ap-eth');
  const estTime = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: true });
  const plannedE85 = Number(currentE85Needed);
  const planned93 = Number(currentC93Needed);
  const costE85Gallons = Number.isFinite(actualE85) ? actualE85 : plannedE85;
  const cost93Gallons = Number.isFinite(actual93) ? actual93 : planned93;
  const fillCost = calcFillCost(costE85Gallons, cost93Gallons, inputs.priceE85, inputs.price93);
  const logData = {
    station,
    e85: currentE85Needed,
    c93: currentC93Needed,
    eth: currentEthResult,
    curGal: inputs.curGal,
    curEth: inputs.curEth,
    tgtEth: inputs.tgtEth,
    maxEth: inputs.maxEth,
    fillMode: inputs.fillMode,
    addGallons: inputs.addGallons,
    pumpE85: inputs.pumpE85,
    pumpGas: inputs.pumpGas,
    ambientTempF: inputs.ambientTempF,
    priceE85: inputs.priceE85,
    price93: inputs.price93,
    actualE85,
    actual93,
    apEth,
    fillE85: costE85Gallons,
    fill93: cost93Gallons,
    costE85: Number.isFinite(fillCost) ? costE85Gallons * inputs.priceE85 : null,
    cost93: Number.isFinite(fillCost) ? cost93Gallons * inputs.price93 : null,
    fillCost: Number.isFinite(fillCost) ? fillCost : null
  };
  logData.stationEthEstimate = estimateStationEthFromLog(logData);

  let savedLog;
  if (editingLogId !== null) {
    const idx = fuelLogs.findIndex(l => l.id === editingLogId);
    if (idx !== -1) {
      savedLog = { ...fuelLogs[idx], ...logData };
      fuelLogs[idx] = savedLog;
    } else {
      savedLog = { id: Date.now(), date: estTime, ...logData };
      fuelLogs.unshift(savedLog);
    }
  } else {
    savedLog = { id: Date.now(), date: estTime, ...logData };
    fuelLogs.unshift(savedLog);
  }

  safeSetItem('wrxFuelLogs', JSON.stringify(fuelLogs));
  if (inputs.syncEnabled && !wasEditing) sendToGoogleForm(savedLog);

  document.getElementById('inp-station').value = '';
  const actualE85El = document.getElementById('inp-act-e85');
  const actual93El = document.getElementById('inp-act-93');
  const apEthEl = document.getElementById('inp-ap-eth');
  if (actualE85El) actualE85El.value = '';
  if (actual93El) actual93El.value = '';
  if (apEthEl) apEthEl.value = '';
  clearLogEditMode();
  const btn = document.querySelector('.save-log-btn');
  if (btn) {
    btn.innerHTML = wasEditing ? '✓ UPDATED' : '✓ SAVED';
    setTimeout(() => { setSaveButtonState(false); }, 2000);
  }
  renderLogs();
}

function renderLogs() {
  const tbody = document.getElementById('log-table-body');
  const empty = document.getElementById('log-empty-msg');
  if (!tbody || !empty) return;
  empty.style.display = fuelLogs.length ? 'none' : 'block';
  tbody.innerHTML = fuelLogs.map(log => {
    const stationEthValue = Number.isFinite(Number(log.stationEthEstimate)) ? Number(log.stationEthEstimate) : estimateStationEthFromLog(log);
    const stationEth = Number.isFinite(Number(stationEthValue)) ? `E${Number(stationEthValue).toFixed(1)}` : '—';
    const fallbackCost = calcFillCost(Number(log.fillE85 ?? log.actualE85 ?? 0), Number(log.fill93 ?? log.actual93 ?? 0), Number(log.priceE85 ?? DEFAULTS.priceE85), Number(log.price93 ?? DEFAULTS.price93));
    const costValue = Number.isFinite(Number(log.fillCost)) ? log.fillCost : fallbackCost;
    return `<tr><td>${escHtml(log.date)}</td><td>${escHtml(log.station)}</td><td style="color:var(--e85);font-weight:bold;">${escHtml(log.e85)}</td><td style="color:var(--c93);font-weight:bold;">${escHtml(log.c93)}</td><td style="color:var(--neon);font-weight:bold;">${formatOptionalNumber(log.apEth)}</td><td style="color:var(--e85);font-weight:bold;">${formatOptionalNumber(log.actualE85)}</td><td style="color:var(--c93);font-weight:bold;">${formatOptionalNumber(log.actual93)}</td><td style="color:var(--neon);font-weight:bold;">${stationEth}</td><td style="color:var(--gold);font-weight:bold;">${formatMoney(costValue)}</td><td style="color:var(--gold);font-family:'Orbitron',sans-serif;font-size:20px;">E${escHtml(log.eth)}</td><td><button class="row-btn edit-btn" onclick="beginLogEdit(${log.id})">Edit</button><button class="del-btn" onclick="deleteLog(${log.id})">✕</button></td></tr>`;
  }).join('');
  renderStationInsights();
}

function renderStationInsights() {
  const wrap = document.getElementById('station-insights-body');
  const empty = document.getElementById('station-insights-empty');
  if (!wrap || !empty) return;

  const stats = buildStationInsights(fuelLogs).slice(0, 5);
  empty.style.display = stats.length ? 'none' : 'block';
  wrap.innerHTML = stats.map(stat => {
    const confidenceClass = stat.confidence === 'High' ? 'high' : stat.confidence === 'Medium' ? 'med' : 'low';
    return `<div class="station-chip ${confidenceClass}"><div class="station-chip-top"><strong>${escHtml(stat.station)}</strong><span>${stat.samples} sample${stat.samples === 1 ? '' : 's'}</span></div><div class="station-chip-mid">Avg station E85 <b>E${stat.avg.toFixed(1)}</b></div><div class="station-chip-bot">${escHtml(stat.confidence)} confidence · ${escHtml(stat.note)}</div></div>`;
  }).join('');
}

function renderAdvisorPanels(inputs, result, targetState) {
  const tempEl = document.getElementById('season-temp-label');
  const seasonEl = document.getElementById('season-target-label');
  const seasonNote = document.getElementById('season-note');
  const ceilingNote = document.getElementById('ceiling-note');
  const fillCostEl = document.getElementById('fill-cost-live');
  const fillCostNote = document.getElementById('fill-cost-note');
  const weatherSourceEl = document.getElementById('weather-source-label');
  const weatherStatusEl = document.getElementById('weather-status');
  const fuelSourceEl = document.getElementById('fuel-source-label');
  const fuelStatusEl = document.getElementById('fuel-status');

  const temp = Number(inputs.ambientTempF);
  const season = monthSeason(new Date().getMonth());
  const suggested = targetLabelForTemp(temp);
  if (tempEl) tempEl.textContent = `${safeFixed(temp, 0)}°F · ${season.toUpperCase()}`;
  if (seasonEl) seasonEl.textContent = `Suggested ${suggested} for current weather`;
  if (seasonNote) {
    seasonNote.textContent = 'Ethanol needs more heat to vaporize, so cold starts get harder as ethanol content rises. Warm weather supports higher targets.';
  }

  const cachedWeather = getWeatherCache();
  if (weatherSourceEl && (!weatherSourceEl.dataset.kind || weatherSourceEl.dataset.kind === 'info')) {
    weatherSourceEl.textContent = cachedWeather
      ? `Cached weather · ${safeFixed(inputs.ambientTempF, 0)}°F`
      : 'Manual input · not using API';
  }
  if (weatherStatusEl && (!weatherStatusEl.dataset.kind || weatherStatusEl.dataset.kind === 'info')) {
    weatherStatusEl.textContent = cachedWeather
      ? `Cached live weather last updated ${formatWeatherCacheTime(cachedWeather.updatedAt)}.`
      : 'Live weather is optional. Manual input stays available.';
  }

  if (fuelSourceEl && (!fuelSourceEl.dataset.kind || fuelSourceEl.dataset.kind === 'info')) {
    fuelSourceEl.textContent = 'Fuel snapshot · waiting for data';
  }
  if (fuelStatusEl && (!fuelStatusEl.dataset.kind || fuelStatusEl.dataset.kind === 'info')) {
    fuelStatusEl.textContent = 'Auto-fill uses latest saved fuel snapshot when available.';
  }

  if (ceilingNote) {
    ceilingNote.textContent = targetState.capped
      ? `Target capped to E${inputs.maxEth.toFixed(0)} because the ceiling is set lower than your requested target.`
      : `Ceiling set to E${inputs.maxEth.toFixed(0)}. Raise it only if your tune explicitly supports it.`;
  }

  const fillCost = calcFillCost(result.e85Display, result.c93Display, inputs.priceE85, inputs.price93);
  if (fillCostEl) fillCostEl.textContent = formatMoney(fillCost);
  if (fillCostNote) fillCostNote.textContent = result.limited
    ? 'Cost uses the achievable fill volume when space is limited.'
    : 'Live estimate uses current planned gallons and your saved pump prices.';
}

function deleteLog(id) {
  if (confirm('Delete locally?')) {
    fuelLogs = fuelLogs.filter(l => l.id !== id);
    safeSetItem('wrxFuelLogs', JSON.stringify(fuelLogs));
    if (editingLogId === id) clearLogEditMode();
    renderLogs();
  }
}

function deleteAllLogs() {
  if (confirm('Clear all local logs?')) {
    fuelLogs = [];
    safeRemoveItem('wrxFuelLogs');
    renderLogs();
  }
}

function sendToGoogleForm(log) {
  const fd = new FormData();
  fd.append(FORM_ENTRY_DATE, log.date);
  fd.append(FORM_ENTRY_STATION, log.station);
  fd.append(FORM_ENTRY_E85, log.e85);
  fd.append(FORM_ENTRY_93, log.c93);
  fd.append(FORM_ENTRY_ETH, log.eth);
  fd.append(TODO_FORM_ENTRY_AP_ETH, log.apEth === null || log.apEth === undefined ? '' : log.apEth);
  fd.append(TODO_FORM_ENTRY_STATION_ETH, log.stationEthEstimate === null || log.stationEthEstimate === undefined ? '' : log.stationEthEstimate);
  fd.append(TODO_FORM_ENTRY_FILL_COST, log.fillCost === null || log.fillCost === undefined ? '' : log.fillCost);
  fd.append(TODO_FORM_ENTRY_FILL_MODE, log.fillMode || '');
  fd.append(TODO_FORM_ENTRY_AMBIENT_TEMP, log.ambientTempF === null || log.ambientTempF === undefined ? '' : log.ambientTempF);
  fd.append(TODO_FORM_ENTRY_MAX_ETH, log.maxEth === null || log.maxEth === undefined ? '' : log.maxEth);
  fd.append(TODO_FORM_ENTRY_PRICE_E85, log.priceE85 === null || log.priceE85 === undefined ? '' : log.priceE85);
  fd.append(TODO_FORM_ENTRY_PRICE_93, log.price93 === null || log.price93 === undefined ? '' : log.price93);
  fd.append(TODO_FORM_ENTRY_ACTUAL_E85, log.actualE85 === null || log.actualE85 === undefined ? '' : log.actualE85);
  fd.append(TODO_FORM_ENTRY_ACTUAL_93, log.actual93 === null || log.actual93 === undefined ? '' : log.actual93);
  fetch(GOOGLE_FORM_ACTION_URL, { method: 'POST', mode: 'no-cors', body: fd }).catch(() => { });
}

function downloadCSV() {
  if (fuelLogs.length === 0) {
    alert('No logs to download.');
    return;
  }
  const headers = ['Date (EST)', 'Station', 'Planned E85 Gallons', 'Planned 93 Gallons', 'AP Eth %', 'Actual E85 Gallons', 'Actual 93 Gallons', 'Station E85 Est', 'Fuel Cost', 'Resulting Eth %', 'Ambient Temp F', 'Target Eth %', 'Max Eth %', 'Pump E85 %', 'Pump Gas %'].map(escCsv);
  const rows = fuelLogs.map(log => [
    log.date,
    log.station,
    log.e85,
    log.c93,
    log.apEth ?? '',
    log.actualE85 ?? '',
    log.actual93 ?? '',
    log.stationEthEstimate ?? '',
    log.fillCost ?? '',
    log.eth,
    log.ambientTempF ?? '',
    log.tgtEth ?? '',
    log.maxEth ?? '',
    log.pumpE85 ?? '',
    log.pumpGas ?? ''
  ].map(escCsv).join(','));
  const csv = ['\uFEFF' + headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `SCRK_Telemetry_${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function openSim() {
  lastModalTrigger = document.activeElement;
  document.getElementById('sim-modal').classList.add('show');
  lockBodyScroll(true);
  setActiveButton('btn-sim');
  runSim();
  focusFirstInModal('#sim-modal .close-btn');
}

function closeSim(e) {
  if (e && e.target && !e.target.classList.contains('modal-overlay')) return;
  document.getElementById('sim-modal').classList.remove('show');
  lockBodyScroll(isRefOpen());
  setActiveButton(currentMode === 'calc' ? 'btn-calc' : currentMode === 'table' ? 'btn-table' : 'btn-log');
  restoreFocus();
}

function openRef() {
  lastModalTrigger = document.activeElement;
  document.getElementById('ref-modal').style.display = 'flex';
  lockBodyScroll(true);
  setActiveButton('btn-ref');
  focusFirstInModal('#ref-modal .ref-close-btn');
}

function closeRef(e) {
  if (e && e.target && e.target.id !== 'ref-modal') return;
  document.getElementById('ref-modal').style.display = 'none';
  lockBodyScroll(isSimOpen());
  setActiveButton(currentMode === 'calc' ? 'btn-calc' : currentMode === 'table' ? 'btn-table' : 'btn-log');
  restoreFocus();
}

function runSim() {
  const tickIndex = parseInt(document.getElementById('sim-sl-cur').value, 10);
  const curGal = LEVELS[tickIndex].gal;
  const curEth = clampNumber(getValue('inp-eth', DEFAULTS.curEth), 0, 100, DEFAULTS.curEth);
  const tgtEthRaw = clampNumber(document.getElementById('sim-sl-tgt').value, 0, 100, DEFAULTS.tgtEth);
  const maxEth = clampNumber(getValue('inp-max-eth', DEFAULTS.maxEth), 0, 100, DEFAULTS.maxEth);
  const tgtEth = Math.min(tgtEthRaw, maxEth);
  const pumpE85 = clampNumber(getValue('inp-pump-e85', DEFAULTS.pumpE85), 40, 100, DEFAULTS.pumpE85);
  const pumpGas = clampNumber(getValue('inp-pump-gas', DEFAULTS.pumpGas), 0, 15, DEFAULTS.pumpGas);
  const emptySpace = Math.max(0, TANK - curGal);
  const result = computeBlend(curGal, curEth, tgtEth, pumpE85, pumpGas, 'full', 0);

  document.getElementById('sim-val-cur').innerHTML = curGal.toFixed(1) + '<span style="font-size:16px;"> GAL</span>';
  document.getElementById('sim-val-tgt').textContent = tgtEthRaw > maxEth ? `E${tgtEth} cap` : 'E' + tgtEth;
  document.getElementById('sim-stat-empty').textContent = emptySpace.toFixed(1) + ' GAL';
  document.getElementById('sim-stat-ideal').textContent = result.error ? '—' : result.idealE85.toFixed(1) + ' GAL';
  document.getElementById('sim-stat-max').textContent = result.error ? '—' : 'E' + result.resultEth;

  const curP = (curGal / TANK) * 100;
  const e85P = (result.e85Display / TANK) * 100;
  const c93P = (result.c93Display / TANK) * 100;

  const sfhCur = document.getElementById('sfh-cur');
  const sfhE85 = document.getElementById('sfh-e85');
  const sfh93 = document.getElementById('sfh-93');

  sfhCur.style.width = curP + '%'; sfhCur.style.left = '0%';
  sfhE85.style.width = e85P + '%'; sfhE85.style.left = curP + '%';
  sfh93.style.width = c93P + '%'; sfh93.style.left = (curP + e85P) + '%';

  document.getElementById('pct-cur').textContent = 'In: ' + curGal.toFixed(1);
  document.getElementById('pct-e85').textContent = 'E85: ' + result.e85Display.toFixed(1);
  document.getElementById('pct-93').textContent = '93: ' + result.c93Display.toFixed(1);

  const alertEl = document.getElementById('sim-alert');
  if (result.error) {
    alertEl.className = 'sim-alert trap';
    alertEl.innerHTML = `<strong>⚠ ERROR:</strong> ${result.error}`;
  } else if (tgtEthRaw > maxEth) {
    alertEl.className = 'sim-alert trap';
    alertEl.innerHTML = `<strong>⚠ CEILING ACTIVE:</strong> Target limited to E${maxEth.toFixed(0)} by the ceiling setting.`;
  } else if (result.limited) {
    alertEl.className = 'sim-alert trap';
    alertEl.innerHTML = `<strong>⚠ TRAP ACTIVATED:</strong> Need ${result.idealE85.toFixed(1)}g E85 but only have ${result.fillVolume.toFixed(1)}g of space. Max achievable is E${result.resultEth}.`;
  } else {
    alertEl.className = 'sim-alert ok';
    alertEl.innerHTML = `<strong>✓ TARGET CLEAR:</strong> Room to fit ${result.e85Display.toFixed(1)}g of E85 safely.`;
  }

  document.querySelectorAll('.sim-t').forEach((t, i) => {
    t.classList.toggle('on', i === tickIndex);
  });
}

function setMode(m) {
  currentMode = m;
  document.getElementById('calc-view').style.display = m === 'calc' ? 'block' : 'none';
  document.getElementById('table-view').style.display = m === 'table' ? 'block' : 'none';
  document.getElementById('log-view').style.display = m === 'log' ? 'block' : 'none';
  setActiveButton(m === 'calc' ? 'btn-calc' : m === 'table' ? 'btn-table' : 'btn-log');
}

function resetDefault() {
  safeRemoveItem('tgtEth');
  safeRemoveItem('curEth');
  safeRemoveItem('maxEth');
  safeRemoveItem('pumpE85');
  safeRemoveItem('pumpGas');
  safeRemoveItem('ambientTempF');
  safeRemoveItem('priceE85');
  safeRemoveItem('price93');
  safeRemoveItem('fillMode');
  safeRemoveItem('addGallons');
  safeRemoveItem('logSyncEnabled');
  safeRemoveItem('wrxFuelLogs');
  location.reload();
}

function generateStaticTable(targetEth, curEth, pumpE85, pumpGas) {
  const tbody = document.getElementById('static-chart-body');
  if (!tbody) return;
  tbody.innerHTML = LEVELS.map((l, i) => {
    const maxEth = clampNumber(getValue('inp-max-eth', DEFAULTS.maxEth), 0, 100, DEFAULTS.maxEth);
    const result = computeBlend(l.gal, curEth, Math.min(targetEth, maxEth), pumpE85, pumpGas, 'full', 0);
    const w = (l.gal / TANK) * 100;
    return `<tr ${i === 0 ? 'class="lf"' : ''}>
     <td><div class="gcell"><div><div class="glv">${l.label} Tank</div><div class="gsub">~${l.gal.toFixed(1)} gal remaining<div class="fbw"><div class="fb" style="width:${w}%"></div></div></div></div></div></td>
     <td><span class="tv">${result.fillVolume.toFixed(1)} gal</span></td>
     <td><span class="ev">${result.e85Display.toFixed(2)}<span class="u">gal</span></span></td>
     <td><span class="cv">${result.c93Display.toFixed(2)}<span class="u">gal</span></span></td>
   </tr>`;
  }).join('');
}

function handleGlobalKeydown(e) {
  if (e.key !== 'Escape') return;
  if (isSimOpen()) closeSim(null);
  if (isRefOpen()) closeRef(null);
}

window.onload = function () {
  const curEth = safeGetItem('curEth', DEFAULTS.curEth);
  const tgtEth = safeGetItem('tgtEth', DEFAULTS.tgtEth);
  const maxEth = safeGetItem('maxEth', DEFAULTS.maxEth);
  const pumpE85 = safeGetItem('pumpE85', DEFAULTS.pumpE85);
  const pumpGas = safeGetItem('pumpGas', DEFAULTS.pumpGas);
  const ambientTempF = safeGetItem('ambientTempF', defaultAmbientFromSeason());
  const priceE85 = safeGetItem('priceE85', DEFAULTS.priceE85);
  const price93 = safeGetItem('price93', DEFAULTS.price93);
  const fillMode = normalizeFillMode(safeGetItem('fillMode', DEFAULTS.fillMode));
  const addGallons = safeGetItem('addGallons', DEFAULTS.addGallons);
  const syncEnabled = safeGetItem('logSyncEnabled', DEFAULTS.syncEnabled ? '1' : '0') !== '0';

  setValue('inp-eth', curEth);
  setValue('inp-tgt', tgtEth);
  setValue('inp-max-eth', maxEth);
  setValue('inp-pump-e85', pumpE85);
  setValue('inp-pump-gas', pumpGas);
  setValue('inp-amb-temp', ambientTempF);
  setValue('inp-price-e85', priceE85);
  setValue('inp-price-93', price93);
  setValue('inp-add-gal', addGallons);
  const syncBox = document.getElementById('chk-sync');
  if (syncBox) syncBox.checked = syncEnabled;
  syncModeUI(fillMode);
  clearLogEditMode();

  const savedLogs = safeGetItem('wrxFuelLogs', '');
  if (savedLogs) {
    try {
      fuelLogs = JSON.parse(savedLogs);
    } catch (e) {
      fuelLogs = [];
    }
  }

  const gal = clampNumber(getValue('inp-gal', 0), 0, TANK, 0);
  setValue('inp-gal', gal.toFixed(1));
  const matchIndex = LEVELS.findIndex(l => Math.abs(l.gal - gal) < 0.1);
  document.getElementById('sl').value = matchIndex === -1 ? 0 : matchIndex;

  const cachedWeather = getWeatherCache();
  if (cachedWeather && !safeGetItem('ambientTempF', '')) {
    setValue('inp-amb-temp', Number(cachedWeather.tempF).toFixed(0));
    safeSetItem('ambientTempF', Number(cachedWeather.tempF));
  }

  sanitizeAndPersistInputs();
  renderLogs();
  calculateBlend();
  const liveStatus = document.getElementById('weather-status');
  if (liveStatus) liveStatus.textContent = 'Live weather is optional. Manual input stays available.';
  useFuelPriceSnapshotAuto();
  document.addEventListener('keydown', handleGlobalKeydown);
};
