# VetRx — Phase 6 Full Integration & UAT Test Matrix

| Execution Date | Environment | Status | Total Tests | Passed | Failed | Blocked |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **2026-09-20** | Local Dev + Live Production (https://vetrx.adcpmalappuram.in) | **PASS** | **29** | **29** | **0** | **0** |

---

## Complete Test Matrix

### 1. Authentication Integration (Section 6)

| Field | Details |
| :--- | :--- |
| **Test ID** | `SEC-AUTH-01` |
| **Module** | Authentication |
| **Scenario** | Complete practice registration and credential creation |
| **Preconditions** | Clean database state or unique practice email (`vet@clinic-a.in`) |
| **Steps** | 1. Submit POST `/api/auth/register` with practice name, doctor name, email, password.<br>2. Inspect database record and session creation.<br>3. Verify practice context returned. |
| **Expected Result** | Registration creates User, Practice, Practitioner profile and establishes valid session cookie. |
| **Actual Result** | Practice, Practitioner, and User records created with bcrypt password hashing; session established. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `SEC-AUTH-02` |
| **Module** | Authentication |
| **Scenario** | Session persistence and `/api/auth/me` practice context resolution |
| **Preconditions** | Active authenticated session cookie |
| **Steps** | 1. Send GET `/api/auth/me` with session cookie.<br>2. Verify response payload includes practiceId, practitioner details, and permissions.<br>3. Simulate page reload and check session longevity. |
| **Expected Result** | Session cookie correctly identifies practitioner and provides isolated practice context without re-prompting login. |
| **Actual Result** | `/api/auth/me` returns 200 OK with correct practiceId and practitioner identity; persists across reloads. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `SEC-AUTH-03` |
| **Module** | Authentication |
| **Scenario** | Logout invalidates session immediately |
| **Preconditions** | Active authenticated session |
| **Steps** | 1. Call POST `/api/auth/logout`.<br>2. Confirm session token deleted from DB.<br>3. Attempt subsequent call to `/api/auth/me` with old cookie. |
| **Expected Result** | Session token invalidated; subsequent requests return 401 Unauthorized; cookie cleared. |
| **Actual Result** | Session token deleted immediately; subsequent call rejected with 401 Unauthorized. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `SEC-AUTH-04` |
| **Module** | Authentication |
| **Scenario** | Invalid login credentials rejected safely |
| **Preconditions** | Practice registered |
| **Steps** | 1. Attempt POST `/api/auth/login` with wrong password.<br>2. Attempt login with non-existent email.<br>3. Attempt login with malformed JSON. |
| **Expected Result** | Returns 401 with generic "Invalid email or password" error; no stack traces or user enumeration leaks. |
| **Actual Result** | Returns 401 with clean error payload; zero sensitive or stack information exposed. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

---

### 2. Multi-Tenant Isolation — P0 Release Gate (Section 7)

| Field | Details |
| :--- | :--- |
| **Test ID** | `TENANT-P0-01` |
| **Module** | Tenant Isolation |
| **Scenario** | Cross-tenant entity separation (Practice A vs Practice B) |
| **Preconditions** | Practice A and Practice B seeded with distinct owners, patients, prescriptions, invoices |
| **Steps** | 1. Authenticate as Practice A practitioner.<br>2. Query owners, patients, prescriptions, invoices.<br>3. Authenticate as Practice B practitioner.<br>4. Query owners, patients, prescriptions, invoices. |
| **Expected Result** | Practice A sees ONLY Practice A data (100% isolation); Practice B sees ONLY Practice B data. |
| **Actual Result** | Strict isolation verified; zero cross-tenant record leakage across all database queries. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `TENANT-P0-02` |
| **Module** | Tenant Isolation |
| **Scenario** | Client-supplied `practiceId` cannot override server-side session context |
| **Preconditions** | User authenticated under Practice B session |
| **Steps** | 1. Send POST/PUT request with body `practiceId = practice_a_id`.<br>2. Send request headers `x-practice-id: practice_a_id`.<br>3. Inspect created record in database. |
| **Expected Result** | Server middleware strictly overrides client-provided `practiceId` with session `practiceId`; record saved under Practice B. |
| **Actual Result** | Server middleware overwrote client input; record created under authenticated Practice B. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `TENANT-P0-03` |
| **Module** | Tenant Isolation |
| **Scenario** | Attempt direct GET/PUT/DELETE of Practice A record by Practice B user |
| **Preconditions** | Record ID belonging to Practice A is known |
| **Steps** | 1. Authenticate as Practice B.<br>2. Send GET `/api/patients/{practice_a_patient_id}`.<br>3. Send PUT `/api/prescriptions/{practice_a_rx_id}`.<br>4. Send DELETE `/api/invoices/{practice_a_invoice_id}`. |
| **Expected Result** | All queries enforce `where: { id, practiceId }` returning null, mapped to clean 404 Not Found. |
| **Actual Result** | All requests returned 404 Not Found; zero data leaked and zero modifications permitted. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `TENANT-P0-04` |
| **Module** | Tenant Isolation |
| **Scenario** | Dashboard metrics and counters isolated per tenant |
| **Preconditions** | Practice A has 15 patients and ₹45,000 revenue; Practice B has 2 patients and ₹1,500 revenue |
| **Steps** | 1. Call GET `/api/dashboard/stats` as Practice A.<br>2. Call GET `/api/dashboard/stats` as Practice B. |
| **Expected Result** | Stats reflect only active tenant's aggregate records; no cross-tenant summation. |
| **Actual Result** | Practice A receives 15 patients / ₹45,000; Practice B receives 2 patients / ₹1,500. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

---

### 3. Owner & Patient End-to-End Workflows (Sections 8, 9)

| Field | Details |
| :--- | :--- |
| **Test ID** | `OWNER-E2E-01` |
| **Module** | Owners |
| **Scenario** | Owner creation, search by name/phone, and duplicate phone handling |
| **Preconditions** | Practice context established |
| **Steps** | 1. Create owner "Rajesh Kumar", phone "9847012345", address "Malappuram".<br>2. Search "98470" in Owner search.<br>3. Create another animal with same phone number. |
| **Expected Result** | Owner saved and immediately searchable; duplicate phone prompts reuse of existing owner profile. |
| **Actual Result** | Owner created and indexed; search matches name and phone prefix; existing owner reused. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `PATIENT-E2E-01` |
| **Module** | Patients |
| **Scenario** | Animal creation under owner with species deduplication |
| **Preconditions** | Owner Rajesh Kumar exists |
| **Steps** | 1. Create patient "Bruno", species "Canine", breed "Golden Retriever", weight 28.5 kg.<br>2. Render signalment subtitle using `formatAnimalSubtitle`.<br>3. Check for duplicated species tokens. |
| **Expected Result** | Signalment formatted cleanly as "Bruno • Canine • Golden Retriever • 28.5 kg" with zero species duplication. |
| **Actual Result** | Signalment rendered: "Bruno • Canine • Golden Retriever • 28.5 kg" with zero duplication. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `PATIENT-E2E-02` |
| **Module** | Patients |
| **Scenario** | Age display includes required units (years / months) |
| **Preconditions** | Patients with various DOBs / age notes |
| **Steps** | 1. Format age notes "1y", "6m", and "2 years" using `formatPatientAge`. |
| **Expected Result** | Ages formatted as "1 year", "6 months", "2 years", never raw numbers. |
| **Actual Result** | 1y -> "1 year", 6m -> "6 months", 2 years -> "2 years". |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

---

### 4. Clinical Workflow, Prescriptions & Dosing (Sections 10–14)

| Field | Details |
| :--- | :--- |
| **Test ID** | `RX-CREATE-01` |
| **Module** | Prescriptions |
| **Scenario** | Prescription creation with 1, 2, 3, 5, and 6 medicines (Tests A through E) |
| **Preconditions** | Patient record open in Prescription Builder |
| **Steps** | 1. Test A: 1 medicine.<br>2. Test B: 2 medicines.<br>3. Test C: 3 medicines.<br>4. Test D: 5 medicines.<br>5. Test E: 6 medicines.<br>6. Save, view, and reopen each prescription. |
| **Expected Result** | Prescriptions with 1, 2, 3, 5, and 6 medicines save and reopen with complete data fidelity. |
| **Actual Result** | All 5 test cases persisted with unique IDs, correct item counts, and reopened without error. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `CLIN-AUTO-01` |
| **Module** | Clinical Suggestions |
| **Scenario** | Symptoms and Diagnosis autocomplete allows arbitrary free-text entry |
| **Preconditions** | Prescription Builder open |
| **Steps** | 1. Type recognized term "Anorexia" and select suggestion.<br>2. Type novel symptom "Persistent nocturnal dry cough".<br>3. Save and reload. |
| **Expected Result** | Autocomplete suggests standard clinical terms without blocking or overwriting free-text input. |
| **Actual Result** | Both standard suggestion and novel free-text strings preserved exactly as typed. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `DOSE-CALC-01` |
| **Module** | Dose Calculator |
| **Scenario** | Weight-based dose calculation and compatible unit conversion |
| **Preconditions** | Patient weight 24 kg, dose rate 10 mg/kg |
| **Steps** | 1. Calculate 24 kg × 10 mg/kg via `calculateSmartDose`.<br>2. Convert 240 mg to g via `convertUnits`.<br>3. Attempt invalid conversion (mg to hours). |
| **Expected Result** | 240 mg calculated, 0.24 g converted; incompatible units safely rejected. |
| **Actual Result** | Dose: 240 mg calculated. 240 mg converted to 0.24 g. Incompatible conversion rejected safely. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

---

### 5. Treatment Packages, Rechecks, History & Clone (Sections 15–18)

| Field | Details |
| :--- | :--- |
| **Test ID** | `PKG-INT-01` |
| **Module** | Treatment Packages |
| **Scenario** | Package created from Rx without leaking owner/patient identity |
| **Preconditions** | Prescription with 3 medicines for Bruno |
| **Steps** | 1. Save prescription as Treatment Package "Canine Gastroenteritis".<br>2. Inspect package contents in database/storage.<br>3. Apply package to a new patient prescription. |
| **Expected Result** | Protocol data (medicines, doses, routes, Sig) copied; patient and owner identity completely excluded. |
| **Actual Result** | Package contains pure protocol template; no ownerId, patientId, or identity fields stored. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `FOLLOWUP-01` |
| **Module** | Follow-up |
| **Scenario** | Recheck intervals (None, 3d, 5d, 7d, 14d, Custom) compute and persist |
| **Preconditions** | Prescription Builder open |
| **Steps** | 1. Select "5 days" follow-up.<br>2. Save prescription.<br>3. Inspect document output and reopen in builder. |
| **Expected Result** | Recheck interval persists and prints as "Review in 5 days" with calculated date. |
| **Actual Result** | Interval persisted and displayed correctly in builder and document view. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `RX-HIST-01` |
| **Module** | Prescription History |
| **Scenario** | Multiple prescriptions for same patient remain distinct and editable without collision |
| **Preconditions** | Patient Bruno with 3 prescriptions created on different dates |
| **Steps** | 1. List patient history.<br>2. Open oldest prescription and edit instructions.<br>3. Save.<br>4. Inspect newer prescriptions. |
| **Expected Result** | Prescriptions remain distinct; editing one record does not overwrite or mutate another. |
| **Actual Result** | Prescription records are immutable across distinct IDs; zero cross-record mutation. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `RX-CLONE-01` |
| **Module** | Prescription Clone |
| **Scenario** | Clone prescription creates new entity with copied medicines and fresh ID |
| **Preconditions** | Existing prescription RX-2026-008 |
| **Steps** | 1. Click "Clone Prescription".<br>2. Verify new draft populated with items.<br>3. Save cloned prescription. |
| **Expected Result** | New prescription created with unique ID; original prescription remains untouched. |
| **Actual Result** | New prescription draft created with clean new ID; original RX-2026-008 unchanged. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

---

### 6. Financial Workflows & Directions Integrity (Sections 19–22)

| Field | Details |
| :--- | :--- |
| **Test ID** | `INV-DIR-01` |
| **Module** | Invoice / Receipt Directions |
| **Scenario** | Administration directions / Sig MUST NOT appear in Tax Invoice or Payment Receipt line items |
| **Preconditions** | Prescription imported with medicine containing Sig "Give after food with drinking water. Complete full course." |
| **Steps** | 1. Import prescription into Invoice Builder.<br>2. Render Tax Invoice document.<br>3. Render Payment Receipt document. |
| **Expected Result** | Line item description contains ONLY medicine name and strength/presentation; Sig instructions completely suppressed. |
| **Actual Result** | Line item rendered as "Amoxicillin 250mg". Sig instructions excluded from invoice and receipt. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | `DEF-001` (Fixed) |

| Field | Details |
| :--- | :--- |
| **Test ID** | `INV-CALC-01` |
| **Module** | Invoice Calculations |
| **Scenario** | Multi-category charges, discounts, and currency formatting in INR |
| **Preconditions** | Invoice with Prescription Medicine (₹300), Consultation Fee (₹250), Travel (₹150), Courtesy Discount (₹0) |
| **Steps** | 1. Calculate Subtotal, Discounts, Grand Total in paisa.<br>2. Convert to INR formatted currency.<br>3. Generate words string via `numberToWordsINR`. |
| **Expected Result** | Subtotal: ₹700.00, Grand Total: ₹700.00; Words: "Indian Rupees Seven Hundred Only"; zero rounding drift. |
| **Actual Result** | Subtotal ₹700.00, Grand Total ₹700.00; Words: "Indian Rupees Seven Hundred Only". Exact paisa arithmetic verified. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `RECEIPT-GEN-01` |
| **Module** | Payment Receipt |
| **Scenario** | Dedicated Payment Receipt layout with receipt number and invoice cross-reference |
| **Preconditions** | Finalized Tax Invoice INV-2026-015 |
| **Steps** | 1. Generate Payment Receipt.<br>2. Verify receipt number, invoice reference, payment mode, and total.<br>3. Verify receipt semantic identity. |
| **Expected Result** | Dedicated payment voucher format; references original invoice; excludes statutory GST/tax breakdown columns. |
| **Actual Result** | Receipt generated as dedicated voucher; cross-references INV-2026-015; distinct semantic identity verified. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

---

### 7. PDF Parity, Layout & Pagination (Sections 23–27)

| Field | Details |
| :--- | :--- |
| **Test ID** | `PDF-PARITY-01` |
| **Module** | PDF Generation |
| **Scenario** | Print PDF vs Save PDF exact data parity on identical record |
| **Preconditions** | Prescription RX-2026-042, Invoice INV-2026-015, Receipt REC-2026-015 |
| **Steps** | 1. Print document via browser print dialog.<br>2. Save PDF via Save PDF button.<br>3. Compare patient signalment, doctor info, items, doses, directions, and totals. |
| **Expected Result** | 100% data parity between Print PDF and Save PDF; zero discrepancy in clinical or financial figures. |
| **Actual Result** | Print PDF and Save PDF contain identical text, items, quantities, doses, and totals. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `PDF-PAGE-01` |
| **Module** | PDF Pagination |
| **Scenario** | Prescriptions with 1 to 6 medicines fit onto single A4 sheet without blank pages |
| **Preconditions** | Prescriptions generated with 1, 2, 3, 5, and 6 medicines |
| **Steps** | 1. Render each prescription under print styling.<br>2. Inspect page break behavior and total page count.<br>3. Check signature block positioning. |
| **Expected Result** | Standard prescriptions fit cleanly onto 1 A4 page; zero trailing blank pages; signature block never orphaned. |
| **Actual Result** | Prescriptions with 1 to 6 medicines fit on 1 page with no split signatures or trailing blank pages. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

---

### 8. Navigation, Sidebar & Responsive Tests (Sections 28–30)

| Field | Details |
| :--- | :--- |
| **Test ID** | `UI-NAV-01` |
| **Module** | Navigation |
| **Scenario** | Seamless navigation across Dashboard, Patients, Prescriptions, Packages, Invoices, Settings |
| **Preconditions** | Logged in practice user |
| **Steps** | 1. Navigate to Patients -> Prescriptions -> Invoices -> Settings -> Dashboard.<br>2. Use browser back and forward buttons.<br>3. Hard refresh on `/patients` and `/invoices`. |
| **Expected Result** | Smooth SPA transitions; back/forward navigation preserves route; refresh maintains authentication context. |
| **Actual Result** | Navigation smooth; back/forward works accurately; refresh preserves full session context. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `SIDEBAR-01` |
| **Module** | Sidebar Layout |
| **Scenario** | Desktop sidebar remains sticky and stable during deep page scroll |
| **Preconditions** | Desktop viewport (1280px+), long scrollable list (e.g. 50 patients) |
| **Steps** | 1. Scroll page content to bottom.<br>2. Observe sidebar top offset, position, and navigation links. |
| **Expected Result** | Sidebar remains anchored at viewport top without jumping, clipping, or overlapping content. |
| **Actual Result** | Sidebar remains sticky with zero displacement; all links clickable. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `RESP-01` |
| **Module** | Responsive Design |
| **Scenario** | Verification across 320px, 375px, 390px, 768px, 1024px, 1280px, 1440px viewports |
| **Preconditions** | Chromium automated responsive harness |
| **Steps** | 1. Emulate viewports from 320px to 1440px.<br>2. Check for horizontal document scroll (`scrollWidth > clientWidth`).<br>3. Inspect patient cards, search bar, modals, and tables. |
| **Expected Result** | Zero unintended horizontal overflow; touch targets >= 44px; symmetrical margins preserved. |
| **Actual Result** | 0px horizontal overflow across all viewports; patient card `#CAN-8801` and `5 kg` badges fit on 360px without clipping. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

---

### 9. Persistence & Concurrent Sessions (Sections 32, 33)

| Field | Details |
| :--- | :--- |
| **Test ID** | `PERSIST-01` |
| **Module** | Data Persistence |
| **Scenario** | Create -> Save -> Refresh -> Logout -> Login -> Reopen across all primary entities |
| **Preconditions** | New practice session |
| **Steps** | 1. Create owner, patient, prescription, package, invoice.<br>2. Perform hard refresh.<br>3. Log out.<br>4. Log in and reopen all entities. |
| **Expected Result** | 100% data retention across browser refresh and re-authentication cycles. |
| **Actual Result** | All records persisted with zero data loss or field truncation. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

| Field | Details |
| :--- | :--- |
| **Test ID** | `MULTITAB-01` |
| **Module** | Concurrent Sessions |
| **Scenario** | Multi-tab operation within same practice session |
| **Preconditions** | Practice session open in Tab 1 and Tab 2 |
| **Steps** | 1. In Tab 1, update a patient's weight.<br>2. In Tab 2, navigate to prescription builder for that patient.<br>3. In Tab 1, trigger logout. Refresh Tab 2. |
| **Expected Result** | Updated patient weight reflects in Tab 2; logout in Tab 1 invalidates Tab 2 session upon subsequent request. |
| **Actual Result** | Dexie reactivity synchronizes local state; server rejects Tab 2 with 401 once session invalidated. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |

---

### 10. Live Production Smoke Validation (Section 39)

| Field | Details |
| :--- | :--- |
| **Test ID** | `PROD-SMOKE-01` |
| **Module** | Production Smoke |
| **Scenario** | Live production domain accessibility and SSL status |
| **Preconditions** | Production endpoint: `https://vetrx.adcpmalappuram.in` |
| **Steps** | 1. Query `GET https://vetrx.adcpmalappuram.in/`.<br>2. Check HTTP response status code and headers.<br>3. Verify SSL certificate validity. |
| **Expected Result** | HTTP 200 OK returned over secure TLS connection. |
| **Actual Result** | Responded with HTTP 200 OK over valid Let's Encrypt TLS certificate. |
| **Status** | **PASS** |
| **Severity** | — |
| **Defect Reference** | — |
