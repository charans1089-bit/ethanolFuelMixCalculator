# WRX Flex Fuel Calculator & Seasonal Blend Planner

Static web app and seasonal telemetry planning suite for WRX FA24 flex fuel blending (E85 + 93 Octane).

## Stack
- HTML5
- CSS3 (Motorsport / Rally Fuel Theme)
- Vanilla JavaScript
- LocalStorage (Client-side logs & metrics persistence)
- Cloudflare Worker & GitHub Pages static hosting

## Run Locally
Open `index.html` (Main Calculator) or `blend-planner.html` (Seasonal Blend Planner) directly in any web browser, or serve using any local static file server.

---

## ⛽ Seasonal Blend Planner

The **Seasonal Blend Planner** (`blend-planner.html`) is a standalone, interactive flex fuel strategy and compliance tracking dashboard. It correlates regional ambient temperatures with engine combustion requirements to recommend the ideal ethanol blend for every month of the year while logging your real-world fill telemetry.

### What It Does
- **12-Month Calendar Strategy:** Visualizes recommended ethanol blends for all 12 months based on historical ambient temperatures.
- **Telemetry Log Tracking:** Automatically reads fuel stops from the calculator's logbook (`wrxFuelLogs` in localStorage) without modifying them.
- **Compliance & Speedometer Gauge:** Computes the percentage of your fills that align with seasonal recommendations (within ±5–7% tolerance).
- **Streak & High Ethanol Tracking:** Monitors consecutive compliant fills with a glowing flame streak counter 🔥 and tracks sustained E75+ duration.
- **Multi-Format Exporting:** Exports your schedule and logs to calendar apps (ICS), spreadsheets (CSV), JSON backups, and GitHub repositories.
- **Gamification & Achievement Badges:** Unlock achievements as you master cold starts, summer boost seasons, and fueling consistency.
- **Fuel Profile Sharing:** Generates a shareable "Racing Resume" to compare flex fuel strategies with friends.

### How to Access
- **Direct Access:** Open `blend-planner.html` directly in your browser.
- **From Calculator:** Click the **⛽ Blend Planner** button in the top navigation bar of `index.html`.

### How to Use
1. **Open `blend-planner.html`:** Review the top **Next Fill Recommendation** box styled like a digital gas pump dispenser.
2. **View the 12-Month Calendar:** Browse month-by-month to see temperature trends, recommended ethanol ranges, and scheduled events.
3. **Review Telemetry Fills:** Fills you save in the main calculator appear automatically in the calendar and table with compliance badges (`✓ MATCH` or `⚠️ OFF-SEASON`).
4. **Inspect Day Details & Add Notes:** Click any day cell to view recommendations, review fill details, or record custom track day notes.
5. **Apply Target to Calculator:** Tap **⚡ Apply to Calculator & Tune** to load the recommended target directly into `index.html`.
6. **Export Your Strategy:** Use the **Export Hub** to download ICS calendar files, CSV spreadsheets, or copy Git commands to backup data into your repo.

### Seasonal Recommendations Explained
Ethanol has a higher latent heat of vaporization than gasoline and requires more heat to evaporate. In colder weather, high ethanol content makes cold starts difficult and increases oil dilution. Conversely, in hot summer weather, high ethanol provides massive charge-cooling effects and extreme knock resistance under high boost.

| Season | Avg Temp (°F) | Recommended Blend | Combustion & Tuning Strategy |
| :--- | :--- | :--- | :--- |
| **Winter** (Jan–Feb) | 25°F–28°F | **E30–E40** | High fuel volatility prevents hard cranking, reduces battery/starter wear, and maintains knock resistance. |
| **Late Winter / Early Spring** (Mar) | 38°F | **E35–E45** | Smooth transition as sub-freezing temperatures begin to ease. |
| **Spring** (Apr–May) | 55°F–65°F | **E50–E70** | Air temperatures warm up; ethanol content safely steps up to unlock higher boost and aggressive timing. |
| **Summer Peak** (Jun–Aug) | 75°F–82°F | **E70+** | Peak ambient heat increases knock risk on 93 octane; E70+ delivers maximum in-cylinder cooling and knock suppression. |
| **Early Fall** (Sep) | 70°F | **E60–E70** | Strong power with gradual taper before cold weather returns. |
| **Fall Transition** (Oct–Nov) | 42°F–58°F | **E35–E60** | Cooling temperatures signal stepping down ethanol content for seamless cold starts. |
| **Early Winter** (Dec) | 30°F | **E30–E40** | Return to winter baseline blend to protect against cold mornings. |

### Calendar Color Coding
- 🟦 **Blue (E20–E35):** Winter baseline — high volatility for sub-freezing cold starts.
- 🟩 **Green (E35–E50):** Spring & Fall — balanced transitional blends.
- 🟧 **Orange (E50–E70):** Summer warm weather — increased power and timing headroom.
- 🟥 **Red (E70+):** Peak summer heat — maximum boost, charge cooling, and knock resistance.

### Metrics & Compliance Statistics
- **Compliance %:** The percentage of actual fuel stops matching the seasonal recommendation midpoint within tolerance.
- **Blend Streak:** Consecutive fills that hit seasonal recommendations.
- **30-Day Average Ethanol:** Rolling average ethanol concentration in your fuel tank over the past 30 days.
- **Sustained E75+ Duration:** Tracks weeks running high ethanol blends to assist with periodic cleaning tank advisories (running E20–E35 every few tanks).

### Local-First Privacy & Storage
- Planner metrics and badge milestones are saved in `localStorage.blendPlannerMetrics`.
- Daily notes are stored in `localStorage.blendPlannerNotes`.
- Stale monthly statistics older than 2 years are automatically cleaned up on initialization to protect browser storage.
- Telemetry logs in `localStorage.wrxFuelLogs` are strictly read-only and never modified or deleted by the planner.

### Metrics Dashboard & Gamification Badges
Click **📊 METRICS DASHBOARD** to view your lifetime statistics and track achievement unlocks:
- ❄️ **Winter Warrior:** Logged E30–E40 during Jan–Mar for safe cold starts.
- ☀️ **Summer Specialist:** Logged E70+ during hot summer months (Jun–Aug).
- 🎯 **Perfect Compliance:** Achieved 100% recommendation match on 5+ fills.
- 🔥 **Streak Master:** Maintained a 5+ consecutive recommended fill streak.
- ⛽ **High-Octane Hero:** Logged 10+ total fill telemetry records.
- 🧪 **Master Blender:** Logged fuel stops across all 4 distinct seasons.
- 🏎️ **Track Ready:** Sustained high ethanol E70+ for 4+ consecutive fills.

### Multi-Format Export Options
- **📅 ICS Calendar File (`SCRK_BlendPlanner_YYYY.ics`):** Imports 12 monthly blend advisory events into Google Calendar, Apple Calendar, or Microsoft Outlook.
- **📊 CSV Schedule (`SCRK_BlendSchedule_YYYY.csv`):** Formatted spreadsheet schedule with actual logged fills and formula injection protection (`=`, `+`, `-`, `@` sanitized).
- **💾 Full JSON Archive (`blend-planner_YYYY-MM-DD.json`):** Complete data dump including custom notes, badge status, and telemetry snapshot.
- **📈 Metrics Only JSON (`blend-metrics_YYYY-MM-DD.json`):** Compact summary of statistical compliance and streak records.

### GitHub Telemetry Backup
You can archive your seasonal blend history directly in this repository:
1. Export the CSV or JSON schedule from the planner's **Export Hub**.
2. Move the file into `data/blend-history/`:
   ```bash
   mkdir -p data/blend-history
   mv ~/Downloads/SCRK_BlendSchedule_2026.csv data/blend-history/
   ```
3. Commit and push:
   ```bash
   git add data/blend-history/
   git commit -m "telemetry: seasonal blend strategy snapshot"
   git push origin main
   ```

### Google Sheets Cloud Sync
Click **🔗 CONNECT GOOGLE SHEETS** to connect your Google Sheets share URL or Google Apps Script webhook for remote telemetry syncing.

### Sharing Your Fuel Profile
Click **🏎️ SHARE PROFILE** to generate a formatted racing resume with your tuning rank, compliance rating, streak count, and earned badges to share with your car club.

---

## 🌡️ Seasonal Blend Guide (Chemistry & Engine Dynamics)

### Winter (Jan–Mar): Why E30–E40 is Recommended
- **Vaporization Physics:** Pure ethanol has a high boiling point and vaporizes poorly when cylinder walls and intake air are below 32°F (0°C).
- **Cold Cranking Safety:** High ethanol in freezing weather causes extended cranking, spark plug fouling, unburnt fuel washing down cylinder walls, and oil dilution.
- **Boost & Knock Headroom:** Cold winter air is dense, which naturally resists knock. Running E30–E40 provides sufficient octane boost while preserving quick ignition.

### Spring (Apr–May): Transitioning to E50–E60
- As ambient temperatures rise past 50°F (10°C), vaporization improves rapidly.
- Increasing ethanol content to E50–E60 provides optimal ignition timing advance as boost levels increase with spring track days.

### Summer (Jun–Aug): Why E70+ is Recommended
- **Heat Soak & Knock Prevention:** Hot summer intake charge temperatures (80°F–100°F+) significantly increase the propensity for low-speed pre-ignition (LSPI) and detonation on pump 93.
- **In-Cylinder Cooling:** Ethanol's high heat of vaporization cools the incoming charge air and combustion chamber, allowing maximum boost and aggressive ignition timing without knock.

### Fall (Sep–Nov): Transitioning Back
- As autumn brings cooler ambient air, gradually step down from E70+ to E50 and E35 to maintain smooth cold-morning starts.

### Benefits of Seasonal Strategy
- **Instant Cold Starts:** No long cranking or battery strain in sub-freezing weather.
- **Reduced Oil Dilution:** Prevents unburnt ethanol from leaking past piston rings into engine oil.
- **Maximum Power in Heat:** Full knock immunity and timing advance when turbochargers run hot.
- **Extended Fuel System Life:** Periodic lower blends provide a relief cycle for direct injection fuel pumps.

---

## 🎯 Example Use Cases

1. **Annual Blend Planning:** Schedule your flex fuel strategy across all four seasons.
2. **Compliance Verification:** Track if your real-world fill choices match temperature conditions.
3. **Seasonal Transition Prep:** Know exactly when to transition your tank from winter blends to peak summer E85.
4. **Track Day Documentation:** Log track day notes, ambient heat, and ethanol content for specific events.
5. **Version-Controlled Telemetry:** Commit regular CSV/JSON backups to GitHub.
6. **Milestone Achievements:** Challenge yourself to build 10-fill streaks and unlock all 7 badges.

---

## ⚙️ Features & Limitations

### Features
- 12-month seasonal planner with temperature-adjusted recommendations.
- Real-time compliance calculation with radial SVG speedometer gauge.
- Gamified badge system with progress indicators and unlocks.
- Multi-format exports: ICS (Calendar), CSV (Excel/Sheets), JSON (Archive).
- Complete local-first privacy (all data stored in browser localStorage).
- Fuel-themed responsive UI with animated gas pump dispenser and thermometer.
- Seamless one-touch link to main calculator with target blend pre-filled.

### Limitations
- **Client-Side Persistence:** Data lives in browser `localStorage`. Clear browser cache removes local notes unless exported.
- **2-Year History Limit:** Monthly stats older than 2 years are automatically purged.
- **Read-Only Telemetry:** Planner reads `wrxFuelLogs` from the main calculator; modifying or deleting individual log entries is handled in the main calculator's logbook tab.
- **Calendar Event Scope:** ICS export generates events for the selected calendar year.

---

## 📁 Repository File Structure

```
├── index.html                   # Main interactive WRX flex fuel mix calculator
├── styles.css                   # Main calculator stylesheet
├── app.js                       # Main calculation engine, weather API, and logbook
├── blend-planner.html           # Standalone Seasonal Blend Planner page
├── blend-planner.js             # Calendar logic, compliance analytics, and badge engine
├── blend-planner-export.js      # ICS, CSV, JSON, GitHub, and Sheets export handlers
├── blend-planner-styles.css     # Fuel-themed styling, gas pump dispenser, and thermometer
├── CHANGELOG.md                 # Detailed release history
├── README.md                    # Project documentation
├── data/
│   ├── fuel-prices.json         # Automated fuel price snapshot
│   └── blend-history/           # Folder for committed CSV/JSON telemetry backups (.gitkeep)
├── scripts/
│   └── update-fuel-prices.mjs   # Apify fuel price scraper script
└── .github/workflows/
    ├── deploy-pages.yml         # GitHub Pages automated deployment
    └── update-fuel-prices.yml   # Scheduled fuel prices workflow
```

---

## ❓ FAQ & Troubleshooting

#### Why does my compliance percentage show ⚠️ OFF-SEASON?
Compliance is evaluated by comparing your logged ethanol % to the seasonal recommendation midpoint. Fills within ±7% or running E70+ in warm weather are marked compliant (`✓ MATCH`). If you run E85 in January (25°F), it will be flagged as off-season due to cold start vaporization risks.

#### How do I change the location for different climate temperatures?
Click the **📍 CHANGE LOCATION** button in the top action bar to select from presets (Dearborn MI, Phoenix AZ, Minneapolis MN, Denver CO, Austin TX).

#### Can I edit past fills in the planner?
The Seasonal Blend Planner reads telemetry logs from the main calculator's logbook (`wrxFuelLogs`). To edit or delete a fill, return to `index.html` → **📓 Logbook** tab, click **Edit**, and update the entry.

#### How do I unlock badges?
Badges are evaluated automatically on every page load and fill update. Maintain consistent compliance, log fills across all four seasons, and build streaks to unlock all 7 badges.

#### Where is my data saved?
All calculations, notes, and metrics are saved locally in your web browser's `localStorage`. No external account or server database is required.

---

## 🔗 Integration with Main Calculator
- **Telemetry Sharing:** The planner automatically reads logs saved in the main calculator's logbook (`wrxFuelLogs`).
- **One-Click Target Sync:** Clicking **⚡ Apply to Calculator & Tune** writes the seasonal target into `localStorage.tgtEth` and navigates to `index.html?tgtEth=...`, automatically loading the target blend into the calculation engine.
- **Modular Design:** Both pages operate completely offline and independently without cross-dependencies.

---

## 📸 Media & Documentation Suggestions
- **Calendar Color Screenshot:** Capture the 12-month calendar showcasing the blue-to-red temperature blend bands.
- **Gas Pump Dispenser Animation:** Record a GIF of the digital dispenser display and mercury thermometer fluid animation.
- **Badge Showcase:** Screenshot the achievement badge grid when all 7 badges are unlocked.
- **Google Calendar Import Demo:** Show how the generated `.ics` file imports into Google Calendar or Apple Calendar.

---

## GitHub Pages Deployment
This repository is static and ready for GitHub Pages:
1. Go to **Settings → Pages**.
2. Source: **GitHub Actions** (uses `.github/workflows/deploy-pages.yml`) or **Deploy from branch** (`main` / root).
3. Save.

## License
MIT License. Free for personal tuning and motorsport use.
