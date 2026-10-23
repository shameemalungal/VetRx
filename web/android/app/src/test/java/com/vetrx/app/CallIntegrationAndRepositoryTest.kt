package com.vetrx.app

import com.vetrx.app.call.ActiveCallSession
import com.vetrx.app.call.ActiveCallStatus
import com.vetrx.app.data.models.*
import com.vetrx.app.data.repository.VetRxRepository
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

// ==============================================================================
// VetRx Native Android — Unit Test Suite
// Verifies Smart Call Integration, Deduplication, Sync State & Clinical Entities
// ==============================================================================

class CallIntegrationAndRepositoryTest {

    @Test
    fun testCallDeduplication_preventsDuplicateRecords() {
        val uniqueEventId = "evt-test-" + UUID.randomUUID().toString()
        val call1 = CallRecord(
            callerPhone = "+91 98765 43210",
            ownerName = "Ahmed Kumar",
            patientName = "Bruno",
            symptoms = "Test ear scratching",
            callEventId = uniqueEventId,
            callDurationSeconds = 120
        )

        // First registration
        val registered1 = VetRxRepository.registerCall(call1)
        assertTrue(registered1.isRegistered)
        assertTrue(VetRxRepository.isCallEventProcessed(uniqueEventId))

        // Duplicate registration attempt with identical callEventId
        val call2 = CallRecord(
            callerPhone = "+91 98765 43210",
            ownerName = "Ahmed Kumar",
            patientName = "Bruno",
            symptoms = "Duplicate attempt",
            callEventId = uniqueEventId,
            callDurationSeconds = 120
        )
        val registered2 = VetRxRepository.registerCall(call2)

        // Must return identical original record ID
        assertEquals(registered1.id, registered2.id)
    }

    @Test
    fun testCallDurationCalculation_andStatusMapping() {
        val start = System.currentTimeMillis()
        val connected = start + 5000 // Connected after 5s
        val ended = connected + 145000 // Ended after 145s (2m 25s)

        val duration = ((ended - connected) / 1000).toInt()
        assertEquals(145, duration)

        val session = ActiveCallSession(
            phoneNumber = "+91 98450 11223",
            ownerName = "Priya Nair",
            patientName = "Milo",
            direction = CallDirection.OUTGOING,
            status = ActiveCallStatus.DISCONNECTED,
            initiatedTimestamp = start,
            connectedTimestamp = connected,
            endedTimestamp = ended,
            durationSeconds = duration
        )

        assertEquals(145, session.durationSeconds)
        assertEquals(ActiveCallStatus.DISCONNECTED, session.status)
        assertEquals(CallDirection.OUTGOING, session.direction)
    }

    @Test
    fun testUnknownPhoneNumber_preservesRawNumberWithoutFabrication() {
        val unknownNumber = "+91 91234 56789"
        val matchedOwner = VetRxRepository.findOwnerByPhone(unknownNumber)
        assertNull("Unknown phone number must not match existing owners", matchedOwner)

        val unlinkedCall = CallRecord(
            callerPhone = unknownNumber,
            ownerId = null,
            ownerName = null,
            patientId = null,
            patientName = null,
            species = "Canine",
            symptoms = "Caller reports stray animal injured on highway",
            callEventId = UUID.randomUUID().toString()
        )

        val saved = VetRxRepository.registerCall(unlinkedCall)
        assertEquals(unknownNumber, saved.callerPhone)
        assertNull(saved.ownerId)
        assertNull(saved.ownerName)
    }

    @Test
    fun testKnownOwnerLookup_matchesCleanPhoneNumbers() {
        val owner = VetRxRepository.findOwnerByPhone("9876543210")
        assertNotNull("Should find owner Ahmed Kumar", owner)
        assertEquals("Ahmed Kumar", owner?.name)
    }

    @Test
    fun testPrescriptionCreation_preservesMedicinesAndRxNumber() {
        val rx = Prescription(
            rxNumber = "RX-2026-9999",
            patientId = "pat-001",
            patientName = "Bruno",
            species = "Canine",
            breed = "Labrador",
            weightKg = 24.0,
            ownerName = "Ahmed Kumar",
            symptoms = "Acute Otitis",
            diagnosis = "Otitis Externa",
            items = listOf(
                PrescriptionItem(
                    medicineName = "Posatex Otic Drops",
                    dosage = "4 drops",
                    route = "Otic",
                    frequency = "SID",
                    durationDays = 7,
                    quantity = 1,
                    instructions = "Clean ear first"
                )
            ),
            advice = "Keep dry"
        )

        val saved = VetRxRepository.createPrescription(rx)
        assertEquals("RX-2026-9999", saved.rxNumber)
        assertEquals(1, saved.items.size)
        assertEquals("Posatex Otic Drops", saved.items[0].medicineName)
    }

    @Test
    fun testInvoiceCalculation_computesTotalsAccuratelyInINR() {
        val items = listOf(
            InvoiceLineItem("Consultation", InvoiceCategory.CONSULTATION, 1, 500.0),
            InvoiceLineItem("Medicine A", InvoiceCategory.MEDICINE, 2, 250.0),
            InvoiceLineItem("Travel Charge", InvoiceCategory.TRAVEL, 1, 300.0)
        )

        val subtotal = items.sumOf { it.amount }
        assertEquals(1300.0, subtotal, 0.001)

        val inv = Invoice(
            invoiceNumber = "INV-2026-99999",
            patientName = "Bruno",
            ownerName = "Ahmed Kumar",
            items = items,
            subtotal = subtotal,
            tax = 0.0,
            total = subtotal
        )

        assertEquals(1300.0, inv.total, 0.001)
        assertEquals(InvoiceStatus.Issued, inv.status)
    }
}
