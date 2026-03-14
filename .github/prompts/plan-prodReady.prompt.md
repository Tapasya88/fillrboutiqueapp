## Plan: Make BoutiqueDesignerApp Production Ready

**TL;DR**
Bring the app from prototype/demo state to production readiness by auditing current functionality, improving stability and performance, adding safeguards (offline, data integrity, error handling), implementing proper build/release workflows, and verifying on target platforms. Focus areas include data persistence, export/import reliability, UI polish, security, and automated testing.

**Steps**

### 1) Audit & Baseline (Discovery)
1. Review current feature set and data model (clients, sessions, designs, orders) to confirm what is "source of truth" and where it is stored (AsyncStorage / file system). *Depends on code review (StorageService, MeasurementService, app flow)*.
2. Identify missing production-critical features: onboarding, authentication/authorization, offline resilience, backup/restore, export/import, error reporting.
3. Inventory third-party libraries and ensure compatibility with targeted Expo SDK & platforms (Android/iOS). Confirm no deprecated/unmaintained deps.
4. Validate current behavior of CSV export/import (existing or partial) and identify gaps for full order export/import.

### 2) Data Integrity & Persistence
1. Add a versioned storage schema and migration helpers inside `src/StorageService.js` (e.g., store `{ schemaVersion, data }`). Provide a `migrate()` path so old data can upgrade automatically on load.
2. Ensure all write operations to AsyncStorage / filesystem are atomic and recoverable (e.g., write to a temp key/file and then replace the live key/file). Add a safe `setItemWithBackup()` wrapper and a `safeGetItem()` that can recover from partial/corrupt writes.
3. Add unit tests for StorageService and order persistence logic (using `jest` / `@testing-library/react-native`), including migration scenarios and corrupted-data recovery.
4. Add end-to-end tests (manual or automated using Detox / Playwright) for key flows: save design, export CSV, import CSV, and reproducing from backup.

### 3) Export / Import (CSV) Reliability
1. Define canonical CSV format for orders (header row + required columns). Include fields for client, order metrics, payment details, design references, timestamps.
2. Implement exporter that writes CSV to device file system (using `expo-file-system`) and exposes share dialog (`expo-sharing`) and/or direct save path.
3. Implement importer that reads CSV, validates schema, and merges into existing store safely (detect duplicates, allow overwrite/merge options).
4. Add user UI for import/export with clear instructions and error messaging.

### 4) UI/UX Polish & Accessibility
1. Ensure layout works on small screens and in portrait/landscape. Validate scroll and keyboard behavior (especially in forms) and fix any overlapping controls.
2. Add loading states / spinners for long-running tasks (loading data, saving, import/export) and toast/alert confirmations.
3. Use consistent theming and spacing across tabs. Add safe-area padding and proper contrast ratios.
4. Ensure screenshots and assets are optimized (no large images shipping in bundle).

### 5) Performance, Memory & Stability
1. Benchmark Skia canvas performance; cap path memory usage (e.g., limit undo history, compress stored paths, or store as simplified vector commands).
2. Ensure TensorFlow / ML components are optional and don’t block startup. Delay/or lazy-load model and avoid heavy CPU usage on main thread.
3. Optimize AsyncStorage access (batch reads/writes) and avoid blocking UI on large data.

### 6) Security & Privacy
1. Review permissions and only request required ones. Ensure Android `app.json` and iOS `infoPlist` strings are friendly.
2. If sensitive data stored (customer info), consider encrypting data at rest (using [`expo-secure-store`]).
3. Remove any hardcoded secrets/credentials and avoid logging sensitive customer data.

### 7) Build & Release Readiness
1. Set up a consistent build workflow (Expo App Signing / EAS, or bare workflow builds) and ensure `app.json` is configured for release (app name, icons, splash screens, package IDs).
2. Configure production environment variables (e.g., API endpoints, feature toggles) if needed.
3. Add linting and formatting enforcement (ESLint, Prettier) to catch issues early.
4. Create a release checklist: bump version, test on real device, validate permissions, run bundle analysis.

### 8) Monitoring & Support
1. Integrate crash/error reporting (Sentry/Bugsnag) if acceptable.
2. Add an in-app feedback/help screen with contact info and version number.

**Relevant files (starting points)**
- `app/(tabs)/sketch.tsx` — sketching + save flow (design persistence)
- `src/StorageService.js` — central persistence logic
- `components/ColorPicker.js` — UI components (extension/ease of data input)
- `app.json` — permissions and release config
- `README.md` — docs; update to reflect prod setup

**Verification**
1. Run the full app on both Android and iOS simulators/emulators and validate: saving designs, loading sessions, exporting CSV, importing CSV, offline behavior.
2. Run `npm run lint` and `npm test` (add tests if missing).
3. Validate export/import using real file interaction (share/save and re-import).
4. Confirm no runtime errors in console and no warnings in metro bundler.

**Decisions / Assumptions**
- Assume user wants an offline-first app without a backend; all data is local.
- Assume CSV format will serve as primary import/export interchange (no cloud sync planned).

**Next step**
Identify which production-ready feature to implement first (e.g., stable order data model + CSV export/import) and define the exact CSV columns/format needed. (If you want, I can draft a CSV schema and UI screens next.)
