# Z-Profile IPRS — Agent Instructions

## Project Overview

React + TypeScript + Vite + Tailwind CSS demo — IPRS Kenya identity intelligence platform with 15 screens. Not a production app; it's a demo/poster-style project simulating an identity verification system.

## Key Architecture

- **State**: Two React contexts — `AppDataContext` (auth, cases, users, notifications, toasts, billing) and `RouterContext` (hash-based routing, navigation stack). Use `useAppData()` and `useAppRouter()` hooks.
- **Routing**: Hash-based (`window.location.hash`). `platformRoutes` in `src/types/routes.ts` defines all 15 screens + blueprint view. Route `icon` field references `iconMap` keys in `src/utils/iconRegistry.tsx`.
- **Screen components**: Each `ScreenX_*.tsx` has `export const ScreenX_*` + `export default ScreenX_*` (the `default` export is **required** for `React.lazy()` in `BlueprintView.tsx`). Never remove `export default`.
- **Icon system**: `src/utils/iconRegistry.tsx` (`.tsx`, not `.ts` — contains JSX) exports `iconMap: Record<string, React.ReactNode>` at fixed size 16. Layout/navigation components import from it. Screen components still import lucide-react directly since they render their own icons.
- **Types**: `src/types/index.ts` — `IdentityProfile` uses `trustLevel` (not `riskLevel`). `PageRoute` has `id`, `path`, `moduleNumber`, `icon`, `category`.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # vite build (produces single inlined HTML via vite-plugin-singlefile)
npm run preview      # Preview production build
npx tsc --noEmit     # Type check (strict, noUnusedLocals, noUnusedParameters enabled)
```

No linter, no test runner, no CI configured.

## Critical Gotchas

- **`iconRegistry.tsx` must be `.tsx`** — not `.ts`. It contains JSX elements. If renamed to `.ts`, TypeScript will crash.
- **All screen components need `export default`** for `React.lazy()` to work in `BlueprintView.tsx`. If you remove it, lazy imports break.
- **Hardcoded credentials are gone** — `Screen1_Login.tsx` password starts as `''`, `Screen12_ApiDocumentation.tsx` API key uses `import.meta.env.VITE_DEMO_API_KEY || ''`. Never reintroduce hardcoded secrets.
- **Auth redirect loop fix**: `App.tsx` uses `authChecked` state — the redirect only fires after the initial check completes. Don't remove this.
- **Toast timer cleanup**: `AppDataContext.pushToast` uses `clearTimeout` in a cleanup function. Don't remove it or toast timers leak.
- **`trustLevel` not `riskLevel`** — The IdentityProfile type uses `trustLevel: 'Low' | 'Medium' | 'High'`. Don't rename it back.

## File Organization

```
src/
  components/
    screens/        # Screen1-15 (React.FC, named + default export)
    layout/         # AppShell, PageLayout
    common/         # Header, IprsLogo, CommandPalette, ToastContainer
    navigation/     # PageNavigator, PageRouter
    blueprint/      # BlueprintView (lazy-loaded screens)
    interactive/    # ScreenModal, SearchSimulationModal, LiveAppMode
    footer/         # SystemArchitecture, KeyFeatures, SecurityCompliance, DeploymentCiCd, BrandFooter
  context/          # AppDataContext, RouterContext
  types/            # index.ts (IdentityProfile, etc.), routes.ts (platformRoutes)
  data/             # mockData.ts
  utils/            # iconRegistry.tsx
  App.tsx           # Root component
  vite-env.d.ts     # ImportMetaEnv type declarations
```

## Type System

- `tsconfig.json`: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`. All must pass before considering work done.
- `@/*` path alias maps to `src/*`.
- `vite-env.d.ts` declares `VITE_DEMO_API_KEY`, `VITE_APP_TITLE`, `VITE_APP_ENV`.

## Style

- Tailwind CSS with custom config. Colors use `#050b14`, `#071120`, `#091527` dark palette with cyan (`#06b6d4`) as accent.
- No ESLint configured. TypeScript compiler is the gatekeeper.
