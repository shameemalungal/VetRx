package com.vetrx.app

import android.content.Intent
import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.vetrx.app.call.CallLifecycleManager
import com.vetrx.app.call.CallNotificationHelper

// ==============================================================================
// VetRx Android Entry Point — MainActivity
// Authoritative Capacitor Bridge Host with Native PDF, Print, Share & Call Integration
// ==============================================================================

class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(VetRxNativePlugin::class.java)
        super.onCreate(savedInstanceState)
        handleCallNotificationIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleCallNotificationIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        CallLifecycleManager.isAppInForeground = true
        VetRxNativePlugin.checkAndEmitPendingPrompt(this)
    }

    override fun onPause() {
        super.onPause()
        CallLifecycleManager.isAppInForeground = false
    }

    private fun handleCallNotificationIntent(intent: Intent?) {
        if (intent == null) return

        val callEventId = intent.getStringExtra(CallNotificationHelper.EXTRA_CALL_EVENT_ID) ?: return
        val phone = intent.getStringExtra(CallNotificationHelper.EXTRA_CALL_PHONE) ?: "Unknown"
        val ownerName = intent.getStringExtra(CallNotificationHelper.EXTRA_OWNER_NAME)
        val patientName = intent.getStringExtra(CallNotificationHelper.EXTRA_PATIENT_NAME)
        val durationSec = intent.getIntExtra(CallNotificationHelper.EXTRA_DURATION_SEC, 0)
        val action = intent.getStringExtra("EXTRA_ACTION") ?: "register_call"

        CallNotificationHelper.dismissNotification(this)

        VetRxNativePlugin.setPendingCallPrompt(
            callEventId = callEventId,
            phoneNumber = phone,
            ownerName = ownerName,
            patientName = patientName,
            durationSeconds = durationSec,
            action = action
        )
    }
}
