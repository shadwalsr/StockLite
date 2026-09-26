# Report: Problem 7 (Stretch Feature) — Lack of Per-Warehouse Replenishment Visibility

## 1. What the Problem Was
The starter application did not provide warehouse supervisors with an at-a-glance overview of which warehouses had products nearing or below their reorder points:
- **High Cognitive Load**: Supervisors had to manually navigate to the inventory grid, filter by warehouse, and scroll through individual rows to see which facilities needed replenishment.
- **Spec Stretch Requirement**: The specification requested a dedicated Low Stock Summary panel per warehouse as a stretch goal.

## 2. What Was Done
1. **Dynamic Per-Warehouse Aggregation**:
   - In [components/InventoryTable.tsx](file:///d:/stock%20proble/components/InventoryTable.tsx), added memoized aggregation logic:
     ```typescript
     const warehouseLowStockSummary = useMemo(() => {
       return warehouses.map((w) => {
         const warehouseProds = products.filter((p) => p.warehouseId === w.id)
         const lowStockCount = warehouseProds.filter((p) =>
           isLowStock(p.currentStock, p.reorderThreshold),
         ).length
         return {
           ...w,
           totalSkus: warehouseProds.length,
           lowStockCount,
         }
       })
     }, [products, warehouses])
     ```
3. **Interactive Restock Alert Dropdown & Direct Stock Purchasing**:
   - Added pulsing alert indicators (`⚠ Replenishment Required`) whenever any warehouse has low-stock SKUs.
   - Built an interactive **"Click to Restock ▾"** action on each affected warehouse card that smoothly expands a replenishment menu.
   - For each depleted product, the menu presents:
     - Real-time stock vs reorder threshold, with deficit indicators.
     - Quick preset chips (`Min Deficit`, `+25`, `+50`, `+100`) and customizable numeric quantity input.
     - A direct **"⚡ Buy Stock"** button that executes a stock-in mutation immediately via `/api/items`.
     - An optional **"⚡ Restock All"** one-click batch replenishment button.
     - Instant reactive state synchronization that removes replenished products from the low-stock alert list in real time.

## 3. How It Benefited the Overall System
- **Rapid Operational Prioritization**: Supervisors can immediately spot which warehouse requires urgent purchase orders upon opening the dashboard.
- **One-Click In-Situ Restocking**: Eliminates navigating to separate forms to replenish stock — supervisors can order inventory directly from the alert interface.
- **Unified Logic**: Reuses the core `isLowStock` helper so the numbers on the summary cards always match the filtered table rows below.
