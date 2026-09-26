# Report: Problem 1 — Incorrect Stock Totals After Operations

## 1. What the Problem Was
In the starter application, stock calculations across operations drifted over time or failed to match manual sequential arithmetic:
- **Dispersed Mutation Logic**: There was no single source of truth for mutating stock numbers. Updates were handled differently across various files.
- **Next.js Route Bundle Isolation**: Next.js App Router bundles each API route handler independently in development mode (`app/api/items/route.ts` vs `app/api/transactions/route.ts`). Consequently, module-level variables in `lib/seed-data.ts` were re-instantiated and isolated across route boundaries, causing state changes in one route to be missing or desynchronized in another.
- **Route Caching**: Without explicit dynamic configuration, GET requests could be cached statically by Next.js, serving stale inventory figures.

## 2. What Was Done
1. **Centralized Data Layer**:
   - Created [lib/inventory-store.ts](file:///d:/stock%20proble/lib/inventory-store.ts) as the unified store facade providing pure, independently testable functions (`getStock`, `applyStockChange`, `applyStockMovement`, `applyTransfer`).
2. **Process-Level State Persistence**:
   - Attached the in-memory `products` and `transactions` arrays to Node's `globalThis` in [lib/seed-data.ts](file:///d:/stock%20proble/lib/seed-data.ts).
   - This ensures that all route bundles and server components reference and mutate the exact same in-memory array instance in the Node process.
3. **Prevented Stale Response Caching**:
   - Configured `export const dynamic = 'force-dynamic'` on [app/api/items/route.ts](file:///d:/stock%20proble/app/api/items/route.ts) and [app/api/transactions/route.ts](file:///d:/stock%20proble/app/api/transactions/route.ts).

## 3. How It Benefited the Overall System
- **100% Data Consistency**: All read and write operations across the entire application share the exact same synchronized dataset.
- **Mathematical Accuracy**: Sequences of mixed operations (e.g. `+25` stock-in followed by `-10` stock-out) strictly match exact arithmetic at every step.
- **Elimination of Phantom Desyncs**: The UI, Items API, and Transactions API now always present unified inventory counts.
