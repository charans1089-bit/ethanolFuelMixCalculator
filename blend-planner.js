/**
 * SCRK Seasonal Blend Planner - Core Logic & Gamification Engine
 * Handles Calendar, Telemetry Parsing, Compliance, Storage, and UI Binding
 */

(function () {
  'use strict';

  // --- Safe LocalStorage Access ---
  function safeGetItem(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function safeSetItem(key, val) {
    try {
      localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
    } catch (e) {
      console.warn('LocalStorage write failed:', e);
    }
  }

  function safeRemoveItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }

  function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Seasonal Recommendations Database ---
  const LOCATION_PRESETS = {
    dearborn: {
      name: 'Dearborn, MI (Standard Northern)',
      months: [
        { name: 'January', temp: 25, recommendation: 'E30–E40', midpoint: 35, desc: 'Winter baseline · cold start protection', band: 'e20' },
        { name: 'February', temp: 28, recommendation: 'E30–E40', midpoint: 35, desc: 'Sub-freezing safety · fast warmup', band: 'e20' },
        { name: 'March', temp: 38, recommendation: 'E35–E45', midpoint: 40, desc: 'Late winter transition · balanced knock headroom', band: 'e35' },
        { name: 'April', temp: 55, recommendation: 'E50–E60', midpoint: 55, desc: 'Spring thaw · boost safely increasing', band: 'e50' },
        { name: 'May', temp: 65, recommendation: 'E60–E70', midpoint: 65, desc: 'Warm spring · optimal ignition timing', band: 'e50' },
        { name: 'June', temp: 75, recommendation: 'E70+', midpoint: 75, desc: 'Summer race season · maximum knock resistance', band: 'e70' },
        { name: 'July', temp: 82, recommendation: 'E70+', midpoint: 80, desc: 'Peak summer heat · high boost & timing', band: 'e70' },
        { name: 'August', temp: 80, recommendation: 'E70+', midpoint: 80, desc: 'Sustained high temp · max charge cooling', band: 'e70' },
        { name: 'September', temp: 70, recommendation: 'E60–E70', midpoint: 65, desc: 'Early fall taper · strong power & drivability', band: 'e50' },
        { name: 'October', temp: 58, recommendation: 'E50–E60', midpoint: 55, desc: 'Cooling air · transition to mid blends', band: 'e50' },
        { name: 'November', temp: 42, recommendation: 'E35–E45', midpoint: 40, desc: 'Pre-winter cooling · easing ethanol content', band: 'e35' },
        { name: 'December', temp: 30, recommendation: 'E30–E40', midpoint: 35, desc: 'Winter return · prioritize cold start vapor', band: 'e20' }
      ]
    },
    phoenix: {
      name: 'Phoenix, AZ (Desert Hot)',
      months: [
        { name: 'January', temp: 58, recommendation: 'E50–E60', midpoint: 55, desc: 'Mild winter · moderate ethanol safe', band: 'e50' },
        { name: 'February', temp: 62, recommendation: 'E55–E65', midpoint: 60, desc: 'Warm spring start · boost ready', band: 'e50' },
        { name: 'March', temp: 69, recommendation: 'E60–E70', midpoint: 65, desc: 'Rapid warming · full timing advances', band: 'e50' },
        { name: 'April', temp: 77, recommendation: 'E70+', midpoint: 75, desc: 'Early heat wave · max ethanol', band: 'e70' },
        { name: 'May', temp: 86, recommendation: 'E70+', midpoint: 80, desc: 'Intense sunshine · charge cooling critical', band: 'e70' },
        { name: 'June', temp: 96, recommendation: 'E70+', midpoint: 80, desc: 'Extreme desert heat · maximum knock buffer', band: 'e70' },
        { name: 'July', temp: 104, recommendation: 'E70+', midpoint: 80, desc: 'Peak heat · straight E85/E70+ mandatory for boost', band: 'e70' },
        { name: 'August', temp: 102, recommendation: 'E70+', midpoint: 80, desc: 'Severe heat · keep intake temps in check', band: 'e70' },
        { name: 'September', temp: 94, recommendation: 'E70+', midpoint: 80, desc: 'Late summer · maintain high octane', band: 'e70' },
        { name: 'October', temp: 81, recommendation: 'E65–E75', midpoint: 70, desc: 'Gradual cooling · high blend headroom', band: 'e70' },
        { name: 'November', temp: 67, recommendation: 'E55–E65', midpoint: 60, desc: 'Comfortable fall · mid blends', band: 'e50' },
        { name: 'December', temp: 57, recommendation: 'E50–E60', midpoint: 55, desc: 'Mild desert winter · solid power', band: 'e50' }
      ]
    },
    minneapolis: {
      name: 'Minneapolis, MN (Sub-Zero Winter)',
      months: [
        { name: 'January', temp: 16, recommendation: 'E20–E30', midpoint: 25, desc: 'Extreme cold · high volatility needed', band: 'e20' },
        { name: 'February', temp: 20, recommendation: 'E20–E30', midpoint: 25, desc: 'Deep freeze · avoid cold start crank wear', band: 'e20' },
        { name: 'March', temp: 33, recommendation: 'E30–E40', midpoint: 35, desc: 'Late thaw · moderate blend', band: 'e20' },
        { name: 'April', temp: 48, recommendation: 'E40–E50', midpoint: 45, desc: 'Spring arrival · stepping up ethanol', band: 'e35' },
        { name: 'May', temp: 60, recommendation: 'E55–E65', midpoint: 60, desc: 'Mild spring · strong boost gains', band: 'e50' },
        { name: 'June', temp: 71, recommendation: 'E70+', midpoint: 75, desc: 'Summer racing · high octane peak', band: 'e70' },
        { name: 'July', temp: 76, recommendation: 'E70+', midpoint: 75, desc: 'Peak warmth · max timing performance', band: 'e70' },
        { name: 'August', temp: 73, recommendation: 'E70+', midpoint: 75, desc: 'Warm tracks · charge temp protection', band: 'e70' },
        { name: 'September', temp: 64, recommendation: 'E55–E65', midpoint: 60, desc: 'Fall crisp air · high density power', band: 'e50' },
        { name: 'October', temp: 50, recommendation: 'E40–E50', midpoint: 45, desc: 'Autumn chill · start winter prep', band: 'e35' },
        { name: 'November', temp: 34, recommendation: 'E30–E40', midpoint: 35, desc: 'Freezing temps · reduce ethanol', band: 'e20' },
        { name: 'December', temp: 21, recommendation: 'E20–E30', midpoint: 25, desc: 'Winter freeze · minimize startup strain', band: 'e20' }
      ]
    },
    denver: {
      name: 'Denver, CO (Mile High Altitude)',
      months: [
        { name: 'January', temp: 31, recommendation: 'E30–E40', midpoint: 35, desc: 'High altitude winter · ensure vapor pressure', band: 'e20' },
        { name: 'February', temp: 33, recommendation: 'E30–E40', midpoint: 35, desc: 'Mountain cold · crisp start safety', band: 'e20' },
        { name: 'March', temp: 41, recommendation: 'E35–E45', midpoint: 40, desc: 'Spring snow/sun · balanced mix', band: 'e35' },
        { name: 'April', temp: 48, recommendation: 'E45–E55', midpoint: 50, desc: 'Thin air turbo spooling · ramping up', band: 'e50' },
        { name: 'May', temp: 57, recommendation: 'E55–E65', midpoint: 60, desc: 'Elevation power recovery · high octane', band: 'e50' },
        { name: 'June', temp: 68, recommendation: 'E70+', midpoint: 75, desc: 'Summer mountain runs · max knock safety', band: 'e70' },
        { name: 'July', temp: 75, recommendation: 'E70+', midpoint: 75, desc: 'Hot summer altitude · peak boost', band: 'e70' },
        { name: 'August', temp: 73, recommendation: 'E70+', midpoint: 75, desc: 'Track days & canyon runs · high ethanol', band: 'e70' },
        { name: 'September', temp: 64, recommendation: 'E60–E70', midpoint: 65, desc: 'Ideal density altitude · great power', band: 'e50' },
        { name: 'October', temp: 51, recommendation: 'E45–E55', midpoint: 50, desc: 'Fall mountain air · step down blend', band: 'e50' },
        { name: 'November', temp: 39, recommendation: 'E35–E45', midpoint: 40, desc: 'Cold nights · safe transition', band: 'e35' },
        { name: 'December', temp: 30, recommendation: 'E30–E40', midpoint: 35, desc: 'Winter baseline · smooth cold starts', band: 'e20' }
      ]
    },
    austin: {
      name: 'Austin, TX (Southern Warmth)',
      months: [
        { name: 'January', temp: 52, recommendation: 'E45–E55', midpoint: 50, desc: 'Mild winter · safe mid-blend', band: 'e50' },
        { name: 'February', temp: 56, recommendation: 'E50–E60', midpoint: 55, desc: 'Quick warmup · increasing boost', band: 'e50' },
        { name: 'March', temp: 63, recommendation: 'E60–E70', midpoint: 65, desc: 'Warm spring · aggressive timing', band: 'e50' },
        { name: 'April', temp: 71, recommendation: 'E70+', midpoint: 75, desc: 'High boost season starts', band: 'e70' },
        { name: 'May', temp: 79, recommendation: 'E70+', midpoint: 75, desc: 'Hot humid air · charge cooling essential', band: 'e70' },
        { name: 'June', temp: 85, recommendation: 'E70+', midpoint: 80, desc: 'Summer scorch · straight E85 safety', band: 'e70' },
        { name: 'July', temp: 88, recommendation: 'E70+', midpoint: 80, desc: 'Extreme summer · max knock ceiling', band: 'e70' },
        { name: 'August', temp: 89, recommendation: 'E70+', midpoint: 80, desc: 'Peak heat · keep intercooler and fuel cool', band: 'e70' },
        { name: 'September', temp: 82, recommendation: 'E70+', midpoint: 80, desc: 'Lingering summer heat · high octane', band: 'e70' },
        { name: 'October', temp: 72, recommendation: 'E65–E75', midpoint: 70, desc: 'Mild fall · excellent racing weather', band: 'e70' },
        { name: 'November', temp: 61, recommendation: 'E55–E65', midpoint: 60, desc: 'Cooling trends · solid mid-range', band: 'e50' },
        { name: 'December', temp: 53, recommendation: 'E45–E55', midpoint: 50, desc: 'Mild winter baseline', band: 'e50' }
      ]
    }
  };

  // --- Initial State ---
  let state = {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(), // 0-indexed
    activeLocationKey: 'dearborn',
    activeGoal: 'Maximize Reliability & Performance',
    fills: [],
    notesMap: {},
    badges: [
      { id: 'winter-warrior', name: 'Winter Warrior', icon: '❄️', desc: 'Logged E30–E40 in Jan–Mar for safe cold starts', unlocked: false },
      { id: 'summer-specialist', name: 'Summer Specialist', icon: '☀️', desc: 'Logged E70+ during hot summer (Jun–Aug)', unlocked: false },
      { id: 'perfect-compliance', name: 'Perfect Compliance', icon: '🎯', desc: 'Achieved 100% recommendation match on 5+ fills', unlocked: false },
      { id: 'streak-master', name: 'Streak Master', icon: '🔥', desc: 'Maintained a 5+ consecutive fill blend streak', unlocked: false },
      { id: 'high-octane-hero', name: 'High-Octane Hero', icon: '⛽', desc: 'Logged 10+ total fill telemetry records', unlocked: false },
      { id: 'master-blender', name: 'Master Blender', icon: '🧪', desc: 'Logged fuel fills across all 4 distinct seasons', unlocked: false },
      { id: 'track-ready', name: 'Track Ready', icon: '🏎️', desc: 'Sustained high ethanol E70+ for 4+ consecutive fills', unlocked: false }
    ],
    stats: {
      compliancePct: 100,
      totalFills: 0,
      streak: 0,
      avgEth30: 0,
      avgEthAll: 0,
      sustainedE75Weeks: 0,
      totalCost: 0,
      commonStation: '—',
      highestMonth: '—'
    }
  };

  // Auto-clean metrics older than 2 years
  function cleanupOldMetrics() {
    try {
      const twoYearsAgo = Date.now() - (730 * 24 * 60 * 60 * 1000);
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('blendPlannerStats-')) {
          const parts = key.replace('blendPlannerStats-', '').split('-');
          if (parts.length >= 2) {
            const keyDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1).getTime();
            if (keyDate < twoYearsAgo) {
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (e) {}
  }

  // Load telemetry logs from wrxFuelLogs (READ ONLY)
  function loadTelemetryLogs() {
    try {
      const raw = safeGetItem('wrxFuelLogs', '[]');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.fills = parsed;
      }
    } catch (e) {
      state.fills = [];
    }
  }

  // Load planner-specific settings & notes
  function loadPlannerData() {
    try {
      const rawNotes = safeGetItem('blendPlannerNotes', '{}');
      state.notesMap = JSON.parse(rawNotes) || {};
    } catch (e) {
      state.notesMap = {};
    }

    try {
      const rawMetrics = safeGetItem('blendPlannerMetrics', '{}');
      const metricsObj = JSON.parse(rawMetrics);
      if (metricsObj.location && LOCATION_PRESETS[metricsObj.location]) {
        state.activeLocationKey = metricsObj.location;
      }
      if (metricsObj.goal) {
        state.activeGoal = metricsObj.goal;
      }
      if (Array.isArray(metricsObj.unlockedBadgeIds)) {
        state.badges.forEach(b => {
          if (metricsObj.unlockedBadgeIds.includes(b.id)) {
            b.unlocked = true;
          }
        });
      }
    } catch (e) {}
  }

  function savePlannerData() {
    safeSetItem('blendPlannerNotes', JSON.stringify(state.notesMap));
    const unlockedBadgeIds = state.badges.filter(b => b.unlocked).map(b => b.id);
    safeSetItem('blendPlannerMetrics', JSON.stringify({
      location: state.activeLocationKey,
      goal: state.activeGoal,
      unlockedBadgeIds,
      updatedAt: new Date().toISOString()
    }));
  }

  function getMonthsData() {
    const loc = LOCATION_PRESETS[state.activeLocationKey] || LOCATION_PRESETS.dearborn;
    return loc.months;
  }

  // Parse a date string into Year, Month (0-11), Day
  function parseFillDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
    }
    // Try manual matching for MM/DD/YYYY
    const parts = String(dateStr).split(/[\s,T/-]+/);
    if (parts.length >= 3) {
      const m = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      if (!isNaN(m) && !isNaN(day) && !isNaN(y)) {
        return { year: y < 100 ? 2000 + y : y, month: m, day };
      }
    }
    return null;
  }

  // Calculate statistics, compliance, and badges
  function calculateMetrics() {
    const monthsData = getMonthsData();
    const fills = state.fills;
    state.stats.totalFills = fills.length;

    if (!fills.length) {
      state.stats.compliancePct = 100;
      state.stats.streak = 0;
      state.stats.avgEth30 = 0;
      state.stats.avgEthAll = 0;
      state.stats.sustainedE75Weeks = 0;
      state.stats.totalCost = 0;
      state.stats.commonStation = 'No logs yet';
      state.stats.highestMonth = '—';
      return;
    }

    let matchCount = 0;
    let totalCost = 0;
    let ethSumAll = 0;
    let ethCountAll = 0;
    let ethSum30 = 0;
    let ethCount30 = 0;
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const stationCounts = {};

    let currentStreak = 0;
    let streakBroken = false;
    let sustainedE75Count = 0;
    let sustainedE75Active = true;

    // Track seasons for badge: 0=Winter (Dec,Jan,Feb), 1=Spring (Mar,Apr,May), 2=Summer (Jun,Jul,Aug), 3=Fall (Sep,Oct,Nov)
    const seasonsLogged = new Set();
    let winterCompliantFills = 0;
    let summerHighFills = 0;

    fills.forEach(fill => {
      const cost = Number(fill.fillCost);
      if (Number.isFinite(cost)) totalCost += cost;

      const eth = Number(fill.eth);
      if (Number.isFinite(eth)) {
        ethSumAll += eth;
        ethCountAll++;
      }

      if (fill.station) {
        const s = fill.station.trim();
        stationCounts[s] = (stationCounts[s] || 0) + 1;
      }

      const pDate = parseFillDate(fill.date);
      if (pDate) {
        // Check 30-day window
        const fillTime = new Date(pDate.year, pDate.month, pDate.day).getTime();
        if (fillTime >= thirtyDaysAgo && Number.isFinite(eth)) {
          ethSum30 += eth;
          ethCount30++;
        }

        // Season check
        const m = pDate.month;
        if (m === 11 || m === 0 || m === 1) seasonsLogged.add('winter');
        else if (m >= 2 && m <= 4) seasonsLogged.add('spring');
        else if (m >= 5 && m <= 7) seasonsLogged.add('summer');
        else seasonsLogged.add('fall');

        const monthTarget = monthsData[m];
        // Compliance: within ±7% or both E70+
        const isMatch = Math.abs(eth - monthTarget.midpoint) <= 7 || (eth >= 70 && monthTarget.midpoint >= 70);
        if (isMatch) {
          matchCount++;
          if (!streakBroken) currentStreak++;
        } else {
          streakBroken = true;
        }

        if ((m === 0 || m === 1 || m === 2) && eth >= 30 && eth <= 48) {
          winterCompliantFills++;
        }
        if ((m === 5 || m === 6 || m === 7) && eth >= 68) {
          summerHighFills++;
        }
      }

      if (Number.isFinite(eth) && eth >= 74) {
        if (sustainedE75Active) sustainedE75Count++;
      } else {
        sustainedE75Active = false;
      }
    });

    state.stats.compliancePct = Math.round((matchCount / fills.length) * 100);
    state.stats.streak = currentStreak;
    state.stats.totalCost = totalCost;
    state.stats.avgEthAll = ethCountAll ? Math.round(ethSumAll / ethCountAll) : 0;
    state.stats.avgEth30 = ethCount30 ? Math.round(ethSum30 / ethCount30) : state.stats.avgEthAll;
    state.stats.sustainedE75Weeks = Math.max(0, Math.floor(sustainedE75Count * 1.2));

    // Station
    let maxStation = '—';
    let maxCount = 0;
    Object.keys(stationCounts).forEach(st => {
      if (stationCounts[st] > maxCount) {
        maxCount = stationCounts[st];
        maxStation = st;
      }
    });
    state.stats.commonStation = maxStation !== '—' ? `${maxStation} (${maxCount} fills)` : 'Various';

    // Evaluate Badges
    state.badges.forEach(b => {
      if (b.id === 'winter-warrior' && winterCompliantFills >= 1) b.unlocked = true;
      if (b.id === 'summer-specialist' && summerHighFills >= 1) b.unlocked = true;
      if (b.id === 'perfect-compliance' && fills.length >= 5 && state.stats.compliancePct === 100) b.unlocked = true;
      if (b.id === 'streak-master' && currentStreak >= 5) b.unlocked = true;
      if (b.id === 'high-octane-hero' && fills.length >= 10) b.unlocked = true;
      if (b.id === 'master-blender' && seasonsLogged.size >= 4) b.unlocked = true;
      if (b.id === 'track-ready' && sustainedE75Count >= 4) b.unlocked = true;
    });

    savePlannerData();
  }

  // --- UI Renderers ---

  function renderHeroPump() {
    const monthsData = getMonthsData();
    const curMonthData = monthsData[state.currentMonth];
    const loc = LOCATION_PRESETS[state.activeLocationKey] || LOCATION_PRESETS.dearborn;

    // Location & Station tag
    const locEl = document.getElementById('pump-loc-name');
    if (locEl) locEl.textContent = loc.name.split('(')[0].trim();

    // Screen Hero Value
    const heroValEl = document.getElementById('screen-recommendation-val');
    if (heroValEl) {
      heroValEl.textContent = curMonthData.recommendation;
    }

    const seasonDescEl = document.getElementById('screen-season-desc');
    if (seasonDescEl) {
      seasonDescEl.innerHTML = `<span>🌡️</span> ${curMonthData.temp}°F Avg · ${curMonthData.desc}`;
    }

    // Octane Pills Highlighting
    const pills = document.querySelectorAll('.octane-pill');
    pills.forEach(p => p.classList.remove('active'));
    if (curMonthData.midpoint >= 70) {
      const p = document.getElementById('pill-e85');
      if (p) p.classList.add('active');
    } else if (curMonthData.midpoint >= 45) {
      const p = document.getElementById('pill-flex');
      if (p) p.classList.add('active');
    } else {
      const p = document.getElementById('pill-winter');
      if (p) p.classList.add('active');
    }

    // Thermometer
    const mercuryEl = document.getElementById('thermometer-mercury-fill');
    const bulbEl = document.getElementById('thermometer-bulb');
    const degEl = document.getElementById('thermometer-deg');
    const seasonEl = document.getElementById('thermometer-season');

    if (degEl) degEl.textContent = `${curMonthData.temp}°F`;
    if (seasonEl) seasonEl.textContent = curMonthData.name;

    // Scale temp: 0°F -> 10%, 100°F -> 95%
    const pct = Math.min(95, Math.max(10, (curMonthData.temp / 100) * 85 + 10));
    if (mercuryEl) {
      mercuryEl.style.height = `${pct}%`;
    }

    // Dynamic bulb color based on temp
    if (bulbEl) {
      if (curMonthData.temp >= 75) bulbEl.style.background = '#ff2a4b';
      else if (curMonthData.temp >= 55) bulbEl.style.background = '#ff8c00';
      else if (curMonthData.temp >= 35) bulbEl.style.background = '#00dc82';
      else bulbEl.style.background = '#0080ff';
    }

    // Status Message & Dynamic Callout
    const statusTitleEl = document.getElementById('status-callout-title');
    const statusDescEl = document.getElementById('status-callout-desc');
    if (statusTitleEl && statusDescEl) {
      if (state.stats.streak >= 4) {
        statusTitleEl.innerHTML = '🔥 HIGH ETHANOL STREAK ACTIVE!';
        statusDescEl.textContent = `You've executed ${state.stats.streak} consecutive fills on target! Peak combustion efficiency locked in.`;
      } else if (curMonthData.temp <= 32) {
        statusTitleEl.innerHTML = '❄️ COLD WEATHER INCOMING';
        statusDescEl.textContent = 'Ethanol needs extra heat to vaporize. Stick to E30–E40 to prevent hard cranking in sub-freezing temps.';
      } else if (curMonthData.midpoint >= 75) {
        statusTitleEl.innerHTML = '🏁 PEAK RACE BLEND OPTIMIZED';
        statusDescEl.textContent = 'High ambient heat elevates knock risk on pump 93. E70+ delivers maximum charge cooling & timing headroom.';
      } else {
        statusTitleEl.innerHTML = '💪 BLEND STRATEGY ON TRACK';
        statusDescEl.textContent = `Current weather calls for ${curMonthData.recommendation}. Clean drivability and crisp throttle response.`;
      }
    }

    // Last Fill Info & Days count
    const lastFillValEl = document.getElementById('last-fill-reading');
    const daysAgoEl = document.getElementById('days-since-last-fill');
    if (state.fills.length) {
      const latest = state.fills[0];
      if (lastFillValEl) {
        lastFillValEl.textContent = `E${latest.eth || '—'} · ${escHtml(latest.station || 'Unknown Station')}`;
      }
      if (daysAgoEl && latest.date) {
        const p = parseFillDate(latest.date);
        if (p) {
          const dTime = new Date(p.year, p.month, p.day).getTime();
          const diffDays = Math.max(0, Math.floor((Date.now() - dTime) / (24 * 60 * 60 * 1000)));
          daysAgoEl.textContent = diffDays === 0 ? 'Today' : `${diffDays}d ago`;
        } else {
          daysAgoEl.textContent = 'Recent';
        }
      }
    } else {
      if (lastFillValEl) lastFillValEl.textContent = 'No fills logged yet';
      if (daysAgoEl) daysAgoEl.textContent = '—';
    }
  }

  function renderStatsPanel() {
    // Speedometer Compliance Gauge
    const gaugeCircle = document.getElementById('compliance-gauge-circle');
    const gaugeText = document.getElementById('compliance-pct-text');
    const pct = state.stats.compliancePct;

    if (gaugeText) gaugeText.textContent = `${pct}%`;
    if (gaugeCircle) {
      // Circumference = 2 * PI * r = 2 * 3.14159 * 40 ≈ 251.2
      const offset = 251.2 - (251.2 * pct) / 100;
      gaugeCircle.style.strokeDashoffset = offset;
      if (pct >= 85) gaugeCircle.style.stroke = 'var(--electric-green)';
      else if (pct >= 65) gaugeCircle.style.stroke = 'var(--racing-yellow)';
      else gaugeCircle.style.stroke = 'var(--f1-red)';
    }

    // Streak Count
    const streakNumEl = document.getElementById('stat-streak-num');
    if (streakNumEl) streakNumEl.textContent = state.stats.streak;

    // 30-Day Avg
    const avg30El = document.getElementById('stat-avg30-num');
    if (avg30El) avg30El.textContent = state.stats.avgEth30 ? `E${state.stats.avgEth30}` : '—';

    // Sustained E75+
    const e75El = document.getElementById('stat-e75-num');
    if (e75El) e75El.textContent = `${state.stats.sustainedE75Weeks} wks`;
  }

  function renderCalendar() {
    const grid = document.getElementById('cal-days-grid');
    const headingMonth = document.getElementById('cal-heading-month');
    const headingSub = document.getElementById('cal-heading-sub');
    if (!grid) return;

    const monthsData = getMonthsData();
    const curMonthData = monthsData[state.currentMonth];
    const year = state.currentYear;
    const month = state.currentMonth;

    if (headingMonth) {
      headingMonth.textContent = `${curMonthData.name} ${year}`;
    }
    if (headingSub) {
      headingSub.textContent = `RECOMMENDED ${curMonthData.recommendation} · ${curMonthData.temp}°F HISTORICAL AVG 🏁`;
    }

    // First day of the month & total days
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const today = new Date();
    const isCurrentActualMonth = (today.getFullYear() === year && today.getMonth() === month);

    let html = '';

    // Day of week headers
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    dayNames.forEach(d => {
      html += `<div class="cal-day-header">${d}</div>`;
    });

    // Previous month padding cells
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevDayNum = prevMonthDays - i;
      html += `<div class="cal-day-cell other-month"><div class="day-num">${prevDayNum}</div></div>`;
    }

    // Active month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = isCurrentActualMonth && (today.getDate() === d);

      // Find any logged fill for this day
      const dayFill = state.fills.find(f => {
        if (!f.date) return false;
        return f.date.startsWith(dateKey) || f.date.includes(dateKey);
      });

      const dayNote = state.notesMap[dateKey];
      let loggedFillHtml = '';

      if (dayFill) {
        const ethVal = Number(dayFill.eth);
        const isMatch = Number.isFinite(ethVal) && (Math.abs(ethVal - curMonthData.midpoint) <= 7 || (ethVal >= 70 && curMonthData.midpoint >= 70));
        const badgeClass = isMatch ? 'matched' : 'warn';
        const badgeIcon = isMatch ? '✓' : '⚠️';
        loggedFillHtml = `<div class="day-fill-logged-badge ${badgeClass}"><span>⛽ E${dayFill.eth}</span><span>${badgeIcon}</span></div>`;
      } else if (dayNote) {
        loggedFillHtml = `<div class="day-fill-logged-badge" style="border-color:var(--neon-cyan);color:var(--neon-cyan);"><span>📝 Note</span></div>`;
      }

      html += `
        <div class="cal-day-cell band-${curMonthData.band} ${isToday ? 'is-today' : ''}" onclick="window.BlendPlanner.openDayDetails('${dateKey}', ${d}, ${month})">
          <div class="cal-day-top">
            <span class="day-num">${d}</span>
            <span class="day-blend-badge blend-badge-${curMonthData.band}">${curMonthData.recommendation}</span>
          </div>
          ${loggedFillHtml}
        </div>
      `;
    }

    // Next month trailing padding cells to complete grid
    const totalCellsSoFar = firstDayOfWeek + daysInMonth;
    const remaining = (7 - (totalCellsSoFar % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      html += `<div class="cal-day-cell other-month"><div class="day-num">${i}</div></div>`;
    }

    grid.innerHTML = html;
  }

  function renderFillsTable() {
    const tbody = document.getElementById('planner-fills-tbody');
    const emptyMsg = document.getElementById('planner-fills-empty');
    if (!tbody || !emptyMsg) return;

    if (!state.fills.length) {
      emptyMsg.style.display = 'block';
      tbody.innerHTML = '';
      return;
    }

    emptyMsg.style.display = 'none';
    const monthsData = getMonthsData();

    // Show latest 10 fills
    const recent = state.fills.slice(0, 10);
    tbody.innerHTML = recent.map(f => {
      const p = parseFillDate(f.date);
      let matchHtml = '<span class="status-pill-match">✓ MATCH</span>';
      if (p) {
        const monthTarget = monthsData[p.month];
        const ethVal = Number(f.eth);
        const isMatch = Number.isFinite(ethVal) && (Math.abs(ethVal - monthTarget.midpoint) <= 7 || (ethVal >= 70 && monthTarget.midpoint >= 70));
        if (!isMatch) {
          matchHtml = '<span class="status-pill-warn">⚠️ OFF-SEASON</span>';
        }
      }

      const costVal = Number.isFinite(Number(f.fillCost)) ? `$${Number(f.fillCost).toFixed(2)}` : '—';
      const gallonsVal = `${Number(f.fillE85 || f.e85 || 0).toFixed(1)}g E85 + ${Number(f.fill93 || f.c93 || 0).toFixed(1)}g 93`;

      return `
        <tr>
          <td>${escHtml(f.date || '—')}</td>
          <td><strong style="color:#fff;">${escHtml(f.station || 'Custom Fill')}</strong></td>
          <td style="color:var(--fuel-orange);font-family:'Orbitron',monospace;font-weight:900;">E${escHtml(f.eth || '—')}</td>
          <td style="color:var(--text-muted);font-size:12px;">${gallonsVal}</td>
          <td style="color:var(--racing-yellow);">${costVal}</td>
          <td>${matchHtml}</td>
        </tr>
      `;
    }).join('');
  }

  function renderBadgesGrid() {
    const grid = document.getElementById('modal-badges-grid');
    if (!grid) return;

    grid.innerHTML = state.badges.map(b => {
      return `
        <div class="badge-card ${b.unlocked ? 'unlocked' : ''}">
          <div class="badge-icon">${b.icon}</div>
          <div class="badge-name">${escHtml(b.name)}</div>
          <div class="badge-desc">${escHtml(b.desc)}</div>
          <div class="badge-status-tag">${b.unlocked ? '🏆 UNLOCKED' : '🔒 IN PROGRESS'}</div>
        </div>
      `;
    }).join('');
  }

  // --- Action Handlers ---

  function applyRecommendationToMainCalculator() {
    const monthsData = getMonthsData();
    const curMonthData = monthsData[state.currentMonth];
    // Write target ethanol to localStorage so main index.html picks it up immediately
    safeSetItem('tgtEth', curMonthData.midpoint);
    // Also redirect to index.html with query parameter
    window.location.href = `index.html?tgtEth=${curMonthData.midpoint}`;
  }

  function prevMonth() {
    state.currentMonth--;
    if (state.currentMonth < 0) {
      state.currentMonth = 11;
      state.currentYear--;
    }
    refreshAll();
  }

  function nextMonth() {
    state.currentMonth++;
    if (state.currentMonth > 11) {
      state.currentMonth = 0;
      state.currentYear++;
    }
    refreshAll();
  }

  function jumpToToday() {
    state.currentYear = new Date().getFullYear();
    state.currentMonth = new Date().getMonth();
    refreshAll();
  }

  function openDayDetails(dateKey, day, month) {
    const modal = document.getElementById('day-modal');
    if (!modal) return;

    const monthsData = getMonthsData();
    const monthObj = monthsData[month];

    document.getElementById('day-modal-title').textContent = `${monthObj.name} ${day}, ${state.currentYear}`;
    document.getElementById('day-modal-rec').textContent = `Target: ${monthObj.recommendation} (${monthObj.temp}°F)`;
    document.getElementById('day-modal-desc').textContent = monthObj.desc;

    // Fill info for this day if any
    const dayFill = state.fills.find(f => {
      if (!f.date) return false;
      return f.date.startsWith(dateKey) || f.date.includes(dateKey);
    });

    const fillDetailsEl = document.getElementById('day-modal-fill-info');
    if (fillDetailsEl) {
      if (dayFill) {
        fillDetailsEl.innerHTML = `
          <div style="background:rgba(0,0,0,0.3);padding:10px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);margin-top:10px;">
            <strong style="color:var(--racing-yellow);">⛽ Logged Fill on this day:</strong><br>
            Blend: <span style="color:var(--fuel-orange);font-weight:900;">E${dayFill.eth}</span> | 
            Station: <span>${escHtml(dayFill.station || '—')}</span> | 
            Cost: <span>$${Number(dayFill.fillCost || 0).toFixed(2)}</span>
          </div>
        `;
      } else {
        fillDetailsEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;margin-top:8px;">No fuel logs recorded on this date.</div>';
      }
    }

    const noteInput = document.getElementById('day-modal-note');
    if (noteInput) {
      noteInput.value = state.notesMap[dateKey] || '';
      noteInput.dataset.dateKey = dateKey;
    }

    modal.classList.add('active');
    document.body.classList.add('modal-open');
  }

  function saveDayNote() {
    const noteInput = document.getElementById('day-modal-note');
    if (!noteInput) return;
    const dateKey = noteInput.dataset.dateKey;
    if (dateKey) {
      const text = noteInput.value.trim();
      if (text) {
        state.notesMap[dateKey] = text;
      } else {
        delete state.notesMap[dateKey];
      }
      savePlannerData();
      renderCalendar();
    }
    closeModal('day-modal');
  }

  function openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) {
      m.classList.add('active');
      document.body.classList.add('modal-open');
    }
  }

  function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) {
      m.classList.remove('active');
      document.body.classList.remove('modal-open');
    }
  }

  function setLocation(locKey) {
    if (LOCATION_PRESETS[locKey]) {
      state.activeLocationKey = locKey;
      savePlannerData();
      refreshAll();
      closeModal('location-modal');
    }
  }

  function setGoal(goalText) {
    state.activeGoal = goalText;
    savePlannerData();
    closeModal('goal-modal');
    alert(`🎯 Active Goal updated to: "${goalText}"`);
  }

  function clearAllData() {
    if (confirm('⚠️ Are you sure you want to reset all Planner notes and local metrics? (Your telemetry logs in main calculator will remain untouched).')) {
      safeRemoveItem('blendPlannerNotes');
      safeRemoveItem('blendPlannerMetrics');
      state.notesMap = {};
      state.badges.forEach(b => b.unlocked = false);
      savePlannerData();
      refreshAll();
      closeModal('metrics-modal');
      alert('✓ Planner metrics and notes have been reset.');
    }
  }

  function refreshAll() {
    loadTelemetryLogs();
    calculateMetrics();
    renderHeroPump();
    renderStatsPanel();
    renderCalendar();
    renderFillsTable();
    renderBadgesGrid();
  }

  // --- Global Initialization ---
  window.BlendPlanner = {
    init: function () {
      cleanupOldMetrics();
      loadPlannerData();
      refreshAll();
    },
    prevMonth,
    nextMonth,
    jumpToToday,
    openDayDetails,
    saveDayNote,
    openModal,
    closeModal,
    setLocation,
    setGoal,
    clearAllData,
    refreshAll,
    applyRecommendationToMainCalculator,
    getState: function () {
      return {
        ...state,
        monthsData: getMonthsData()
      };
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.BlendPlanner.init();
  });

})();

