# Gifty McGiftface – Frontend

React 19 + TypeScript, gebaut mit [Vite](https://vite.dev), gestylt mit Tailwind CSS 3.

## Scripts

| Befehl | Beschreibung |
|---|---|
| `pnpm dev` | Dev-Server auf http://localhost:3000 mit Hot Reload |
| `pnpm build` | Typprüfung (`tsc`) und Production-Build nach `dist/` |
| `pnpm preview` | Production-Build lokal ansehen |
| `pnpm lint` | ESLint (inkl. React-Hooks-Regeln) |
| `pnpm test` | Tests mit Vitest + Testing Library (`*.test.tsx`) |

## API

Alle Requests gehen an `/api`. Der Vite-Dev-Server leitet `/api/*` an das Backend auf `localhost:3001` weiter
(siehe `vite.config.ts`), im Docker-Setup übernimmt das nginx. Eine andere API-Adresse lässt sich beim Build
über `VITE_API_URL` setzen.
