package com.vetrx.app.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import com.vetrx.app.VetRxNativePlugin
import com.vetrx.app.data.models.CallDirection
import com.vetrx.app.data.repository.VetRxRepository
import java.util.UUID

// ==============================================================================
// Smart Call Integration — Broadcast Receiver for System Calls
// Handles Telephony State Transitions, Missed/Answered Calls, and Prompts
// ==============================================================================

class CallStateReceiver : BroadcastReceiver() {

    companion object {
        private var lastState = TelephonyManager.CALL_STATE_IDLE
        private var incomingNumber: String? = null
        private var callStartTime: Long = 0
        private var isIncoming = false
        private var lastProcessedEventTime: Long = 0
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return

        val stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)

        val state = when (stateStr) {
            TelephonyManager.EXTRA_STATE_IDLE -> TelephonyManager.CALL_STATE_IDLE
            TelephonyManager.EXTRA_STATE_OFFHOOK -> TelephonyManager.CALL_STATE_OFFHOOK
            TelephonyManager.EXTRA_STATE_RINGING -> TelephonyManager.CALL_STATE_RINGING
            else -> TelephonyManager.CALL_STATE_IDLE
        }

        // Delegate to active in-app session if one exists
        if (CallLifecycleManager.activeSession.value != null) {
            CallLifecycleManager.handleTelephonyState(context, state)
            lastState = state
            return
        }

        when (state) {
            TelephonyManager.CALL_STATE_RINGING -> {
                isIncoming = true
                if (!number.isNullOrBlank()) {
                    incomingNumber = number
                }
            }
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                if (lastState != TelephonyManager.CALL_STATE_RINGING) {
                    isIncoming = false
                    if (!number.isNullOrBlank()) {
                        incomingNumber = number
                    }
                }
                callStartTime = System.currentTimeMillis()
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                val now = System.currentTimeMillis()
                // Deduplicate call state events arriving within 1.5 seconds of each other
                if (now - lastProcessedEventTime > 1500) {
                    val isAnswered = lastState == TelephonyManager.CALL_STATE_OFFHOOK
                    val isMissed = lastState == TelephonyManager.CALL_STATE_RINGING

                    if (isAnswered || isMissed) {
                        val durationSec = if (isAnswered && callStartTime > 0) {
                            ((now - callStartTime) / 1000).toInt()
                        } else {
                            0
                        }

                        val phone = incomingNumber ?: "Unknown Contact"
                        val matchedOwner = if (phone != "Unknown Contact") {
                            VetRxRepository.findOwnerByPhone(phone)
                        } else null

                        val matchedPatient = matchedOwner?.let {
                            VetRxRepository.findPatientsByOwnerId(it.id).firstOrNull()
                        }

                        val session = ActiveCallSession(
                            callEventId = UUID.randomUUID().toString(),
                            phoneNumber = phone,
                            ownerId = matchedOwner?.id,
                            ownerName = matchedOwner?.name,
                            patientId = matchedPatient?.id,
                            patientName = matchedPatient?.name,
                            species = matchedPatient?.species ?: "Canine",
                            direction = if (isIncoming) CallDirection.INCOMING else CallDirection.OUTGOING,
                            status = if (isMissed) ActiveCallStatus.MISSED else ActiveCallStatus.DISCONNECTED,
                            endedTimestamp = now,
                            durationSeconds = durationSec,
                            requiresRegistrationPrompt = true
                        )

                        lastProcessedEventTime = now

                        // Trigger heads-up notification and native plugin prompt
                        CallNotificationHelper.showPostCallNotification(context, session)
                        CallLifecycleManager.triggerManualPrompt(session)

                        VetRxNativePlugin.setPendingCallPrompt(
                            callEventId = session.callEventId,
                            phoneNumber = session.phoneNumber,
                            ownerName = session.ownerName,
                            patientName = session.patientName,
                            durationSeconds = session.durationSeconds,
                            action = "register_call"
                        )
                    }
                }

                incomingNumber = null
                callStartTime = 0
            }
        }
        lastState = state
    }
}
