/**
 * SCRK Ethanol Calculator — Shared Type Definitions
 * TypeScript interfaces for the FA24 WRX Flex Fuel Calculator state
 */

// ─── Fill Log Entry ────────────────────────────────────────────────
export interface FillLogEntry {
  id: string;
  date: string;
  station: string;

  /** Calculated E85 gallons to add */
  e85Needed: number;
  /** Calculated 93-octane gallons to add */
  c93Needed: number;

  /** Actual E85 gallons pumped */
  actualE85: number | null;
  /** Actual 93-octane gallons pumped */
  actualC93: number | null;

  /** Predicted ethanol % after fill */
  ethResult: number;
  /** AP-confirmed live ethanol % reading */
  apEth: number | null;

  /** Total fill cost */
  fillCost: number | null;

  /** Tank level tick (0–8 mapped to LEVELS array) */
  tick: number;

  /** Fill mode: 'full' | 'partial' | 'custom' */
  fillMode: FillMode;
}

// ─── App State ─────────────────────────────────────────────────────
export interface AppState {
  /** Current ethanol % in tank */
  curEth: number;
  /** Target ethanol % */
  tgtEth: number;
  /** Maximum ethanol % pump can deliver */
  maxEth: number;
  /** Pump E85 actual ethanol % (typically 85) */
  pumpE85: number;
  /** Pump 93-octane ethanol % (typically 10) */
  pumpGas: number;
  /** Ambient temperature °F (for volatility calculation) */
  ambientTempF: number;
  /** Price per gallon for E85 */
  priceE85: number;
  /** Price per gallon for 93-octane */
  price93: number;
  /** Current fill mode */
  fillMode: FillMode;
  /** Gallons to add in partial/custom mode */
  addGallons: number;
  /** Whether cloud telemetry sync is enabled */
  syncEnabled: boolean;
}

// ─── Fuel Price Data ───────────────────────────────────────────────
export interface FuelStation {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  lat?: number;
  lon?: number;
  distanceMiles?: number;
  priceE85?: number | null;
  price93?: number | null;
}

export interface FuelPriceGroup {
  stations: FuelStation[];
  fetchedAt: string;
  source: string;
}

export interface FuelPricesPayload {
  e85?: FuelPriceGroup;
  gas?: FuelPriceGroup;
}

export interface FuelPriceCache {
  payload: FuelPricesPayload;
  fetchedAt: number;
  lat: number;
  lon: number;
}

// ─── Weather Cache ─────────────────────────────────────────────────
export interface WeatherCache {
  tempF: number;
  sourceLabel: string;
  detailLabel: string;
  fetchedAt: number;
}

// ─── LocalStorage Keys ─────────────────────────────────────────────
export type LocalStorageKey =
  | 'wrxFuelLogs'
  | 'wrxWeatherCache'
  | 'wrxFuelPricesCache'
  | 'wrxCurEth'
  | 'wrxTgtEth'
  | 'wrxMaxEth'
  | 'wrxPumpE85'
  | 'wrxPumpGas'
  | 'wrxAmbientTempF'
  | 'wrxPriceE85'
  | 'wrxPrice93'
  | 'wrxFillMode'
  | 'wrxAddGallons'
  | 'wrxSyncEnabled';

// ─── Fill Mode ─────────────────────────────────────────────────────
export type FillMode = 'full' | 'partial' | 'custom';

// ─── Calculator Output ─────────────────────────────────────────────
export interface CalcResult {
  e85Gal: number;
  c93Gal: number;
  resultEth: number;
  costE85: number;
  cost93: number;
  totalCost: number;
  isPhysicallyPossible: boolean;
  limitReason?: string;
}

// ─── UI Status Kind ────────────────────────────────────────────────
export type StatusKind = 'ok' | 'warn' | 'error' | 'info' | 'loading';

// ─── Tank Level ─────────────────────────────────────────────────────
export interface TankLevel {
  gal: number;
  label: string;
}

// ─── Cleaning Advisory ─────────────────────────────────────────────
export interface CleaningStreak {
  count: number;
  needsCleaning: boolean;
  lastCleanAt: string | null;
}
