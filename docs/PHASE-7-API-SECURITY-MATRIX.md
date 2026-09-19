# VetRx — Phase 7 API Security & Authorization Matrix

This document provides a comprehensive inventory and security classification for all HTTP routes mounted under `/api/*`.

---

## 1. Security Classification Key

- **Auth Required:** Whether the route requires a valid session token (via `requireAuth` middleware).
- **Practice Required:** Whether the route derives active tenant context server-side (via `requirePractice` middleware).
- **Role Required:** Minimum membership role required (`MEMBER`, `ADMIN`, or `OWNER`).
- **Tenant Scoped:** Whether queries are strictly filtered by server-derived `practiceId` (never client-provided).
- **Sensitive Data:** Indicates presence of PII, clinical records, financials, or credential hashes.
- **Mutation:** Whether the request modifies state (`POST`, `PATCH`, `PUT`, `DELETE`).
- **Audit Log:** Whether the operation records an immutable record in `AuditLog`.

---

## 2. API Endpoint Matrix

| Method | Endpoint Route | Auth Req? | Practice Req? | Role Req | Tenant Scoped? | Sensitive Data? | Mutation? | Audit Log? | Controller / Handler Reference |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `GET` | `/api/health` | No | No | Public | N/A (System) | No | No | No | `health.controller.ts:healthRouter.get('/health')` |
| `GET` | `/api/ready` | No | No | Public | N/A (System) | No | No | No | `health.controller.ts:healthRouter.get('/ready')` |
| `POST` | `/api/auth/register` | No | No | Public | Practice Init | Yes (Password/Email) | Yes | Yes (Practice Created) | `auth.controller.ts:authRouter.post('/register')` |
| `POST` | `/api/auth/login` | No | No | Public | Login Context | Yes (Credentials) | Yes (Session) | Yes (Session Established) | `auth.controller.ts:authRouter.post('/login')` |
| `POST` | `/api/auth/logout` | No | No | Public/User | Session Inval. | No | Yes (Revoke) | No | `auth.controller.ts:authRouter.post('/logout')` |
| `GET` | `/api/auth/me` | **Yes** | No | User | User Profile | Yes (User/Doctor Info) | No | No | `auth.controller.ts:authRouter.get('/me')` |
| `GET` | `/api/auth/google/start` | No | No | Public | N/A (OAuth) | No | No | No | `auth.controller.ts:authRouter.get('/google/start')` |
| `GET` | `/api/auth/google/callback` | No | No | Public | User Resolve | Yes (OAuth Tokens) | Yes (Session) | Yes (OAuth Login) | `auth.controller.ts:authRouter.get('/google/callback')` |
| `GET` | `/api/practice` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes (Practice Data) | No | No | `practice.controller.ts:practiceRouter.get('/')` |
| `PATCH` | `/api/practice` | **Yes** | **Yes** | **Owner** | **Yes (`practiceId`)** | Yes | Yes | Yes | `practice.controller.ts:practiceRouter.patch('/')` |
| `GET` | `/api/practice/settings` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes (Doctor PII) | No | No | `practice.controller.ts:practiceRouter.get('/settings')` |
| `PATCH` | `/api/practice/settings` | **Yes** | **Yes** | **Admin/Owner** | **Yes (`practiceId`)** | Yes (Doctor PII) | Yes | Yes | `practice.controller.ts:practiceRouter.patch('/settings')` |
| `GET` | `/api/owners` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes (Client PII) | No | No | `clinical.controller.ts:clinicalRouter.get('/owners')` |
| `GET` | `/api/owners/:id` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes (Client PII) | No | No | `clinical.controller.ts:clinicalRouter.get('/owners/:id')` |
| `POST` | `/api/owners` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes (Client PII) | Yes | **Yes (`OWNER_CREATED`)** | `clinical.controller.ts:clinicalRouter.post('/owners')` |
| `PATCH` | `/api/owners/:id` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes (Client PII) | Yes | **Yes (`OWNER_UPDATED`)** | `clinical.controller.ts:clinicalRouter.patch('/owners/:id')` |
| `DELETE` | `/api/owners/:id` | **Yes** | **Yes** | **Admin** | **Yes (`practiceId`)** | Yes | Yes | **Yes (`OWNER_DELETED`)** | `clinical.controller.ts:clinicalRouter.delete('/owners/:id')` |
| `GET` | `/api/patients` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes (Animal Signalment) | No | No | `clinical.controller.ts:clinicalRouter.get('/patients')` |
| `GET` | `/api/patients/:id` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes (Animal Signalment) | No | No | `clinical.controller.ts:clinicalRouter.get('/patients/:id')` |
| `POST` | `/api/patients` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes (Signalment/Owner) | Yes | **Yes (`PATIENT_CREATED`)** | `clinical.controller.ts:clinicalRouter.post('/patients')` |
| `PATCH` | `/api/patients/:id` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes | Yes | **Yes (`PATIENT_UPDATED`)** | `clinical.controller.ts:clinicalRouter.patch('/patients/:id')` |
| `DELETE` | `/api/patients/:id` | **Yes** | **Yes** | **Admin** | **Yes (`practiceId`)** | Yes | Yes | **Yes (`PATIENT_DELETED`)** | `clinical.controller.ts:clinicalRouter.delete('/patients/:id')` |
| `GET` | `/api/medicines` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Clinical Formulary | No | No | `clinical.controller.ts:clinicalRouter.get('/medicines')` |
| `GET` | `/api/medicines/:id` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Clinical Formulary | No | No | `clinical.controller.ts:clinicalRouter.get('/medicines/:id')` |
| `POST` | `/api/medicines` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Clinical Formulary | Yes | **Yes (`MEDICINE_CREATED`)** | `clinical.controller.ts:clinicalRouter.post('/medicines')` |
| `PATCH` | `/api/medicines/:id` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Clinical Formulary | Yes | **Yes (`MEDICINE_UPDATED`)** | `clinical.controller.ts:clinicalRouter.patch('/medicines/:id')` |
| `DELETE` | `/api/medicines/:id` | **Yes** | **Yes** | **Admin** | **Yes (`practiceId`)** | Clinical Formulary | Yes | **Yes (`MEDICINE_DEACTIVATED`)** | `clinical.controller.ts:clinicalRouter.delete('/medicines/:id')` |
| `GET` | `/api/packages` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Protocols | No | No | `clinical.controller.ts:clinicalRouter.get('/packages')` |
| `GET` | `/api/packages/:id` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Protocols | No | No | `clinical.controller.ts:clinicalRouter.get('/packages/:id')` |
| `POST` | `/api/packages` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Protocols | Yes | **Yes (`PACKAGE_CREATED`)** | `clinical.controller.ts:clinicalRouter.post('/packages')` |
| `PATCH` | `/api/packages/:id` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Protocols | Yes | **Yes (`PACKAGE_UPDATED`)** | `clinical.controller.ts:clinicalRouter.patch('/packages/:id')` |
| `DELETE` | `/api/packages/:id` | **Yes** | **Yes** | **Admin** | **Yes (`practiceId`)** | Protocols | Yes | **Yes (`PACKAGE_DELETED`)** | `clinical.controller.ts:clinicalRouter.delete('/packages/:id')` |
| `GET` | `/api/prescriptions` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes (Prescription History) | No | No | `clinical.controller.ts:clinicalRouter.get('/prescriptions')` |
| `GET` | `/api/prescriptions/:id` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes (Prescription Items) | No | No | `clinical.controller.ts:clinicalRouter.get('/prescriptions/:id')` |
| `POST` | `/api/prescriptions` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes (Rx Items/Doses) | Yes | **Yes (`PRESCRIPTION_CREATED`)** | `clinical.controller.ts:clinicalRouter.post('/prescriptions')` |
| `PATCH` | `/api/prescriptions/:id` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes | Yes | **Yes (`PRESCRIPTION_UPDATED`)** | `clinical.controller.ts:clinicalRouter.patch('/prescriptions/:id')` |
| `DELETE` | `/api/prescriptions/:id` | **Yes** | **Yes** | **Admin** | **Yes (`practiceId`)** | Yes | Yes | **Yes (`PRESCRIPTION_DELETED`)** | `clinical.controller.ts:clinicalRouter.delete('/prescriptions/:id')` |
| `GET` | `/api/invoices` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes (Financials) | No | No | `clinical.controller.ts:clinicalRouter.get('/invoices')` |
| `GET` | `/api/invoices/:id` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes (Financial Items) | No | No | `clinical.controller.ts:clinicalRouter.get('/invoices/:id')` |
| `POST` | `/api/invoices` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes (Amounts/Billing) | Yes | **Yes (`INVOICE_CREATED`)** | `clinical.controller.ts:clinicalRouter.post('/invoices')` |
| `PATCH` | `/api/invoices/:id` | **Yes** | **Yes** | Member | **Yes (`practiceId`)** | Yes (Amounts/Billing) | Yes | **Yes (`INVOICE_UPDATED`)** | `clinical.controller.ts:clinicalRouter.patch('/invoices/:id')` |
| `DELETE` | `/api/invoices/:id` | **Yes** | **Yes** | **Admin** | **Yes (`practiceId`)** | Yes | Yes | **Yes (`INVOICE_DELETED`)** | `clinical.controller.ts:clinicalRouter.delete('/invoices/:id')` |

---

## 3. Authorization & Tenant Security Audit Findings

1. **Zero Public Leakage on Clinical APIs:** All `/api/owners*`, `/api/patients*`, `/api/medicines*`, `/api/packages*`, `/api/prescriptions*`, and `/api/invoices*` are protected by `clinicalRouter.use(requireAuth, requirePractice)`. Unauthenticated calls receive HTTP 401 Unauthorized.
2. **Strict Server-Side Practice Derivation:** Client-provided `practiceId` in query parameters, headers, or JSON body is completely ignored by the routing layer. `practiceId` is derived exclusively from the authenticated session's active `PracticeMember` record.
3. **Cross-Tenant Entity Scoping:** Every single entity retrieval (`getOwnerById`, `getPatientById`, `getMedicineById`, `getPackageById`, `getPrescriptionById`, `getInvoiceById`) includes `{ where: { id, practiceId } }` in the Prisma query. Direct attempts to mutate or fetch entities belonging to another practice return clean HTTP 404 Not Found responses.
4. **Relational Tenant Validation:** Foreign key associations are validated within tenant boundaries prior to insertion:
   - Creating a patient asserts `getOwnerById(data.ownerId, practiceId)`.
   - Creating a prescription asserts `getPatientById(data.patientId, practiceId)`.
   - Creating an invoice asserts `getPatientById(data.patientId, practiceId)`.
5. **Mutation Audit Trail:** All creation, update, and deletion mutations invoke `AuditService.record()` asynchronously, persisting tenant practice ID, user ID, resource name, resource ID, action name, and change metadata.
