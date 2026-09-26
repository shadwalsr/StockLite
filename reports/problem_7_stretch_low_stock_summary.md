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
2. **Integrated Executive Summary Card Grid**:
   - Built a panel styled to match the warehouse industrial design system (`--moss`, `--rust`, `--steel-light`).
   - Dynamically highlights counts with responsive color cues (rust/red if low-stock items exist, moss/green if healthy).
   - Re-evaluates in real time whenever any stock movement or transfer occurs.

## 3. How It Benefited the Overall System
- **Rapid Operational Prioritization**: Supervisors can immediately spot which warehouse requires urgent purchase orders upon opening the dashboard.
- **Unified Logic**: Reuses the core `isLowStock` helper so the numbers on the summary cards always match the filtered table rows below.
