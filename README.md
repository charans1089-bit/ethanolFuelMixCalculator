# SCRK Flex Fuel Mix Calculator & Seasonal Blend Planner

A high-performance static web application, telemetry dashboard, and seasonal blending suite engineered specifically for the FA24 Subaru WRX flex-fuel platform (E85 + 93 Octane).

## 🚀 Features

- **Precision Blending Engine**: Calculates exact E85 and 93 Octane requirements based on live telemetry, physical tank limits, and target ethanol percentage.
- **Seasonal Blend Planner**: A 12-month interactive dashboard correlating regional ambient temperatures with engine combustion requirements.
- **Web Audio Sound Engine**: A zero-sample, pure Web Audio API synthesizer modeling the FA24 boxer rumble, turbo spool, and titanium catback exhaust crackle.
- **Offline-First Telemetry**: Fully local data persistence via HTML5 `localStorage`. No tracking, no data collection.
- **Real-Time Weather & Fuel APIs**: Cloudflare Worker integration providing hyper-local ambient temperatures (Open-Meteo) and fuel prices (BigDataCloud).
- **Gamified Compliance**: Track your consecutive fill streaks, earn achievements, and evaluate your seasonal compliance.

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3 (Custom Motorsport UI with Glassmorphism)
- **Logic**: Vanilla JavaScript with JSDoc TypeScript annotations (`@ts-check`)
- **Build System**: Vite (Multi-page configuration) + TypeScript (Type-checking only)
- **CI/CD**: GitHub Actions (Linting, Validation, and Automated Deployments)
- **Edge Proxy**: Cloudflare Workers

## 🛡️ Security Posture

- **Strict CSP**: Content-Security-Policy enforces `script-src 'self'` and blocks malicious inline evaluations.
- **No Mixed Content**: Enforces `upgrade-insecure-requests`.
- **Privacy Hardened**: Implements `referrerpolicy="no-referrer"` on media and `noopener noreferrer` on all external links.
- **100% Client-Side Data**: Zero PII collected. All fill logs and configurations stay securely in your browser's local storage.

## ⚙️ Development

The project is built using Vite to provide an optimized, minified bundle while retaining the ease of vanilla JavaScript.

### Setup

```bash
# Install dependencies
npm install

# Start the local development server (hot-reloading)
npm run dev

# Run TypeScript type-checking
npm run typecheck

# Build for production
npm run build
```

## ⛽ Architecture & Documentation

Comprehensive engineering documentation detailing the platform architecture, mathematical formulas, and high-ethanol safeguards can be found by navigating to the **Docs** section within the application (`docs.html`).

---

*Engineered for the FA24 Flex Fuel Platform.*
