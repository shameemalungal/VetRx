package com.vetrx.app.data.repository

import com.vetrx.app.data.models.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

// ==============================================================================
// VetRx Central Repository & Data Layer
// Manages local state, offline persistence, deduplication, and synchronization
// ==============================================================================

object VetRxRepository {

    private val repositoryScope = CoroutineScope(Dispatchers.IO)

    // Deduplication registry for detected phone calls
    private val processedCallEvents = mutableSetOf<String>()

    // Reactive StateFlows
    private val _calls = MutableStateFlow<List<CallRecord>>(emptyList())
    val calls: StateFlow<List<CallRecord>> = _calls.asStateFlow()

    private val _owners = MutableStateFlow<List<Owner>>(emptyList())
    val owners: StateFlow<List<Owner>> = _owners.asStateFlow()

    private val _patients = MutableStateFlow<List<Patient>>(emptyList())
    val patients: StateFlow<List<Patient>> = _patients.asStateFlow()

    private val _prescriptions = MutableStateFlow<List<Prescription>>(emptyList())
    val prescriptions: StateFlow<List<Prescription>> = _prescriptions.asStateFlow()

    private val _treatmentPackages = MutableStateFlow<List<TreatmentPackage>>(emptyList())
    val treatmentPackages: StateFlow<List<TreatmentPackage>> = _treatmentPackages.asStateFlow()

    private val _invoices = MutableStateFlow<List<Invoice>>(emptyList())
    val invoices: StateFlow<List<Invoice>> = _invoices.asStateFlow()

    private val _inventory = MutableStateFlow<List<InventoryItem>>(emptyList())
    val inventory: StateFlow<List<InventoryItem>> = _inventory.asStateFlow()

    private val _syncStatus = MutableStateFlow(
        SyncStatusInfo(
            state = SyncState.SYNCED,
            lastSyncedAt = System.currentTimeMillis(),
            lastError = null,
            pendingCount = 0,
            isOnline = true
        )
    )
    val syncStatus: StateFlow<SyncStatusInfo> = _syncStatus.asStateFlow()

    init {
        seedInitialClinicalData()
    }

    private fun seedInitialClinicalData() {
        val o1 = Owner(
            id = "own-001",
            name = "Ahmed Kumar",
            phone = "+91 98765 43210",
            email = "ahmed.kumar@gmail.com",
            address = "Sector 14, Oakwood Road, Bangalore",
            patientCount = 1
        )
        val o2 = Owner(
            id = "own-002",
            name = "Priya Nair",
            phone = "+91 98450 11223",
            email = "priya.nair@hotmail.com",
            address = "Koramangala 4th Block, Bangalore",
            patientCount = 1
        )
        val o3 = Owner(
            id = "own-003",
            name = "Rahul Menon",
            phone = "+91 97412 88990",
            email = "rahul.m@outlook.com",
            address = "Indiranagar 100ft Road, Bangalore",
            patientCount = 1
        )
        val o4 = Owner(
            id = "own-004",
            name = "Suresh Patel",
            phone = "+91 99887 66554",
            email = "suresh.patel@farm.in",
            address = "Doddaballapur Dairy Cluster, Karnataka",
            patientCount = 2
        )
        _owners.value = listOf(o1, o2, o3, o4)

        val p1 = Patient(
            id = "pat-001",
            name = "Bruno",
            species = "Canine",
            breed = "Labrador Retriever",
            gender = "M",
            ageYears = "4y",
            weightKg = 24.0,
            ownerId = o1.id,
            ownerName = o1.name,
            ownerPhone = o1.phone,
            status = "Active"
        )
        val p2 = Patient(
            id = "pat-002",
            name = "Milo",
            species = "Feline",
            breed = "Domestic Shorthair",
            gender = "MN",
            ageYears = "2y",
            weightKg = 4.2,
            ownerId = o2.id,
            ownerName = o2.name,
            ownerPhone = o2.phone,
            status = "Active"
        )
        val p3 = Patient(
            id = "pat-003",
            name = "Luna",
            species = "Canine",
            breed = "Golden Retriever",
            gender = "FS",
            ageYears = "3y",
            weightKg = 28.5,
            ownerId = o3.id,
            ownerName = o3.name,
            ownerPhone = o3.phone,
            status = "Active"
        )
        val p4 = Patient(
            id = "pat-004",
            name = "Ganga (Tag #402)",
            species = "Bovine",
            breed = "Holstein Friesian Cross",
            gender = "F",
            ageYears = "5y",
            weightKg = 420.0,
            ownerId = o4.id,
            ownerName = o4.name,
            ownerPhone = o4.phone,
            status = "Active"
        )
        _patients.value = listOf(p1, p2, p3, p4)

        // Initial Seed Treatment Packages
        val tp1 = TreatmentPackage(
            id = "pkg-001",
            name = "Canine Acute Otitis Externa",
            species = "Canine",
            diagnosis = "Acute Otitis Externa",
            description = "Standard 7-day topical antimicrobial + systemic NSAID protocol",
            items = listOf(
                PrescriptionItem(
                    medicineName = "Posatex Otic Drops 15ml",
                    dosage = "4 drops",
                    route = "Otic (Right Ear)",
                    frequency = "SID",
                    durationDays = 7,
                    quantity = 1,
                    instructions = "Clean ear canal 15m before applying."
                ),
                PrescriptionItem(
                    medicineName = "Amoxycillin 500 mg",
                    dosage = "1 tablet",
                    route = "PO",
                    frequency = "BID",
                    durationDays = 5,
                    quantity = 10,
                    instructions = "Give after food."
                )
            )
        )
        val tp2 = TreatmentPackage(
            id = "pkg-002",
            name = "Feline Upper Respiratory Protocol",
            species = "Feline",
            diagnosis = "Feline Viral Rhinotracheitis (FHV-1)",
            description = "Broad-spectrum coverage with antiviral and mucosal support",
            items = listOf(
                PrescriptionItem(
                    medicineName = "Doxycycline Syrup 50mg/5ml",
                    dosage = "2.5 ml",
                    route = "PO",
                    frequency = "SID",
                    durationDays = 10,
                    quantity = 1,
                    instructions = "Follow with 5ml fresh water to prevent esophageal ulceration."
                ),
                PrescriptionItem(
                    medicineName = "L-Lysine Chews 500mg",
                    dosage = "1 chew",
                    route = "PO",
                    frequency = "BID",
                    durationDays = 14,
                    quantity = 28,
                    instructions = "Offer as treat before meal."
                )
            )
        )
        val tp3 = TreatmentPackage(
            id = "pkg-003",
            name = "Bovine Acute Mastitis Care",
            species = "Bovine",
            diagnosis = "Clinical Mastitis (Right Quarter)",
            description = "Intramammary antibiotic infusion + systemic anti-inflammatory",
            items = listOf(
                PrescriptionItem(
                    medicineName = "Cefquinome Intramammary Syringe 75mg",
                    dosage = "1 syringe",
                    route = "Intramammary",
                    frequency = "q12h",
                    durationDays = 3,
                    quantity = 3,
                    instructions = "Strip quarter completely before sterile infusion."
                ),
                PrescriptionItem(
                    medicineName = "Meloxicam 20mg/ml Injection",
                    dosage = "15 ml",
                    route = "IM",
                    frequency = "SID",
                    durationDays = 2,
                    quantity = 1,
                    instructions = "Deep intramuscular administration."
                )
            )
        )
        _treatmentPackages.value = listOf(tp1, tp2, tp3)

        // Seed Prescriptions (Matching Stitch mocks)
        val rx1 = Prescription(
            id = "rx-001",
            rxNumber = "RX-2026-0892",
            patientId = p1.id,
            patientName = p1.name,
            species = p1.species,
            breed = p1.breed,
            weightKg = p1.weightKg,
            ownerName = o1.name,
            symptoms = "Scratching right ear, shaking head vigorously, thick brown waxy discharge.",
            diagnosis = "Canine Acute Otitis Externa",
            items = tp1.items,
            advice = "Keep ear canal completely dry during bath. Use e-collar if scratching head continues tonight.",
            followUpDays = "7d",
            status = "Issued"
        )
        val rx2 = Prescription(
            id = "rx-002",
            rxNumber = "RX-2026-0891",
            patientId = p2.id,
            patientName = p2.name,
            species = p2.species,
            breed = p2.breed,
            weightKg = p2.weightKg,
            ownerName = o2.name,
            symptoms = "Sneezing, bilateral serous ocular discharge, mild fever.",
            diagnosis = "Feline Upper Respiratory Infection",
            items = tp2.items,
            advice = "Encourage warm wet food to stimulate appetite. Steam bathroom sessions 10 mins twice daily.",
            followUpDays = "5d",
            status = "Issued"
        )
        val rx3 = Prescription(
            id = "rx-003",
            rxNumber = "RX-2026-0890",
            patientId = p3.id,
            patientName = p3.name,
            species = p3.species,
            breed = p3.breed,
            weightKg = p3.weightKg,
            ownerName = o3.name,
            symptoms = "Routine annual physical examination and core vaccination booster.",
            diagnosis = "Healthy Canine — Routine Wellness",
            items = listOf(
                PrescriptionItem(
                    medicineName = "Nobivac DHPPi + L4 Vaccine",
                    dosage = "1 ml",
                    route = "SC",
                    frequency = "Once",
                    durationDays = 1,
                    quantity = 1,
                    instructions = "Administer subcutaneously in scruff."
                )
            ),
            advice = "Monitor for mild lethargy over 24-48 hours. Next booster due in 12 months.",
            followUpDays = "14d",
            status = "Issued"
        )
        _prescriptions.value = listOf(rx1, rx2, rx3)

        // Seed Invoices (Matching Stitch mocks with INR currency)
        val inv1 = Invoice(
            id = "inv-001",
            invoiceNumber = "INV-2026-00125",
            rxNumber = rx1.rxNumber,
            patientName = p1.name,
            ownerName = o1.name,
            ownerPhone = o1.phone,
            status = InvoiceStatus.Issued,
            items = listOf(
                InvoiceLineItem("Consultation & Otoscopic Exam", InvoiceCategory.CONSULTATION, 1, 500.0),
                InvoiceLineItem("Posatex Otic Drops 15ml", InvoiceCategory.MEDICINE, 1, 750.0),
                InvoiceLineItem("Amoxycillin 500mg (10 tabs)", InvoiceCategory.MEDICINE, 1, 350.0)
            ),
            subtotal = 1600.0,
            tax = 0.0,
            total = 1600.0,
            paidAmount = 1600.0
        )
        val inv2 = Invoice(
            id = "inv-002",
            invoiceNumber = "INV-2026-00124",
            rxNumber = rx2.rxNumber,
            patientName = p2.name,
            ownerName = o2.name,
            ownerPhone = o2.phone,
            status = InvoiceStatus.Issued,
            items = listOf(
                InvoiceLineItem("Feline Clinical Consultation", InvoiceCategory.CONSULTATION, 1, 450.0),
                InvoiceLineItem("Doxycycline Syrup 50mg/5ml", InvoiceCategory.MEDICINE, 1, 220.0),
                InvoiceLineItem("L-Lysine Chews", InvoiceCategory.MEDICINE, 1, 180.0)
            ),
            subtotal = 850.0,
            tax = 0.0,
            total = 850.0,
            paidAmount = 850.0
        )
        _invoices.value = listOf(inv1, inv2)

        // Seed Calls & Visits
        val c1 = CallRecord(
            id = "call-001",
            callerPhone = o1.phone,
            ownerId = o1.id,
            ownerName = o1.name,
            patientId = p1.id,
            patientName = p1.name,
            species = p1.species,
            animalCount = 1,
            symptoms = "Ear scratching and head shaking since morning.",
            tentativeAssessment = "Otitis Externa",
            priority = CallPriority.URGENT,
            flexibility = VisitFlexibility.MUST_ATTEND_TODAY,
            status = CallStatus.SCHEDULED,
            callEventId = "evt-seed-1",
            callDurationSeconds = 145,
            direction = CallDirection.OUTGOING,
            isRegistered = true,
            syncStatus = SyncState.SYNCED
        )
        val c2 = CallRecord(
            id = "call-002",
            callerPhone = o4.phone,
            ownerId = o4.id,
            ownerName = o4.name,
            patientId = p4.id,
            patientName = p4.name,
            species = p4.species,
            animalCount = 1,
            symptoms = "Cow has swollen right quarter, drops in milk yield, slight fever.",
            tentativeAssessment = "Acute Mastitis",
            priority = CallPriority.EMERGENCY,
            flexibility = VisitFlexibility.MUST_ATTEND_TODAY,
            status = CallStatus.LOGGED,
            callEventId = "evt-seed-2",
            callDurationSeconds = 190,
            direction = CallDirection.INCOMING,
            isRegistered = true,
            syncStatus = SyncState.SYNCED
        )
        _calls.value = listOf(c1, c2)
        processedCallEvents.add("evt-seed-1")
        processedCallEvents.add("evt-seed-2")

        // Seed Inventory
        _inventory.value = listOf(
            InventoryItem(
                id = "inv-item-1",
                name = "Amoxycillin 500mg",
                category = "Antibiotic",
                stockOnHand = 320,
                unit = "tablets",
                reorderLevel = 100,
                unitPrice = 35.0,
                batchNumber = "AMX-2026-A",
                expiryDate = "2027-11"
            ),
            InventoryItem(
                id = "inv-item-2",
                name = "Posatex Otic Drops 15ml",
                category = "Otic Suspension",
                stockOnHand = 14,
                unit = "bottles",
                reorderLevel = 10,
                unitPrice = 750.0,
                batchNumber = "PST-2026-B",
                expiryDate = "2027-08"
            ),
            InventoryItem(
                id = "inv-item-3",
                name = "Meloxicam 20mg/ml (100ml)",
                category = "NSAID",
                stockOnHand = 8,
                unit = "vials",
                reorderLevel = 15,
                unitPrice = 420.0,
                batchNumber = "MLX-2026-D",
                expiryDate = "2028-02"
            )
        )
    }

    /**
     * Registers a phone call, enforcing deduplication via unique callEventId.
     */
    fun registerCall(callRecord: CallRecord): CallRecord {
        synchronized(processedCallEvents) {
            if (processedCallEvents.contains(callRecord.callEventId)) {
                // Already registered; return existing to prevent duplicate database rows
                val existing = _calls.value.firstOrNull { it.callEventId == callRecord.callEventId }
                if (existing != null) return existing
            }
            processedCallEvents.add(callRecord.callEventId)
        }

        val updatedRecord = callRecord.copy(
            isRegistered = true,
            syncStatus = SyncState.LOCAL_PENDING
        )

        _calls.value = listOf(updatedRecord) + _calls.value

        // Update sync state to indicate pending local record
        val currentPending = _syncStatus.value.pendingCount + 1
        _syncStatus.value = _syncStatus.value.copy(
            state = SyncState.LOCAL_PENDING,
            pendingCount = currentPending
        )

        // Asynchronously synchronize with backend
        triggerBackgroundSync()

        return updatedRecord
    }

    fun isCallEventProcessed(callEventId: String): Boolean {
        synchronized(processedCallEvents) {
            return processedCallEvents.contains(callEventId)
        }
    }

    fun addOwner(owner: Owner) {
        _owners.value = listOf(owner) + _owners.value
        triggerBackgroundSync()
    }

    fun addPatient(patient: Patient) {
        _patients.value = listOf(patient) + _patients.value
        triggerBackgroundSync()
    }

    fun createPrescription(prescription: Prescription): Prescription {
        _prescriptions.value = listOf(prescription) + _prescriptions.value
        triggerBackgroundSync()
        return prescription
    }

    fun createInvoice(invoice: Invoice): Invoice {
        _invoices.value = listOf(invoice) + _invoices.value
        triggerBackgroundSync()
        return invoice
    }

    fun findOwnerByPhone(phone: String): Owner? {
        val clean = phone.replace(Regex("[^0-9]"), "")
        return _owners.value.firstOrNull {
            it.phone.replace(Regex("[^0-9]"), "").endsWith(clean.takeLast(10))
        }
    }

    fun findPatientsByOwnerId(ownerId: String): List<Patient> {
        return _patients.value.filter { it.ownerId == ownerId }
    }

    fun triggerBackgroundSync() {
        repositoryScope.launch {
            _syncStatus.value = _syncStatus.value.copy(state = SyncState.SYNCING)
            try {
                // Simulate network latency & verify connectivity
                kotlinx.coroutines.delay(800)

                // Mark local pending records as synced
                _calls.value = _calls.value.map {
                    if (it.syncStatus == SyncState.LOCAL_PENDING) it.copy(syncStatus = SyncState.SYNCED) else it
                }
                _prescriptions.value = _prescriptions.value.map {
                    if (it.syncStatus == SyncState.LOCAL_PENDING) it.copy(syncStatus = SyncState.SYNCED) else it
                }
                _invoices.value = _invoices.value.map {
                    if (it.syncStatus == SyncState.LOCAL_PENDING) it.copy(syncStatus = SyncState.SYNCED) else it
                }

                _syncStatus.value = SyncStatusInfo(
                    state = SyncState.SYNCED,
                    lastSyncedAt = System.currentTimeMillis(),
                    lastError = null,
                    pendingCount = 0,
                    isOnline = true
                )
            } catch (e: Exception) {
                _syncStatus.value = SyncStatusInfo(
                    state = SyncState.FAILED,
                    lastSyncedAt = _syncStatus.value.lastSyncedAt,
                    lastError = e.message ?: "Network synchronisation failed",
                    pendingCount = 1,
                    isOnline = false
                )
            }
        }
    }
}
