package com.vetrx.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import com.vetrx.app.call.CallLifecycleManager
import com.vetrx.app.data.models.CallDirection
import com.vetrx.app.data.models.CallPriority
import com.vetrx.app.data.models.CallRecord
import com.vetrx.app.data.models.CallStatus
import com.vetrx.app.data.repository.VetRxRepository
import com.vetrx.app.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

// ==============================================================================
// VetRx Calls & Visits Screen — Triage, Phone Registration & Field Management
// Optimized for one-handed operation in clinics and in the field
// ==============================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CallsAndVisitsScreen(
    onPatientClick: (String) -> Unit
) {
    val context = LocalContext.current
    val calls by VetRxRepository.calls.collectAsState()
    val owners by VetRxRepository.owners.collectAsState()

    var selectedTab by remember { mutableStateOf("All") }
    var showManualCallDialog by remember { mutableStateOf(false) }

    val tabs = listOf("All", "Today", "Emergency", "Scheduled")

    val filteredCalls = calls.filter { call ->
        when (selectedTab) {
            "Today" -> true
            "Emergency" -> call.priority == CallPriority.EMERGENCY || call.priority == CallPriority.URGENT
            "Scheduled" -> call.status == CallStatus.SCHEDULED
            else -> true
        }
    }

    Scaffold(
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showManualCallDialog = true },
                containerColor = VetRxPrimary,
                contentColor = Color.White,
                icon = { Icon(Icons.Default.AddIcCall, contentDescription = null) },
                text = { Text("Log Call", fontWeight = FontWeight.Bold) },
                shape = RoundedCornerShape(16.dp)
            )
        },
        containerColor = VetRxBackground
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Screen Header & Filter Tabs
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(VetRxSurfaceLowest)
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                Text(
                    text = "Calls & Field Visits",
                    style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.Bold),
                    color = VetRxOnSurface
                )
                Text(
                    text = "Phone triage, client dispatch & smart call registration log",
                    style = MaterialTheme.typography.bodySmall,
                    color = VetRxOnSurfaceVariant
                )

                Spacer(modifier = Modifier.height(10.dp))

                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(tabs) { tab ->
                        val isSelected = selectedTab == tab
                        FilterChip(
                            selected = isSelected,
                            onClick = { selectedTab = tab },
                            label = { Text(tab) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = VetRxPrimaryContainer,
                                selectedLabelColor = VetRxOnPrimaryContainer
                            ),
                            shape = RoundedCornerShape(8.dp)
                        )
                    }
                }
            }

            // Calls List
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 96.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filteredCalls) { call ->
                    CallManagementCard(
                        call = call,
                        onCallContactClick = {
                            val matchedOwner = owners.firstOrNull { it.id == call.ownerId }
                            CallLifecycleManager.initiateCall(
                                context = context,
                                phoneNumber = call.callerPhone,
                                owner = matchedOwner
                            )
                        },
                        onOpenPatientClick = {
                            call.patientId?.let { onPatientClick(it) }
                        }
                    )
                }
            }
        }
    }

    if (showManualCallDialog) {
        ManualCallRegistrationDialog(
            onDismiss = { showManualCallDialog = false },
            onSave = { newRecord ->
                VetRxRepository.registerCall(newRecord)
                showManualCallDialog = false
            }
        )
    }
}

@Composable
private fun CallManagementCard(
    call: CallRecord,
    onCallContactClick: () -> Unit,
    onOpenPatientClick: () -> Unit
) {
    val formattedDate = remember(call.createdAt) {
        val sdf = SimpleDateFormat("h:mm a • d MMM", Locale.getDefault())
        sdf.format(Date(call.createdAt))
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = VetRxSurfaceLowest),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, VetRxOutlineVariant.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            // Header: Contact Name & Direction Badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = call.ownerName ?: "Unknown Contact",
                            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                            color = VetRxOnSurface
                        )
                        // Priority Badge
                        Surface(
                            shape = CircleShape,
                            color = when (call.priority) {
                                CallPriority.EMERGENCY -> VetRxErrorContainer
                                CallPriority.URGENT -> VetRxAmberContainer
                                else -> VetRxPrimaryFixed.copy(alpha = 0.5f)
                            }
                        ) {
                            Text(
                                text = call.priority.name,
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp, fontWeight = FontWeight.Bold),
                                color = when (call.priority) {
                                    CallPriority.EMERGENCY -> VetRxError
                                    CallPriority.URGENT -> VetRxAmberDark
                                    else -> VetRxPrimary
                                },
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }

                    Text(
                        text = call.callerPhone,
                        style = VetRxDataMono,
                        color = VetRxPrimary
                    )
                }

                // Direction & Duration Pill
                val isOut = call.direction == CallDirection.OUTGOING
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = VetRxSurfaceLow
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = if (isOut) Icons.Default.CallMade else Icons.Default.CallReceived,
                            contentDescription = null,
                            modifier = Modifier.size(12.dp),
                            tint = if (isOut) VetRxSecondary else VetRxTertiary
                        )
                        Text(
                            text = if (call.callDurationSeconds > 0) "${call.callDurationSeconds}s" else "Logged",
                            style = MaterialTheme.typography.labelSmall,
                            color = VetRxOnSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Clinical Presentation Box
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = VetRxSurfaceLow,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(10.dp)) {
                    Text(
                        text = "Animal: ${call.patientName ?: "Not Specified"} (${call.species})",
                        style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                        color = VetRxOnSurface
                    )
                    Text(
                        text = "Symptoms: ${call.symptoms}",
                        style = MaterialTheme.typography.bodySmall,
                        color = VetRxOnSurfaceVariant,
                        maxLines = 2
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Footer: Timestamp, Registration State & Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(Icons.Default.Schedule, contentDescription = null, tint = VetRxOutline, modifier = Modifier.size(14.dp))
                    Text(
                        text = formattedDate,
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                        color = VetRxOutline
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilledTonalButton(
                        onClick = onCallContactClick,
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = VetRxPrimaryContainer,
                            contentColor = VetRxOnPrimaryContainer
                        ),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(34.dp)
                    ) {
                        Icon(Icons.Default.Call, contentDescription = null, modifier = Modifier.size(15.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Call", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold))
                    }

                    if (call.patientId != null) {
                        OutlinedButton(
                            onClick = onOpenPatientClick,
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            modifier = Modifier.height(34.dp)
                        ) {
                            Text("Patient", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ManualCallRegistrationDialog(
    onDismiss: () -> Unit,
    onSave: (CallRecord) -> Unit
) {
    var phone by remember { mutableStateOf("") }
    var ownerName by remember { mutableStateOf("") }
    var petName by remember { mutableStateOf("") }
    var symptoms by remember { mutableStateOf("") }
    var priority by remember { mutableStateOf(CallPriority.PLANNED) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Log Clinical Call", style = MaterialTheme.typography.headlineSmall) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("Phone Number *") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp)
                )
                OutlinedTextField(
                    value = ownerName,
                    onValueChange = { ownerName = it },
                    label = { Text("Client Name") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp)
                )
                OutlinedTextField(
                    value = petName,
                    onValueChange = { petName = it },
                    label = { Text("Patient / Animal Name") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp)
                )
                OutlinedTextField(
                    value = symptoms,
                    onValueChange = { symptoms = it },
                    label = { Text("Symptoms / Presenting Problem *") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    maxLines = 3
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (phone.isNotBlank() && symptoms.isNotBlank()) {
                        val newRecord = CallRecord(
                            callerPhone = phone,
                            ownerName = ownerName.ifBlank { null },
                            patientName = petName.ifBlank { null },
                            symptoms = symptoms,
                            priority = priority
                        )
                        onSave(newRecord)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = VetRxPrimary)
            ) {
                Text("Save Call")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = VetRxOutline)
            }
        }
    )
}
