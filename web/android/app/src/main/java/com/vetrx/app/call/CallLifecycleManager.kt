package com.vetrx.app.call

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.vetrx.app.data.models.CallDirection
import com.vetrx.app.data.models.Owner
import com.vetrx.app.data.models.Patient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

// ==============================================================================
// Smart Call Integration — Call Lifecycle & Telephony Manager
// Tracks Call Outgoing -> Connect -> Disconnect -> Prompt Trigger
// ==============================================================================

object CallLifecycleManager {

    private val _activeSession = MutableStateFlow<ActiveCallSession?>(null)
    val activeSession: StateFlow<ActiveCallSession?> = _activeSession.asStateFlow()

    private val _pendingPromptSession = MutableStateFlow<ActiveCallSession?>(null)
    val pendingPromptSession: StateFlow<ActiveCallSession?> = _pendingPromptSession.asStateFlow()

    var isAppInForeground: Boolean = true

    private var telephonyManager: TelephonyManager? = null
    private var legacyListener: PhoneStateListener? = null
    private var modernCallback: Any? = null

    /**
     * Initiates a phone call to a client/patient with native Telephony tracking.
     */
    fun initiateCall(
        context: Context,
        phoneNumber: String,
        owner: Owner? = null,
        patient: Patient? = null
    ) {
        val cleanNumber = phoneNumber.trim()
        val session = ActiveCallSession(
            callEventId = UUID.randomUUID().toString(),
            phoneNumber = cleanNumber,
            ownerId = owner?.id ?: patient?.ownerId,
            ownerName = owner?.name ?: patient?.ownerName,
            patientId = patient?.id,
            patientName = patient?.name,
            species = patient?.species ?: "Canine",
            direction = CallDirection.OUTGOING,
            status = ActiveCallStatus.DIALING,
            initiatedTimestamp = System.currentTimeMillis()
        )
        _activeSession.value = session

        // Register Telephony listener before launching call intent
        registerTelephonyListener(context.applicationContext)

        // Launch phone intent
        val hasCallPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CALL_PHONE
        ) == PackageManager.PERMISSION_GRANTED

        val intent = if (hasCallPermission) {
            Intent(Intent.ACTION_CALL, Uri.parse("tel:$cleanNumber"))
        } else {
            Intent(Intent.ACTION_DIAL, Uri.parse("tel:$cleanNumber"))
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    /**
     * Registers Telephony state callback compatible with all Android versions.
     */
    private fun registerTelephonyListener(context: Context) {
        telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager ?: return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+ TelephonyCallback
            val callback = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                override fun onCallStateChanged(state: Int) {
                    handleTelephonyState(context, state)
                }
            }
            modernCallback = callback
            try {
                telephonyManager?.registerTelephonyCallback(context.mainExecutor, callback)
            } catch (e: SecurityException) {
                // Fallback gracefully if permission not granted
            }
        } else {
            // Legacy PhoneStateListener
            @Suppress("DEPRECATION")
            legacyListener = object : PhoneStateListener() {
                @Deprecated("Deprecated in Java")
                override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                    handleTelephonyState(context, state)
                }
            }
            @Suppress("DEPRECATION")
            telephonyManager?.listen(legacyListener, PhoneStateListener.LISTEN_CALL_STATE)
        }
    }

    private fun unregisterTelephonyListener() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (modernCallback as? TelephonyCallback)?.let {
                telephonyManager?.unregisterTelephonyCallback(it)
            }
            modernCallback = null
        } else {
            @Suppress("DEPRECATION")
            legacyListener?.let {
                telephonyManager?.listen(it, PhoneStateListener.LISTEN_NONE)
            }
            legacyListener = null
        }
    }

    fun handleTelephonyState(context: Context, state: Int) {
        val current = _activeSession.value ?: return

        when (state) {
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                // Call connected and in progress
                if (current.status != ActiveCallStatus.CONNECTED) {
                    _activeSession.value = current.copy(
                        status = ActiveCallStatus.CONNECTED,
                        connectedTimestamp = System.currentTimeMillis()
                    )
                }
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                // Call ended or cancelled
                val now = System.currentTimeMillis()
                val connectedTime = current.connectedTimestamp
                val duration = if (connectedTime != null && now > connectedTime) {
                    ((now - connectedTime) / 1000).toInt()
                } else {
                    0
                }

                val finalSession = current.copy(
                    status = if (duration > 0) ActiveCallStatus.DISCONNECTED else ActiveCallStatus.CANCELLED,
                    endedTimestamp = now,
                    durationSeconds = duration,
                    requiresRegistrationPrompt = true
                )

                _activeSession.value = null
                unregisterTelephonyListener()

                // Trigger post-call prompt or notification
                triggerPostCallFlow(context, finalSession)
            }
            TelephonyManager.CALL_STATE_RINGING -> {
                // Incoming ring
            }
        }
    }

    private fun triggerPostCallFlow(context: Context, session: ActiveCallSession) {
        if (isAppInForeground) {
            // Immediately display Compose Modal Bottom Sheet
            _pendingPromptSession.value = session
        } else {
            // Backgrounded: post high-priority heads-up notification with action
            _pendingPromptSession.value = session
            CallNotificationHelper.showPostCallNotification(context, session)
        }
    }

    fun triggerManualPrompt(session: ActiveCallSession) {
        _pendingPromptSession.value = session
    }

    fun dismissPrompt(context: Context? = null) {
        _pendingPromptSession.value = null
        context?.let { CallNotificationHelper.dismissNotification(it) }
    }
}
