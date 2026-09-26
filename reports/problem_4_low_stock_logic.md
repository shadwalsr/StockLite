# Report: Problem 4 — Incorrect Low-Stock Status Logic

## 1. What the Problem Was
The threshold logic for identifying low-stock inventory had an off-by-one boundary bug:
- **Strict `<` Comparison**: In several areas, low-stock checks used strict less-than (`<`) instead of less-than-or-equal (`<=`).
- **Real-World Impact**: Products sitting **exactly at** their reorder threshold (e.g. 20 units on hand with a reorder threshold of 20) were marked as "In stock" (green / OK) and were excluded when filtering by "Low stock only". In warehouse management, reaching the reorder threshold is the trigger to place a purchase order. Failing to flag threshold items risks stockouts.

## 2. What Was Done
1. **Single Source of Truth**:
   - Created the canonical helper in [lib/inventory-store.ts](file:///d:/stock%20proble/lib/inventory-store.ts):
     ```typescript
     export function isLowStock(stock: number, threshold: number): boolean {
       return stock <= threshold
     }
     ```
2. **Standardized Across Components**:
   - In [components/InventoryTable.tsx](file:///d:/stock%20proble/components/InventoryTable.tsx), updated the filter from an inlined comparison to `!isLowStock(p.currentStock, p.reorderThreshold)`.
   - In [lib/types.ts:getStockStatus](file:///d:/stock%20proble/lib/types.ts#L41):
     - `currentStock < reorderThreshold` returns `'critical'` (Below threshold).
     - `currentStock === reorderThreshold` returns `'low'` (At threshold).
     - Both categories are included when low-stock filtering is active.
   - Reused the same `isLowStock` helper in the per-warehouse summary calculations.

## 3. How It Benefited the Overall System
- **Timely Procurement**: Products needing reorder are flagged immediately upon hitting their threshold rather than only after falling below it.
- **System-Wide Consistency**: The status badge, the inventory table filter checkbox, and the summary panel all use identical boundary logic.
