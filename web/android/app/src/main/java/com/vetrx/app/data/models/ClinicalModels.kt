package com.vetrx.app.data.models

import java.util.UUID

// ==============================================================================
// VetRx Domain Models — Clinical & Call Entities
// ==============================================================================

enum class CallPriority {
    EMERGENCY,
    URGENT,
    COULD_NOT_ASSESS,
    PLANNED
}

enum class VisitFlexibility {
    MUST_ATTEND_TODAY,
    CAN_POSTPONE_TODAY,
    PREFERRED_TODAY,
    SPECIFIC_DATE
}

enum class CallStatus {
    LOGGED,
    SCHEDULED,
    CANCELLED
}

enum class CallDirection {
    OUTGOING,
    INCOMING,
    UNKNOWN
}

enum class SyncState {
    SYNCED,
    SYNCING,
    LOCAL_PENDING,
    FAILED
}

data class CallRecord(
    val id: String = UUID.randomUUID().toString(),
    val callerPhone: String,
    val ownerId: String? = null,
    val ownerName: String? = null,
    val patientId: String? = null,
    val patientName: String? = null,
    val species: String = "Canine",
    val animalCount: Int = 1,
    val symptoms: String = "",
    val tentativeAssessment: String? = null,
    val priority: CallPriority = CallPriority.PLANNED,
    val flexibility: VisitFlexibility = VisitFlexibility.MUST_ATTEND_TODAY,
    val preferredDate: String? = null,
    val locationAddress: String? = null,
    val status: CallStatus = CallStatus.LOGGED,
    val notes: String? = null,
    val callEventId: String = UUID.randomUUID().toString(),
    val callDurationSeconds: Int = 0,
    val direction: CallDirection = CallDirection.OUTGOING,
    val isRegistered: Boolean = true,
    val syncStatus: SyncState = SyncState.LOCAL_PENDING,
    val createdAt: Long = System.currentTimeMillis()
)

data class Owner(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val phone: String,
    val email: String? = null,
    val address: String? = null,
    val patientCount: Int = 1
)

data class Patient(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val species: String, // Canine, Feline, Bovine, Equine, Caprine, Ovine, Other
    val breed: String,
    val gender: String, // M, F, MN, FS
    val ageYears: String,
    val weightKg: Double,
    val ownerId: String,
    val ownerName: String,
    val ownerPhone: String,
    val status: String = "Active"
)

data class PrescriptionItem(
    val id: String = UUID.randomUUID().toString(),
    val medicineName: String,
    val dosage: String,
    val route: String = "PO", // PO, SC, IM, IV, Topical, Otic
    val frequency: String = "BID", // SID, BID, TID, QID, PRN, q12h
    val durationDays: Int = 5,
    val quantity: Int = 10,
    val instructions: String = "Give after food."
)

data class Prescription(
    val id: String = UUID.randomUUID().toString(),
    val rxNumber: String,
    val patientId: String,
    val patientName: String,
    val species: String,
    val breed: String,
    val weightKg: Double,
    val ownerName: String,
    val symptoms: String,
    val diagnosis: String,
    val items: List<PrescriptionItem> = emptyList(),
    val advice: String = "",
    val followUpDays: String = "7d",
    val status: String = "Issued", // Draft, Issued
    val syncStatus: SyncState = SyncState.SYNCED,
    val createdAt: Long = System.currentTimeMillis()
)

data class TreatmentPackage(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val species: String,
    val diagnosis: String,
    val description: String,
    val items: List<PrescriptionItem> = emptyList()
)

enum class InvoiceCategory {
    MEDICINE,
    CONSULTATION,
    PROCEDURE,
    LABORATORY,
    TRAVEL,
    OTHER
}

data class InvoiceLineItem(
    val description: String,
    val category: InvoiceCategory,
    val quantity: Int,
    val unitPrice: Double,
    val amount: Double = quantity * unitPrice
)

enum class InvoiceStatus {
    Issued,
    Paid,
    Draft
}

data class Invoice(
    val id: String = UUID.randomUUID().toString(),
    val invoiceNumber: String,
    val rxNumber: String? = null,
    val patientName: String,
    val ownerName: String,
    val ownerPhone: String = "",
    val status: InvoiceStatus = InvoiceStatus.Issued,
    val items: List<InvoiceLineItem> = emptyList(),
    val subtotal: Double,
    val tax: Double = 0.0,
    val total: Double = subtotal + tax,
    val paidAmount: Double = total,
    val syncStatus: SyncState = SyncState.SYNCED,
    val createdAt: Long = System.currentTimeMillis()
)

data class InventoryItem(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val category: String,
    val stockOnHand: Int,
    val unit: String,
    val reorderLevel: Int,
    val unitPrice: Double,
    val batchNumber: String,
    val expiryDate: String
)

data class SyncStatusInfo(
    val state: SyncState = SyncState.SYNCED,
    val lastSyncedAt: Long? = System.currentTimeMillis(),
    val lastError: String? = null,
    val pendingCount: Int = 0,
    val isOnline: Boolean = true
)
