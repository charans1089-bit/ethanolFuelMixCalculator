import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const FUEL_SEARCH = (process.env.FUEL_SEARCH || '').trim() || 'Dearborn, MI';
const MAX_AGE_DAYS = Number.parseInt(process.env.FUEL_MAX_AGE_DAYS || '3', 10);
const MAX_ITEMS = Number.parseInt(process.env.FUEL_MAX_ITEMS || '25', 10);
const ACTOR_ID = 'johnvc/fuelprices';
const OUTPUT_PATH = path.resolve('data', 'fuel-prices.json');

if (!APIFY_TOKEN) {
    throw new Error('Missing APIFY_API_TOKEN. Set it in GitHub Secrets.');
}

const toNum = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') {
        const trimmed = v.trim();
        if (!trimmed) return null;
        const normalized = trimmed.replace(/[$,]/g, '');
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const pickPrice = (item, keys) => {
    for (const key of keys) {
        const value = toNum(item?.[key]);
        if (Number.isFinite(value) && value > 0) return value;
    }
    return null;
};

function normalizeItem(item) {
    const cash = pickPrice(item, ['price_cash', 'cash', 'priceCash']);
    const credit = pickPrice(item, ['price_credit', 'credit', 'priceCredit']);
    const bestPrice = cash !== null && credit !== null
        ? Math.min(cash, credit)
        : (cash ?? credit);

    if (bestPrice === null || bestPrice <= 0) return null;

    return {
        id: item?.id ?? null,
        name: item?.name ?? 'Unknown',
        address: {
            line1: item?.address_line1 ?? '',
            line2: item?.address_line2 ?? '',
            city: item?.address_locality ?? '',
            region: item?.address_region ?? '',
            postalCode: item?.address_postalCode ?? ''
        },
        distance: toNum(item?.distance),
        distanceUnit: item?.distanceUnit ?? item?.distance_unit ?? null,
        starRating: toNum(item?.starRating),
        ratingsCount: toNum(item?.ratingsCount),
        priceUnit: item?.priceUnit ?? 'dollars_per_gallon',
        cash,
        cashPostedTime: item?.price_cash_postedTime ?? null,
        credit,
        creditPostedTime: item?.price_credit_postedTime ?? null,
        bestPrice
    };
}

function summarize(stations, fuelCode) {
    const prices = stations.map(s => s.bestPrice).filter(Number.isFinite);
    const count = prices.length;
    const avg = count ? Number((prices.reduce((a, b) => a + b, 0) / count).toFixed(3)) : null;
    const min = count ? Math.min(...prices) : null;
    const max = count ? Math.max(...prices) : null;

    return {
        fuelCode,
        count,
        avg,
        min,
        max,
        stations
    };
}

async function fetchFuel(fuelCode) {
    const endpoint = `https://api.apify.com/v2/acts/${encodeURIComponent(ACTOR_ID)}/run-sync-get-dataset-items?token=${encodeURIComponent(APIFY_TOKEN)}&clean=true`;
    const body = {
        search: FUEL_SEARCH,
        fuel: fuelCode,
        lang: 'en',
        maxAge: Number.isFinite(MAX_AGE_DAYS) ? MAX_AGE_DAYS : 3
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Apify request failed (${response.status}): ${errorText.slice(0, 300)}`);
    }

    const data = await response.json();
    const items = Array.isArray(data) ? data : [];

    return items
        .map(normalizeItem)
        .filter(Boolean)
        .sort((a, b) => (a.bestPrice - b.bestPrice) || String(a.name).localeCompare(String(b.name)))
        .slice(0, Number.isFinite(MAX_ITEMS) && MAX_ITEMS > 0 ? MAX_ITEMS : 25);
}

function buildFingerprint(payload) {
    const stable = JSON.stringify({
        search: payload.search,
        maxAgeDays: payload.maxAgeDays,
        e85: payload.e85,
        premium93: payload.premium93
    });
    return createHash('sha256').update(stable).digest('hex');
}

async function readExisting() {
    try {
        const raw = await fs.readFile(OUTPUT_PATH, 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function main() {
    const [e85Stations, p93Stations] = await Promise.all([
        fetchFuel(5),
        fetchFuel(3)
    ]);

    const output = {
        schemaVersion: 1,
        source: `Apify ${ACTOR_ID}`,
        search: FUEL_SEARCH,
        maxAgeDays: Number.isFinite(MAX_AGE_DAYS) ? MAX_AGE_DAYS : 3,
        generatedAt: new Date().toISOString(),
        e85: summarize(e85Stations, 5),
        premium93: summarize(p93Stations, 3)
    };

    output.fingerprint = buildFingerprint(output);

    const existing = await readExisting();
    if (existing?.fingerprint && existing.fingerprint === output.fingerprint && existing.generatedAt) {
        output.generatedAt = existing.generatedAt;
    }

    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

    console.log(`Saved ${OUTPUT_PATH}`);
    console.log(`Search: ${output.search}`);
    console.log(`E85 stations: ${output.e85.count} | Premium stations: ${output.premium93.count}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
