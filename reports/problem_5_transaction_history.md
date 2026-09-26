# Report: Problem 5 — Missing Transaction History & Broken Audit Trail

## 1. What the Problem Was
The starter application lacked a functioning transaction history:
- **No Transaction Recording**: Neither `applyStockMovement` nor `applyTransfer` invoked `recordTransaction`. Consequently, any movements performed by users were invisible on the `/history` page.
- **Unlinked Transfers**: The seed data contained four transactions, but the transfer pair (`t-003` and `t-004`) was rendered as two disconnected rows without visual cues linking the source and destination events.
- **Static Route Caching**: In Next.js, `GET /api/transactions` did not have `dynamic = 'force-dynamic'`, causing the server to return stale cached transaction data.

## 2. What Was Done
1. **Automated Event Logging**:
   - In [lib/seed-data.ts:applyStockMovement](file:///d:/stock%20proble/lib/seed-data.ts#L268), every stock in logs an `IN` transaction and every stock out logs an `OUT` transaction with product details, warehouse, quantity, and current ISO timestamp.
   - In [lib/seed-data.ts:applyTransfer](file:///d:/stock%20proble/lib/seed-data.ts#L307), every transfer logs both a `TRANSFER_OUT` and `TRANSFER_IN` event sharing mutual `linkedTransactionId` values.
2. **Linked Transfer Presentation**:
   - In [components/TransactionTable.tsx](file:///d:/stock%20proble/components/TransactionTable.tsx), rendered a visual pairing badge (`⇄ t-XXX`) next to transfer records showing their linked counterpart.
3. **Non-Mutating Sort & Dynamic Fetch**:
   - Ensured transactions are sorted descending by timestamp using a non-mutating copy `[...data].sort(...)`.
   - Added a `useEffect` hook in `TransactionTable` to fetch live data from `/api/transactions` whenever the user navigates to the history view.
4. **Composed Filtering**:
   - Enabled filtering by transaction type (`IN`, `OUT`, `TRANSFER_OUT`, `TRANSFER_IN`) and by warehouse, with composeable `AND` logic and a clean empty state.

## 3. How It Benefited the Overall System
- **Total Operational Transparency**: Staff and auditors have an immutable chronological record of every unit added, removed, or moved between warehouses.
- **Clear Transfer Context**: Supervisors can instantly identify where stock originated and where it was received.
- **Effortless Auditing**: Filters allow isolating specific warehouses or transaction types in seconds.
