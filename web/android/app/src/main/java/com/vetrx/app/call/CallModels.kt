package com.vetrx.app.call

import com.vetrx.app.data.models.CallDirection
import java.util.UUID

// ==============================================================================
// Smart Call Integration — Session & Lifecycle Data Models
// ==============================================================================

enum class ActiveCallStatus {
    IDLE,
    DIALING,
    CONNECTED,
    DISCONNECTED,
    CANCELLED,
    MISSED
}

data class ActiveCallSession(
    val callEventId: String = UUID.randomUUID().toString(),
    val phoneNumber: String,
    val ownerId: String? = null,
    val ownerName: String? = null,
    val patientId: String? = null,
    val patientName: String? = null,
    val species: String = "Canine",
    val direction: CallDirection = CallDirection.OUTGOING,
    val status: ActiveCallStatus = ActiveCallStatus.IDLE,
    val initiatedTimestamp: Long = System.currentTimeMillis(),
    val connectedTimestamp: Long? = null,
    val endedTimestamp: Long? = null,
    val durationSeconds: Int = 0,
    val requiresRegistrationPrompt: Boolean = false
)
