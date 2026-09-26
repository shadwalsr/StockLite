# Report: Problem 2 — Negative Inventory Allowed

## 1. What the Problem Was
The warehouse application allowed inventory to drop below zero:
- **Missing Stock Ceilings**: In the starter `applyStockMovement`, the code decremented `product.currentStock` without checking whether the requested quantity was greater than available stock.
- **Unchecked Inputs**: Non-numeric values (e.g. `"abc"`), zero, negative numbers, and `NaN` were not properly rejected on the backend. Calling the API directly (bypassing the HTML form) could easily force warehouse quantities into negative numbers or corrupt records.

## 2. What Was Done
1. **Server-Side Bounds Checking**:
   - In [lib/seed-data.ts:applyStockMovement](file:///d:/stock%20proble/lib/seed-data.ts#L268):
     - Validated that `quantity` is a positive, finite number (`typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0`).
     - For `OUT` operations, checked `quantity <= product.currentStock`. If exceeded, throws an informative error:
       `Insufficient stock: requested ${quantity}, but only ${product.currentStock} available in warehouse`.
2. **Defensive API Gatekeeping**:
   - In [app/api/items/route.ts](file:///d:/stock%20proble/app/api/items/route.ts), added pre-validation for missing fields, non-string IDs, invalid direction parameters, and invalid numeric quantities, returning clean HTTP 400 status codes.
3. **Proactive Frontend Protection**:
   - In [components/StockForm.tsx](file:///d:/stock%20proble/components/StockForm.tsx), added client-side validation that alerts staff to available stock before the request is even dispatched.

## 3. How It Benefited the Overall System
- **Physical Inventory Integrity**: Stock numbers represent physical reality; items can never drop into negative values.
- **API Hardening**: Protects the backend against malicious or accidental malformed calls from external scripts or direct HTTP requests.
- **Improved UX**: Staff receive immediate error messaging explaining why a stock-out cannot proceed and how many units are available.
