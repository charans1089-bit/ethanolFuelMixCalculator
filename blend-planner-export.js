/**
 * SCRK Seasonal Blend Planner - Export Engine
 * Handles ICS Calendar, CSV Schedule, JSON Archives, GitHub Workflow, & Sheets Sync
 */

(function (window) {
  'use strict';

  function downloadBlob(filename, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function sanitizeCSVField(val) {
    if (val === null || val === undefined) return '""';
    let str = String(val).replace(/"/g, '""');
    // Prevent spreadsheet formula injection
    if (/^[=+@\-\t\r]/.test(str)) {
      str = "'" + str;
    }
    return `"${str}"`;
  }

  /**
   * Generates standard RFC 5545 iCalendar (.ics) file with monthly blend strategies
   */
  function exportCalendarICS(year, monthsData, locationName) {
    const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SCRK Racing//Seasonal Blend Planner//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:SCRK Seasonal Fuel Blend Schedule ' + year,
      'X-WR-TIMEZONE:UTC'
    ];

    monthsData.forEach((m, idx) => {
      const monthNum = String(idx + 1).padStart(2, '0');
      const startDay = `${year}${monthNum}01`;
      // Calculate next month start for all-day event
      let nextYear = year;
      let nextMonth = idx + 2;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear = year + 1;
      }
      const nextMonthStr = String(nextMonth).padStart(2, '0');
      const endDay = `${nextYear}${nextMonthStr}01`;

      const summary = `⛽ Blend Strategy: ${m.name} (${m.recommendation} · ${m.temp}°F)`;
      const description = `SCRK Seasonal Fuel Advisory for ${m.name} in ${locationName}:\\n` +
        `• Recommended Blend: ${m.recommendation}\\n` +
        `• Historical Avg Temp: ${m.temp}°F\\n` +
        `• Strategy: ${m.desc}\\n` +
        `• Note: Cold starts require appropriate ethanol vapor pressure. Higher blend in summer for max boost.`;

      lines.push(
        'BEGIN:VEVENT',
        `UID:scrk-blend-${year}-${monthNum}@charans1089.github.io`,
        `DTSTAMP:${nowStr}`,
        `DTSTART;VALUE=DATE:${startDay}`,
        `DTEND;VALUE=DATE:${endDay}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        'STATUS:CONFIRMED',
        'TRANSP:TRANSPARENT',
        'CATEGORIES:AUTOMOTIVE,RACING,FUEL',
        'END:VEVENT'
      );
    });

    lines.push('END:VCALENDAR');
    const icsContent = lines.join('\r\n');
    downloadBlob(`SCRK_BlendPlanner_${year}.ics`, icsContent, 'text/calendar;charset=utf-8');
  }

  /**
   * Generates detailed CSV Schedule for all 12 months & days of the year
   */
  function exportScheduleCSV(year, monthsData, fillsList, notesMap) {
    const headers = [
      'Date',
      'Month',
      'Day',
      'AvgTemp_F',
      'Recommended_Blend',
      'Target_Midpoint',
      'Actual_Logged_Blend',
      'Station',
      'Gallons_E85',
      'Gallons_93',
      'Fill_Cost_USD',
      'Compliance_Status',
      'Notes'
    ];

    const rows = [headers.map(sanitizeCSVField).join(',')];

    // Loop through each month and day
    for (let m = 0; m < 12; m++) {
      const monthObj = monthsData[m];
      const daysInMonth = new Date(year, m + 1, 0).getDate();

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayFill = fillsList.find(f => {
          if (!f.date) return false;
          return f.date.startsWith(dateStr) || f.date.includes(dateStr);
        });

        const dayNote = notesMap[dateStr] || '';
        let actualBlend = '';
        let station = '';
        let e85Gal = '';
        let c93Gal = '';
        let cost = '';
        let compliance = 'No fill logged';

        if (dayFill) {
          actualBlend = dayFill.eth !== undefined ? `E${dayFill.eth}` : '';
          station = dayFill.station || '';
          e85Gal = dayFill.fillE85 || dayFill.e85 || '';
          c93Gal = dayFill.fill93 || dayFill.c93 || '';
          cost = dayFill.fillCost !== undefined && dayFill.fillCost !== null ? Number(dayFill.fillCost).toFixed(2) : '';
          
          const ethVal = Number(dayFill.eth);
          if (Number.isFinite(ethVal)) {
            const isMatch = Math.abs(ethVal - monthObj.midpoint) <= 7 || (ethVal >= 70 && monthObj.midpoint >= 70);
            compliance = isMatch ? 'MATCH (✓)' : 'OFF-TARGET (⚠)';
          }
        }

        const row = [
          sanitizeCSVField(dateStr),
          sanitizeCSVField(monthObj.name),
          sanitizeCSVField(d),
          sanitizeCSVField(monthObj.temp),
          sanitizeCSVField(monthObj.recommendation),
          sanitizeCSVField(`E${monthObj.midpoint}`),
          sanitizeCSVField(actualBlend),
          sanitizeCSVField(station),
          sanitizeCSVField(e85Gal),
          sanitizeCSVField(c93Gal),
          sanitizeCSVField(cost),
          sanitizeCSVField(compliance),
          sanitizeCSVField(dayNote)
        ];

        rows.push(row.join(','));
      }
    }

    const csvContent = rows.join('\r\n');
    downloadBlob(`SCRK_BlendSchedule_${year}.csv`, csvContent, 'text/csv;charset=utf-8');
  }

  /**
   * Exports full planner state as JSON archive
   */
  function exportFullJSON(plannerState) {
    const dateStr = new Date().toISOString().slice(0, 10);
    const jsonPayload = {
      app: 'SCRK Seasonal Blend Planner',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      location: plannerState.location,
      activeGoal: plannerState.activeGoal,
      months: plannerState.monthsData,
      fillsSnapshot: plannerState.fills,
      stats: plannerState.stats,
      badges: plannerState.badges,
      dailyNotes: plannerState.notesMap
    };

    downloadBlob(
      `blend-planner_${dateStr}.json`,
      JSON.stringify(jsonPayload, null, 2),
      'application/json;charset=utf-8'
    );
  }

  /**
   * Exports metrics and compliance statistics only
   */
  function exportMetricsJSON(stats, badges, locationName) {
    const dateStr = new Date().toISOString().slice(0, 10);
    const metricsPayload = {
      app: 'SCRK Seasonal Blend Planner - Metrics',
      exportedAt: new Date().toISOString(),
      location: locationName,
      compliancePercentage: stats.compliancePct,
      totalFillsTracked: stats.totalFills,
      consecutiveStreak: stats.streak,
      averageEthanol30Days: stats.avgEth30,
      lifetimeAvgEthanol: stats.avgEthAll,
      sustainedE75Weeks: stats.sustainedE75Weeks,
      totalFuelCostTracked: stats.totalCost,
      badgesUnlocked: badges.filter(b => b.unlocked).map(b => ({ id: b.id, name: b.name, unlockedAt: b.unlockedAt }))
    };

    downloadBlob(
      `blend-metrics_${dateStr}.json`,
      JSON.stringify(metricsPayload, null, 2),
      'application/json;charset=utf-8'
    );
  }

  /**
   * Copies formatted Git workflow instructions to clipboard
   */
  function copyGitHubInstructions(year) {
    const currentYear = year || new Date().getFullYear();
    const dateStr = new Date().toISOString().slice(0, 10);
    const text = [
      '# === SCRK FLEX FUEL: BACKUP TO GITHUB ===',
      '# 1. Download CSV or JSON from the Blend Planner',
      '# 2. Place files into your repository folder:',
      'mkdir -p data/blend-history',
      `mv ~/Downloads/SCRK_BlendSchedule_${currentYear}.csv data/blend-history/`,
      `# or: mv ~/Downloads/blend-planner_${dateStr}.json data/blend-history/`,
      '',
      '# 3. Stage, commit, and push to GitHub:',
      'git add data/blend-history/',
      `git commit -m "telemetry: seasonal blend strategy & telemetry history snapshot (${dateStr})"`,
      'git push origin main',
      '# ========================================'
    ].join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert('✓ GitHub backup commands copied to clipboard!\nOpen your terminal and paste.');
      }).catch(() => {
        prompt('Copy these GitHub backup commands:', text);
      });
    } else {
      prompt('Copy these GitHub backup commands:', text);
    }
  }

  /**
   * Generates shareable Racing Resume / Fuel Profile text
   */
  function generateFuelProfileShare(stats, badges, locationName) {
    const unlockedBadges = badges.filter(b => b.unlocked);
    const badgeIcons = unlockedBadges.map(b => `${b.icon} ${b.name}`).join(' · ') || 'Rookie Blender';
    
    let rank = 'Street Enthusiast';
    if (stats.compliancePct >= 90 && stats.totalFills >= 10) rank = 'Pro Tuner (Master Class)';
    else if (stats.compliancePct >= 75) rank = 'Veteran Blender';
    else if (stats.totalFills >= 5) rank = 'Seasoned Flex Runner';

    const resume = [
      '🏎️💨 SCRK RACING — SEASONAL FUEL PROFILE',
      '=========================================',
      `📍 Location: ${locationName}`,
      `🏆 Strategy Rank: ${rank}`,
      `📊 Seasonal Compliance: ${stats.compliancePct}%`,
      `🔥 Recommended Streak: ${stats.streak} Fills`,
      `⛽ 30-Day Avg Blend: E${stats.avgEth30}`,
      `⚡ Total Fills Logged: ${stats.totalFills}`,
      `💰 Fuel Tracked: $${stats.totalCost.toFixed(2)}`,
      `🏅 Earned Badges: ${badgeIcons}`,
      '=========================================',
      'Generated by SCRK Seasonal Blend Planner',
      'https://github.com/charans1089-bit/ethanolFuelMixCalculator'
    ].join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(resume).then(() => {
        alert('🏆 Racing Resume & Fuel Profile copied to clipboard!\nShare with your car squad.');
      }).catch(() => {
        prompt('Copy your Fuel Profile:', resume);
      });
    } else {
      prompt('Copy your Fuel Profile:', resume);
    }
  }

  window.BlendExport = {
    exportCalendarICS,
    exportScheduleCSV,
    exportFullJSON,
    exportMetricsJSON,
    copyGitHubInstructions,
    generateFuelProfileShare
  };

})(window);

