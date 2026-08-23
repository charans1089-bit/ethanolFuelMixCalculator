# Changelog

All notable changes to the WRX Flex Fuel Mix Calculator project will be documented in this file.

## [3.2.0] - 2026-08-23

### Added
- **Vite + TypeScript Build System**: Migrated to a modern Vite build pipeline with multi-page support.
- **GitHub Actions CI/CD**: Added robust CI pipeline (`ci-deploy.yml`) with HTML validation, JS syntax checks, CSS brace balancing, localStorage audits, and automated deployment to GitHub Pages.
- **Security Hardening**: Implemented strict Content-Security-Policy (CSP), `X-Content-Type-Options: nosniff`, `referrerpolicy="no-referrer"` for images, and `rel="noopener noreferrer"` for external links.
- **SCRK Sound Engine**: Developed a pure Web Audio API synthesizer modeling the FA24 boxer rumble, turbo spool, cold-air intake, catback crackle, and BOV pop.
- **SOUND CHECK Button**: Added an interactive "Sound Check" button to the mode bar with RPM revving animations.
- **Brand UI Overhaul (WOW Factor)**: Upgraded design with carbon-fibre textures, animated scan lines, neon pulsing text, and a redesigned responsive mode bar.
- **SCRK WRX Garage**: Replaced generic stock photos with a curated 3-card masonry gallery featuring the owner's actual FA24 WRX action shot, cockpit, and 6MT shifter.

## [Unreleased]

### Added (Seasonal Blend Planner Feature)
- **New `blend-planner.html` standalone page**: A dedicated seasonal blend planning and telemetry analysis module for WRX FA24 flex fuel setups.
- **12-Month Interactive Calendar**: Navigable monthly view with ambient temperature mapping and color-coded blend recommendations:
  - ❄️ **E20–E35 (Blue)**: Winter cold start protection and vapor pressure optimization.
  - 🌿 **E35–E50 (Green)**: Spring / Fall balanced transitional blends.
  - ☀️ **E50–E70 (Orange)**: Warm weather boost and ignition timing advancement.
  - 🔥 **E70+ (Red)**: Peak summer heat maximum charge cooling and knock resistance.
- **Real-Time Compliance Tracking**: Evaluates logged fills against seasonal weather recommendations (within tolerance) with an animated radial speedometer gauge.
- **Streak Counter**: Consecutive recommended fills tracker with glowing flame animation.
- **Gas Pump Digital Dispenser UI**: Vintage fuel pump aesthetic with animated level indicators, last fill readout, and "Days since last fill" counter.
- **Animated Mercury Thermometer**: Dynamic fluid level reflecting active location temperatures with color transition from cold blue to hot red.
- **Metrics Dashboard & Lifetime Telemetry**:
  - Total fills tracked and lifetime fuel expenditure.
  - 30-day average ethanol percentage vs all-time average.
  - Sustained E75+ duration counter.
  - Most frequent station identifier.
- **Achievement & Gamification Badge System**:
  - ❄️ *Winter Warrior*: Logged E30–E40 in Jan–Mar for safe cold starts.
  - ☀️ *Summer Specialist*: Logged E70+ during hot summer months (Jun–Aug).
  - 🎯 *Perfect Compliance*: Achieved 100% recommendation match on 5+ fills.
  - 🔥 *Streak Master*: Maintained a 5+ consecutive recommended fill streak.
  - ⛽ *High-Octane Hero*: Logged 10+ total fill telemetry records.
  - 🧪 *Master Blender*: Logged fuel stops across all 4 distinct seasons.
  - 🏎️ *Track Ready*: Sustained high ethanol E70+ for 4+ consecutive fills.
- **Multi-Format Export Hub**:
  - 📅 **ICS Calendar** (`SCRK_BlendPlanner_YYYY.ics`): RFC 5545 events for Google Calendar, Apple Calendar, and Outlook.
  - 📊 **CSV Schedule** (`SCRK_BlendSchedule_YYYY.csv`): Spreadsheet export with spreadsheet formula-injection mitigation.
  - 💾 **Full JSON Archive** (`blend-planner_YYYY-MM-DD.json`): Complete telemetry snapshot, daily notes, and state.
  - 📈 **Metrics JSON** (`blend-metrics_YYYY-MM-DD.json`): Compact statistical payload.
- **GitHub Backup Workflow**: Guided step-by-step instructions to save snapshots into `data/blend-history/` with copyable Git commands and auto-generated commit messages.
- **Google Sheets Sync**: Connector interface for Google Sheets share links and Google Apps Script webhooks.
- **Racing Resume & Fuel Profile**: Generates a shareable summary with tuning rank, stats, and earned badges.
- **Multi-Location Climate Models**: Configurable presets for Dearborn (MI), Phoenix (AZ), Minneapolis (MN), Denver (CO), and Austin (TX).
- **Day Notes Editor**: Add and persist custom track day or weather notes per calendar day in browser localStorage.
- **One-Touch Calculator Integration**: "Apply to Calculator" button pre-fills target ethanol in `index.html`.

