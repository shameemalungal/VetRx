package com.vetrx.app.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.vetrx.app.data.repository.VetRxRepository
import com.vetrx.app.ui.components.SyncStatusBadge
import com.vetrx.app.ui.theme.*

// ==============================================================================
// VetRx Settings & Telephony Diagnostics Screen
// Practice Configuration, Privacy & Default Dialer Policy Explanations
// ==============================================================================

@Composable
fun SettingsScreen() {
    val context = LocalContext.current
    val syncStatus by VetRxRepository.syncStatus.collectAsState()

    val hasPhoneStatePermission = remember {
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
    }
    val hasCallPhonePermission = remember {
        ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED
    }
    val hasNotificationPermission = remember {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(VetRxBackground),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Header
        item {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Practice Settings",
                    style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.Bold),
                    color = VetRxOnSurface
                )
                Text(
                    text = "Doctor credentials, telemetry permissions & synchronization",
                    style = MaterialTheme.typography.bodySmall,
                    color = VetRxOnSurfaceVariant
                )
            }
        }

        // Practitioner Profile Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = VetRxSurfaceLowest),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, VetRxOutlineVariant.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(VetRxPrimary),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "SJ",
                            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                            color = Color.White
                        )
                    }
                    Column {
                        Text(
                            text = "Dr. Sarah Jenkins",
                            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                            color = VetRxOnSurface
                        )
                        Text(
                            text = "Lead Veterinarian • Oakwood Animal Hospital",
                            style = MaterialTheme.typography.bodySmall,
                            color = VetRxOnSurfaceVariant
                        )
                        Text(
                            text = "VCI Registration: VCI-KA-2018-04421",
                            style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                            color = VetRxPrimary
                        )
                    }
                }
            }
        }

        // Telephony & Call Integration Settings (Section 5)
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = VetRxSurfaceLowest),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, VetRxOutlineVariant.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.PhoneCallback, contentDescription = null, tint = VetRxPrimary)
                        Text(
                            text = "Smart Call Integration Status",
                            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                            color = VetRxOnSurface
                        )
                    }

                    HorizontalDivider(color = VetRxOutlineVariant.copy(alpha = 0.4f))

                    PermissionStatusRow(
                        title = "Telephony State Detection",
                        subtitle = "Detects when clinical calls connect and end",
                        isGranted = hasPhoneStatePermission
                    )

                    PermissionStatusRow(
                        title = "Direct Phone Dialing",
                        subtitle = "Launches native dialer with one-tap",
                        isGranted = hasCallPhonePermission
                    )

                    PermissionStatusRow(
                        title = "Post-Call Heads-up Notifications",
                        subtitle = "Prompts registration if app was in background",
                        isGranted = hasNotificationPermission
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    // Section 5.6 Legal & Default Dialer Policy Disclosure
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = VetRxSurfaceLow,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Icon(Icons.Default.Info, contentDescription = null, tint = VetRxSecondary, modifier = Modifier.size(16.dp))
                                Text(
                                    text = "Android Policy & Default Dialer Note",
                                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                                    color = VetRxSecondary
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Per Google Play Developer Policy and Android security architecture, tracking arbitrary calls made outside VetRx without user initiation requires becoming the device's Default Phone (Dialer) app. VetRx ensures 100% reliable post-call registration for all practice-initiated calls and permitted incoming broadcasts without forcibly replacing your standard dialer.",
                                style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                                color = VetRxOnSurfaceVariant,
                                lineHeight = 15.sp
                            )
                        }
                    }
                }
            }
        }

        // Data Synchronization & Storage Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = VetRxSurfaceLowest),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, VetRxOutlineVariant.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Default.CloudSync, contentDescription = null, tint = VetRxPrimary)
                            Text(
                                text = "PostgreSQL Synchronization",
                                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                color = VetRxOnSurface
                            )
                        }
                        SyncStatusBadge()
                    }

                    Text(
                        text = "Authoritative Server: https://app.vetrx.brightbase.in\nLocal Storage: Native Room / SQLite durable queue\nPending offline modifications: ${syncStatus.pendingCount}",
                        style = MaterialTheme.typography.bodySmall,
                        color = VetRxOnSurfaceVariant
                    )

                    Button(
                        onClick = { VetRxRepository.triggerBackgroundSync() },
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = VetRxPrimary),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp)
                    ) {
                        Icon(Icons.Default.Sync, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Force Synchronize Database Now", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                    }
                }
            }
        }

        // Version & Build Information
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "VetRx Native Android Edition • v8.0.0",
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                    color = VetRxOutline
                )
                Text(
                    text = "Kotlin 2.0 • Jetpack Compose M3 • Stitch Design System",
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                    color = VetRxOutlineVariant
                )
            }
        }
    }
}

@Composable
private fun PermissionStatusRow(
    title: String,
    subtitle: String,
    isGranted: Boolean
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold))
            Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = VetRxOnSurfaceVariant)
        }
        Surface(
            shape = CircleShape,
            color = if (isGranted) VetRxTertiaryFixed else VetRxAmberContainer
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Icon(
                    imageVector = if (isGranted) Icons.Default.CheckCircle else Icons.Default.Warning,
                    contentDescription = null,
                    tint = if (isGranted) VetRxTertiary else VetRxAmberDark,
                    modifier = Modifier.size(12.dp)
                )
                Text(
                    text = if (isGranted) "Granted" else "Requires Action",
                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, fontWeight = FontWeight.Bold),
                    color = if (isGranted) VetRxTertiary else VetRxAmberDark
                )
            }
        }
    }
}
