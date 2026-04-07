# Receipt Number Backfill (Legacy Records)

This project now uses strict sequential receipt numbers:

- Booking: `BR-000001`, `BR-000002`, ...
- Trial: `TR-000001`, `TR-000002`, ...

Legacy records may still contain:

- `BR-<visitId>` / `TR-<visitId>`
- empty/missing `bookingReceiptNumber` or `trialReceiptNumber`

## Safe Backfill Strategy

1. Use Admin SDK only (server-side), never from client.
2. Iterate `enquiries` documents in small batches.
3. For each `visits[]` item:
   - If booking receipt is relevant (`hearingAidBooked` or positive `bookingAdvanceAmount`) and `bookingReceiptNumber` is not strict (`/^BR-\\d{6}$/`), allocate a new booking number and write it.
   - If trial receipt is relevant (`trialGiven`/`hearingAidTrial` and trial type is `home`) and `trialReceiptNumber` is not strict (`/^TR-\\d{6}$/`), allocate a new trial number and write it.
4. Mirror the updated numbers into `visitSchedules[]` for the same index.
5. Write only changed docs and keep logs of:
   - enquiry id
   - visit index
   - old number
   - new number
6. Run once in a maintenance window and keep a backup/export.

## Idempotency Rules

- Skip visits that already have strict numbers.
- Re-running the script should not mutate already-migrated rows.

## Post-Backfill Checks

- Randomly verify Booking and Trial receipts in the UI.
- Confirm search by receipt number returns expected rows.
- Confirm no duplicates in generated strict numbers.

