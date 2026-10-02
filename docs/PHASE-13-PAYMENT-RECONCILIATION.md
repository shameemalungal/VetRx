# VetRx — Phase 13 Payment Reconciliation & Audit Runbook

## 1. Objective

Payment reconciliation ensures 100% financial fidelity between:
1. VetRx Internal Database (`Payment`, `PaymentEvent`, `Subscription`).
2. PayU Merchant Portal / Settlement Reports.
3. Bank Accounts / Settlement Statements.

---

## 2. Automated Reconciliation Worker

When practitioners pay in the browser, dropped internet connections, browser crashes, or closed tabs can prevent the return URL (`surl`) from notifying VetRx. The Automated Reconciliation Worker bridges this gap:

### Worker Cadence & Logic
- **Schedule**: Executes every 15 minutes.
- **Query Scope**: Identifies `Payment` records in `PENDING` status created between 15 minutes and 24 hours ago.
- **Reconciliation Action**:
  1. For each pending payment, invokes `PayUAdapter.getPaymentStatus(txnid)`.
  2. If PayU confirms `status === "success"`, transitions `Payment` to `SUCCESS`, triggers `SubscriptionService.activateFromPayment()`, and logs an audit record.
  3. If PayU confirms `status === "failure"`, transitions `Payment` to `FAILED`.
  4. If payment is older than 24 hours and PayU reports not found or pending, marks `Payment` as `EXPIRED_ABANDONED`.

---

## 3. Manual Administrator Reconciliation Runbook

If a customer reports an unactivated subscription after payment:

1. **Locate Internal Payment Record**:
   ```sql
   SELECT id, "practiceId", "amountPaisa", status, "internalReference", "gatewayTransactionId", "createdAt"
   FROM "Payment"
   WHERE "internalReference" = 'TXN-VRX-...' OR "practiceId" = '<practiceId>'
   ORDER BY "createdAt" DESC LIMIT 5;
   ```

2. **Query PayU S2S Status**:
   Execute the verification CLI script:
   ```bash
   node scripts/verify_payu_txnid.mjs TXN-VRX-...
   ```

3. **Inspect Audit & Payment Events**:
   ```sql
   SELECT id, provider, "eventId", "eventType", "processingStatus", "receivedAt"
   FROM "PaymentEvent"
   WHERE "eventId" = '<txnid>' OR "paymentId" = '<paymentId>';
   ```

4. **Remediate / Force Reconcile**:
   If PayU confirms valid receipt of funds, invoke the automated reconciliation method directly to bring the subscription into immediate `ACTIVE` compliance without manual database surgery.
