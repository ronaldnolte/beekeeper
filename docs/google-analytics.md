# BeekTools Google Analytics Architecture

This document maps the Google Analytics 4 (GA4) configuration for the **BeekTools** suite of applications. Use this as a reference when updating tracking codes or deploying new features.

---

## 1. Domain and Property Mapping

We use exactly **three (3)** active Google Analytics properties to isolate traffic metrics for our marketing page, core app, and forecasting tool.

| Site / Application | Target Production Domain | GA4 Stream Name | Measurement ID | Property ID |
| :--- | :--- | :--- | :--- | :--- |
| **Marketing Web** | `https://www.beektools.com` | `www.beektools.com` | **`G-9JW6ZWQSE3`** | `519251456` |
| **Beekeeper App** | `https://beekeeper.beektools.com` | `Beekeeper application` | **`G-V3F9W1WQT0`** | `15007881652` |
| **Hive Forecast** | `https://forecast.beektools.com` | `forecast.beektools.com` | **`G-H60164WT45`** | `51996128` |

> [!WARNING]
> Do not mix these up. In the past, the core app and the forecast tool overlapped on `G-H60164WT45`. Keep them separated to keep user metrics clean.

> [!NOTE]
> An earlier version of this doc listed the Beekeeper App as `G-4WLKRJRNHY` ("Beektools App"). That was a leftover from the TBH Beekeeper era — the live Vite app has always used `G-V3F9W1WQT0` (stream "Beekeeper application", ID `15007881652`), confirmed active in GA and matching the fallback in `src/main.tsx`. Corrected 2026-06-19.

---

## 2. Deleted/Unused Properties

The following properties have been deleted/deprecated from Google Analytics to clean up the workspace. **Do not use these IDs:**
*   `Beta.beektools.com (Development)` – `G-RJEQ1VBDMJ` (Property ID `519875465`)
*   `tbh.beektools.com (production)` – `G-267TWWVTQT` (Property ID `519882438`) – *Now redirects to the main `beektools.com` domain.*

---

## 3. Codebase Configurations

Each codebase utilizes a specific environment variable or a hardcoded fallback for local development.

### A. Marketing Site (Next.js)
*   **Repository:** `TBH Beekeeper`
*   **Configuration File:** [apps/web/app/layout.tsx](file:///e:/Antigravity/Beeks/TBH%20Beekeeper/apps/web/app/layout.tsx)
*   **Code:**
    ```tsx
    <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || "G-9JW6ZWQSE3"} />
    ```
*   **Vercel Env Var:** `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`

### B. Core App (Vite + Capacitor)
*   **Repository:** `Beekeeper`
*   **Configuration File:** [src/main.tsx](file:///e:/Antigravity/Beeks/Beekeeper/src/main.tsx)
*   **Code:**
    ```typescript
    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-V3F9W1WQT0';
    ```
*   **Vercel Env Var:** `VITE_GA_MEASUREMENT_ID`

### C. Hive Forecast App (Next.js)
*   **Repository:** `Hive-forecast`
*   **Configuration File:** [app/layout.tsx](file:///e:/Antigravity/Beeks/Hive-forecast/app/layout.tsx)
*   **Code:**
    ```tsx
    <GoogleAnalytics gaId="G-H60164WT45" />
    ```

---

## 4. Mobile Compilation Requirements (Capacitor AAB)

When building a new native release for the **Google Play Store**:
1. Any changes to `src/main.tsx` (such as changing GA Measurement IDs or updating fallback options) affect the web assets built by Vite.
2. Therefore, you **must recompile the signed Android App Bundle (`.aab`) locally** using the build script:
   ```powershell
   .\build-local-aab.ps1
   ```
3. This ensures that the web distribution bundled inside the Android app bundle contains the correct, up-to-date Google Analytics tracking tags.
