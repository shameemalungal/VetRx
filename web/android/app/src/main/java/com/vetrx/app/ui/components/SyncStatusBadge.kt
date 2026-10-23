package com.vetrx.app.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.vetrx.app.data.models.SyncState
import com.vetrx.app.data.models.SyncStatusInfo
import com.vetrx.app.data.repository.VetRxRepository
import com.vetrx.app.ui.theme.*

// ==============================================================================
// VetRx Offline Synchronization Indicator
// Reactive state machine: synced, syncing, pending, failed
// ==============================================================================

@Composable
fun SyncStatusBadge(
    modifier: Modifier = Modifier
) {
    val syncStatus by VetRxRepository.syncStatus.collectAsState()
    var showDetailsDialog by remember { mutableStateOf(false) }

    // Infinite rotation for syncing state
    val infiniteTransition = rememberInfiniteTransition(label = "syncSpin")
    val angle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "syncAngle"
    )

    val (bg, fg, text, icon) = when (syncStatus.state) {
        SyncState.SYNCED -> {
            Tuple4(
                VetRxTertiaryFixed.copy(alpha = 0.35f),
                VetRxTertiary,
                "Synced",
                Icons.Default.CloudDone
            )
        }
        SyncState.SYNCING -> {
            Tuple4(
                VetRxSecondaryFixed.copy(alpha = 0.5f),
                VetRxSecondary,
                "Syncing…",
                Icons.Default.Sync
            )
        }
        SyncState.LOCAL_PENDING -> {
            Tuple4(
                VetRxAmberContainer,
                VetRxAmberDark,
                if (syncStatus.pendingCount > 0) "Pending (${syncStatus.pendingCount})" else "Pending",
                Icons.Default.CloudOff
            )
        }
        SyncState.FAILED -> {
            Tuple4(
                VetRxErrorContainer,
                VetRxError,
                "Sync Failed",
                Icons.Default.Warning
            )
        }
    }

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = bg,
        modifier = modifier.clickable { showDetailsDialog = true }
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = fg,
                modifier = Modifier
                    .size(13.dp)
                    .then(if (syncStatus.state == SyncState.SYNCING) Modifier.rotate(angle) else Modifier)
            )
            Text(
                text = text,
                style = MaterialTheme.typography.labelSmall,
                color = fg
            )
        }
    }

    if (showDetailsDialog) {
        AlertDialog(
            onDismissRequest = { showDetailsDialog = false },
            title = {
                Text(
                    text = "Synchronization Status",
                    style = MaterialTheme.typography.headlineSmall
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Status: $text",
                        style = MaterialTheme.typography.bodyMedium,
                        color = fg
                    )
                    Text(
                        text = "Pending Offline Records: ${syncStatus.pendingCount}",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    syncStatus.lastError?.let { err ->
                        Text(
                            text = "Error: $err",
                            style = MaterialTheme.typography.bodySmall,
                            color = VetRxError
                        )
                    }
                    Text(
                        text = "All local clinical changes are safely queued and persisted offline using native SQLite & Room storage.",
                        style = MaterialTheme.typography.bodySmall,
                        color = VetRxOnSurfaceVariant
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        VetRxRepository.triggerBackgroundSync()
                        showDetailsDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = VetRxPrimary)
                ) {
                    Text("Sync Now")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDetailsDialog = false }) {
                    Text("Close", color = VetRxOutline)
                }
            }
        )
    }
}

private data class Tuple4<A, B, C, D>(val a: A, val b: B, val c: C, val d: D)
