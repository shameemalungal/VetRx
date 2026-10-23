package com.vetrx.app.call

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.vetrx.app.MainActivity

// ==============================================================================
// Smart Call Integration — Post-Call Heads-Up Notification
// Presents post-call registration triggers when app is backgrounded
// ==============================================================================

object CallNotificationHelper {

    const val CHANNEL_ID = "vetrx_call_registration_channel"
    const val NOTIFICATION_ID = 4040
    const val EXTRA_CALL_EVENT_ID = "EXTRA_CALL_EVENT_ID"
    const val EXTRA_CALL_PHONE = "EXTRA_CALL_PHONE"
    const val EXTRA_OWNER_NAME = "EXTRA_OWNER_NAME"
    const val EXTRA_PATIENT_NAME = "EXTRA_PATIENT_NAME"
    const val EXTRA_DURATION_SEC = "EXTRA_DURATION_SEC"
    const val EXTRA_ACTION = "EXTRA_ACTION"

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "VetRx Call Registration"
            val descriptionText = "Prompts veterinarians to register clinical calls after completion"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                enableLights(true)
                enableVibration(true)
            }
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createActionPendingIntent(
        context: Context,
        session: ActiveCallSession,
        action: String,
        requestCode: Int
    ): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_CALL_EVENT_ID, session.callEventId)
            putExtra(EXTRA_CALL_PHONE, session.phoneNumber)
            putExtra(EXTRA_OWNER_NAME, session.ownerName)
            putExtra(EXTRA_PATIENT_NAME, session.patientName)
            putExtra(EXTRA_DURATION_SEC, session.durationSeconds)
            putExtra(EXTRA_ACTION, action)
        }

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        return PendingIntent.getActivity(context, requestCode, intent, flags)
    }

    fun showPostCallNotification(
        context: Context,
        session: ActiveCallSession
    ) {
        createNotificationChannel(context)

        val durationText = when {
            session.status == ActiveCallStatus.MISSED -> "Missed call"
            session.durationSeconds > 0 -> {
                val mins = session.durationSeconds / 60
                val secs = session.durationSeconds % 60
                if (mins > 0) "${mins}m ${secs}s" else "${secs}s"
            }
            else -> "Call completed"
        }

        val contactName = session.ownerName ?: session.phoneNumber
        val baseCode = session.callEventId.hashCode()

        val registerPending = createActionPendingIntent(context, session, "register_call", baseCode + 1)
        val visitPending = createActionPendingIntent(context, session, "record_visit", baseCode + 2)
        val followupPending = createActionPendingIntent(context, session, "schedule_followup", baseCode + 3)

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle("Register this call in VetRx?")
            .setContentText("$contactName • $durationText. Tap to record details.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setContentIntent(registerPending)
            .addAction(
                android.R.drawable.ic_menu_save,
                "Register Call",
                registerPending
            )
            .addAction(
                android.R.drawable.ic_menu_myplaces,
                "Record Visit",
                visitPending
            )
            .addAction(
                android.R.drawable.ic_menu_agenda,
                "Schedule Follow-up",
                followupPending
            )

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, builder.build())
    }

    fun dismissNotification(context: Context) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(NOTIFICATION_ID)
    }
}
