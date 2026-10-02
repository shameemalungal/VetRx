# VetRx Phase 14 — Role-Permission Matrix

## 1. Granular Permission Registry

| Permission Key | Domain | Description |
|---|---|---|
| `PATIENT_VIEW` | Clinical | View patient demographics and records |
| `PATIENT_CREATE` | Clinical | Register a new patient |
| `PATIENT_UPDATE` | Clinical | Modify patient details |
| `PATIENT_DELETE` | Clinical | Archive/remove a patient |
| `OWNER_VIEW` | Clinical | View animal owner information |
| `OWNER_CREATE` | Clinical | Register animal owner |
| `OWNER_UPDATE` | Clinical | Update animal owner contact details |
| `OWNER_DELETE` | Clinical | Remove animal owner record |
| `PRESCRIPTION_VIEW` | Clinical | View medical prescriptions and items |
| `PRESCRIPTION_CREATE`| Clinical | Create and issue prescriptions |
| `PRESCRIPTION_UPDATE`| Clinical | Modify draft prescriptions |
| `PRESCRIPTION_DELETE`| Clinical | Delete draft prescriptions |
| `MEDICINE_VIEW` | Clinical | View formulary and medicines |
| `MEDICINE_CREATE` | Clinical | Add custom medicines to formulary |
| `MEDICINE_UPDATE` | Clinical | Update custom medicine parameters |
| `MEDICINE_DELETE` | Clinical | Deactivate medicines |
| `PACKAGE_VIEW` | Clinical | View treatment packages |
| `PACKAGE_CREATE` | Clinical | Create treatment packages |
| `PACKAGE_UPDATE` | Clinical | Edit treatment packages |
| `PACKAGE_DELETE` | Clinical | Deactivate treatment packages |
| `INVOICE_VIEW` | Practice | View invoices and receipts |
| `INVOICE_CREATE` | Practice | Generate invoice documents |
| `INVOICE_UPDATE` | Practice | Update invoice drafts |
| `INVOICE_DELETE` | Practice | Cancel/void invoice drafts |
| `REPORT_VIEW` | Practice | View clinical and financial reports |
| `PRACTICE_VIEW` | Practice | View practice identity and profile |
| `PRACTICE_SETTINGS_MANAGE` | Practice | Update practice header, signature, clinic profile |
| `USER_VIEW` | Administration | View practice members and invitations |
| `USER_INVITE` | Administration | Send, resend, and revoke invitations |
| `USER_UPDATE` | Administration | Update member details |
| `USER_DEACTIVATE` | Administration | Deactivate member from practice |
| `USER_REACTIVATE` | Administration | Reactivate member to practice |
| `ROLE_VIEW` | Administration | View roles and permissions |
| `ROLE_ASSIGN` | Administration | Assign or modify member roles |
| `AUDIT_LOG_VIEW` | Security | Inspect security and practice audit logs |
| `BILLING_VIEW` | Commercial | View subscription status, plans, payments |
| `BILLING_MANAGE` | Commercial | Initiate payments and change commercial payment methods |
| `SUBSCRIPTION_VIEW` | Commercial | View active quotas, limits, and plan details |
| `SUBSCRIPTION_MANAGE`| Commercial | Upgrade, downgrade, cancel, or renew subscriptions |
| `OWNERSHIP_TRANSFER` | Governance | Transfer authoritative practice ownership |
| `PLATFORM_PRACTICE_MANAGE` | Platform | Platform-level practice oversight |
| `PLATFORM_USER_MANAGE` | Platform | Platform-level user support |
| `PLATFORM_BILLING_MANAGE` | Platform | Platform-level commercial reconciliation |
| `PLATFORM_AUDIT_VIEW` | Platform | Platform-wide security log review |

---

## 2. Authoritative Role-Permission Mapping

| Permission Key | PRACTICE_OWNER | PRACTICE_ADMIN | VETERINARIAN | STAFF | READ_ONLY | PLATFORM_SUPER_ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `PATIENT_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `PATIENT_CREATE` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `PATIENT_UPDATE` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `PATIENT_DELETE` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `OWNER_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `OWNER_CREATE` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `OWNER_UPDATE` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `OWNER_DELETE` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `PRESCRIPTION_VIEW`| ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `PRESCRIPTION_CREATE`| ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `PRESCRIPTION_UPDATE`| ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `PRESCRIPTION_DELETE`| ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `MEDICINE_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `MEDICINE_CREATE` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `MEDICINE_UPDATE` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `MEDICINE_DELETE` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `PACKAGE_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `PACKAGE_CREATE` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `PACKAGE_UPDATE` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `PACKAGE_DELETE` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `INVOICE_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `INVOICE_CREATE` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `INVOICE_UPDATE` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `INVOICE_DELETE` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `REPORT_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `PRACTICE_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `PRACTICE_SETTINGS_MANAGE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `USER_VIEW` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `USER_INVITE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `USER_UPDATE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `USER_DEACTIVATE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `USER_REACTIVATE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `ROLE_VIEW` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `ROLE_ASSIGN` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `AUDIT_LOG_VIEW` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `BILLING_VIEW` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `BILLING_MANAGE` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `SUBSCRIPTION_VIEW`| ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `SUBSCRIPTION_MANAGE`| ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `OWNERSHIP_TRANSFER` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `PLATFORM_*` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
