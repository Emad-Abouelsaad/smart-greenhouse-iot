# Dashboard (React)

Web application of the Smart Greenhouse System. See the main [README](../README.md).

```bash
npm install
npm run dev          # development server
npm test             # unit tests (Vitest)
npx playwright test  # end-to-end tests
npm run build        # production build in dist/
```

Source structure:

```text
src/
  pages/        Home, Login, Sign up, Dashboard, Control panel, History, Settings
  components/   Layout, SensorCard, SensorChart, AlertsPanel, ProtectedRoute
  logic/        thresholds, alerts, automation rules, CSV, validation (pure functions)
  services/     Firebase and in-memory adapters, control functions, React hooks
  simulation/   greenhouse model, virtual ESP8266, cloud logic for simulation mode
  auth/         authentication context
```
