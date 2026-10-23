package com.vetrx.app.call

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vetrx.app.data.models.*
import com.vetrx.app.data.repository.VetRxRepository
import com.vetrx.app.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

// ==============================================================================
// Smart Call Integration — Post-Call Registration Bottom Sheet
// Adheres strictly to Section 5.3, 5.4, 5.5 of VetRx Native Specification
// ==============================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostCallRegistrationSheet(
    session: ActiveCallSession,
    onDismiss: () -> Unit,
    onNavigateToVisit: ((CallRecord) -> Unit)? = null,
    onNavigateToPatient: ((String) -> Unit)? = null
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val owners by VetRxRepository.owners.collectAsState()
    val patients by VetRxRepository.patients.collectAsState()

    // Form state
    var selectedOwnerId by remember { mutableStateOf(session.ownerId) }
    var selectedPatientId by remember { mutableStateOf(session.patientId) }
    var symptoms by remember { mutableStateOf("") }
    var tentativeAssessment by remember { mutableStateOf("") }
    var selectedPriority by remember { mutableStateOf(CallPriority.PLANNED) }
    var selectedFlexibility by remember { mutableStateOf(VisitFlexibility.MUST_ATTEND_TODAY) }
    var notes by remember { mutableStateOf("") }
    var showOwnerPicker by remember { mutableStateOf(false) }

    // Resolve owner & patient names
    val matchedOwner = owners.firstOrNull { it.id == selectedOwnerId } ?: VetRxRepository.findOwnerByPhone(session.phoneNumber)
    val availablePatients = if (matchedOwner != null) {
        patients.filter { it.ownerId == matchedOwner.id }
    } else {
        patients
    }
    val matchedPatient = availablePatients.firstOrNull { it.id == selectedPatientId } ?: availablePatients.firstOrNull()

    val formattedTime = remember(session.initiatedTimestamp) {
        val sdf = SimpleDateFormat("h:mm a, d MMM yyyy", Locale.getDefault())
        sdf.format(Date(session.initiatedTimestamp))
    }

    val durationText = remember(session.durationSeconds) {
        if (session.durationSeconds > 0) {
            val mins = session.durationSeconds / 60
            val secs = session.durationSeconds % 60
            if (mins > 0) "${mins}m ${secs}s" else "${secs}s"
        } else {
            "Not connected / Cancelled"
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = VetRxSurfaceLowest,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(top = 12.dp, bottom = 8.dp)
                    .width(48.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(VetRxOutlineVariant)
            )
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Header Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(VetRxPrimaryContainer),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.PhoneCallback,
                            contentDescription = "Call Registered",
                            tint = VetRxOnPrimaryContainer,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                    Column {
                        Text(
                            text = "Register this call?",
                            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                            color = VetRxOnSurface
                        )
                        Text(
                            text = "Oakwood Animal Hospital • Clinical Call",
                            style = MaterialTheme.typography.bodySmall,
                            color = VetRxOnSurfaceVariant
                        )
                    }
                }
                IconButton(onClick = onDismiss) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Dismiss",
                        tint = VetRxOutline
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Contact & Call Telemetry Card
            Card(
                colors = CardDefaults.cardColors(containerColor = VetRxSurfaceLow),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, VetRxSurfaceHighest, RoundedCornerShape(16.dp))
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = matchedOwner?.name ?: session.ownerName ?: "Unlinked Caller",
                                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                color = VetRxOnSurface
                            )
                            Text(
                                text = session.phoneNumber,
                                style = VetRxDataMono,
                                color = VetRxPrimary
                            )
                        }

                        // Direction Badge
                        val isOut = session.direction == CallDirection.OUTGOING
                        Surface(
                            shape = CircleShape,
                            color = if (isOut) VetRxSecondaryFixed else VetRxTertiaryFixed,
                            contentColor = if (isOut) VetRxOnSecondaryFixed else VetRxOnTertiaryFixed
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    imageVector = if (isOut) Icons.Default.CallMade else Icons.Default.CallReceived,
                                    contentDescription = null,
                                    modifier = Modifier.size(12.dp)
                                )
                                Text(
                                    text = if (isOut) "Outgoing" else "Incoming",
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    HorizontalDivider(color = VetRxOutlineVariant.copy(alpha = 0.4f))
                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Schedule,
                                contentDescription = null,
                                tint = VetRxOutline,
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                text = formattedTime,
                                style = MaterialTheme.typography.bodySmall,
                                color = VetRxOnSurfaceVariant
                            )
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Timer,
                                contentDescription = null,
                                tint = if (session.durationSeconds > 0) VetRxTertiary else VetRxError,
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                text = durationText,
                                style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                                color = if (session.durationSeconds > 0) VetRxTertiary else VetRxError
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Associated Patient Section
            Text(
                text = "Associated Patient",
                style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                color = VetRxOnSurface
            )
            Spacer(modifier = Modifier.height(6.dp))

            if (matchedPatient != null) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = VetRxSurfaceContainer,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(VetRxPrimary),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Pets,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Column {
                                Text(
                                    text = matchedPatient.name,
                                    style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                    color = VetRxOnSurface
                                )
                                Text(
                                    text = "${matchedPatient.species} • ${matchedPatient.breed} • ${matchedPatient.weightKg} kg",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = VetRxOnSurfaceVariant
                                )
                            }
                        }

                        TextButton(onClick = { showOwnerPicker = !showOwnerPicker }) {
                            Text("Switch", color = VetRxPrimary, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = VetRxSurfaceContainer,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showOwnerPicker = true }
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.PersonSearch, contentDescription = null, tint = VetRxPrimary)
                        Text(
                            text = "Link to existing owner or patient...",
                            style = MaterialTheme.typography.bodyMedium,
                            color = VetRxPrimary
                        )
                    }
                }
            }

            // Quick owner picker accordion if toggled
            if (showOwnerPicker) {
                Spacer(modifier = Modifier.height(8.dp))
                Card(
                    colors = CardDefaults.cardColors(containerColor = VetRxSurfaceLowest),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, VetRxOutlineVariant, RoundedCornerShape(12.dp))
                ) {
                    Column(modifier = Modifier.padding(8.dp)) {
                        Text(
                            text = "Select Owner / Patient:",
                            style = MaterialTheme.typography.labelMedium,
                            color = VetRxOutline,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                        owners.forEach { o ->
                            val pet = patients.firstOrNull { it.ownerId == o.id }
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable {
                                        selectedOwnerId = o.id
                                        selectedPatientId = pet?.id
                                        showOwnerPicker = false
                                    }
                                    .padding(horizontal = 8.dp, vertical = 6.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(o.name, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold))
                                    Text("${pet?.name ?: "No animal"} • ${o.phone}", style = MaterialTheme.typography.bodySmall, color = VetRxOnSurfaceVariant)
                                }
                                if (o.id == selectedOwnerId) {
                                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = VetRxPrimary, modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Clinical Presenting Symptoms Input
            OutlinedTextField(
                value = symptoms,
                onValueChange = { symptoms = it },
                label = { Text("Clinical Symptoms / Presenting Issue *") },
                placeholder = { Text("e.g. Acute anorexia, fever, wound dressing needed") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = VetRxPrimary,
                    focusedLabelColor = VetRxPrimary
                ),
                maxLines = 3
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Priority Selection
            Text(
                text = "Clinical Priority",
                style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                color = VetRxOnSurface
            )
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                CallPriority.values().forEach { prio ->
                    val isSelected = selectedPriority == prio
                    val (color, text) = when (prio) {
                        CallPriority.EMERGENCY -> VetRxError to "Emergency"
                        CallPriority.URGENT -> VetRxAmber to "Urgent"
                        CallPriority.PLANNED -> VetRxPrimary to "Planned"
                        CallPriority.COULD_NOT_ASSESS -> VetRxSecondary to "Review"
                    }
                    Surface(
                        shape = CircleShape,
                        color = if (isSelected) color else VetRxSurfaceLow,
                        modifier = Modifier
                            .weight(1f)
                            .clickable { selectedPriority = prio }
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = text,
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                color = if (isSelected) Color.White else VetRxOnSurfaceVariant
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Visit Flexibility Chips
            Text(
                text = "Attendance Timing",
                style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                color = VetRxOnSurface
            )
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                val flexibilities = listOf(
                    VisitFlexibility.MUST_ATTEND_TODAY to "Must Attend Today",
                    VisitFlexibility.PREFERRED_TODAY to "Preferred Today",
                    VisitFlexibility.CAN_POSTPONE_TODAY to "Postponeable"
                )
                flexibilities.forEach { (flex, label) ->
                    val isSelected = selectedFlexibility == flex
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = if (isSelected) VetRxPrimaryContainer else VetRxSurfaceLow,
                        border = if (isSelected) null else androidx.compose.foundation.BorderStroke(1.dp, VetRxOutlineVariant),
                        modifier = Modifier
                            .weight(1f)
                            .clickable { selectedFlexibility = flex }
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 8.dp, horizontal = 4.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                                color = if (isSelected) VetRxOnPrimaryContainer else VetRxOnSurface,
                                maxLines = 1
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Quick Advice / Notes Input
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Clinical Advice / Tentative Plan") },
                placeholder = { Text("Instructions given to owner over the call...") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = VetRxPrimary,
                    focusedLabelColor = VetRxPrimary
                ),
                maxLines = 2
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Primary Action — Register Call
            Button(
                onClick = {
                    val finalSymptoms = if (symptoms.isNotBlank()) symptoms else "Phone consultation regarding animal care"
                    val callRecord = CallRecord(
                        callerPhone = session.phoneNumber,
                        ownerId = matchedOwner?.id,
                        ownerName = matchedOwner?.name ?: session.ownerName,
                        patientId = matchedPatient?.id,
                        patientName = matchedPatient?.name ?: session.patientName,
                        species = matchedPatient?.species ?: session.species,
                        animalCount = 1,
                        symptoms = finalSymptoms,
                        tentativeAssessment = tentativeAssessment.ifBlank { null },
                        priority = selectedPriority,
                        flexibility = selectedFlexibility,
                        notes = notes.ifBlank { null },
                        callEventId = session.callEventId,
                        callDurationSeconds = session.durationSeconds,
                        direction = session.direction,
                        status = CallStatus.LOGGED
                    )
                    VetRxRepository.registerCall(callRecord)
                    onDismiss()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = VetRxPrimary,
                    contentColor = VetRxOnPrimary
                )
            ) {
                Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Register Call Record",
                    style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold)
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Secondary Quick Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = {
                        val record = CallRecord(
                            callerPhone = session.phoneNumber,
                            ownerId = matchedOwner?.id,
                            ownerName = matchedOwner?.name,
                            patientId = matchedPatient?.id,
                            patientName = matchedPatient?.name,
                            species = matchedPatient?.species ?: "Canine",
                            symptoms = symptoms.ifBlank { "Recorded for scheduled visit" },
                            priority = selectedPriority,
                            status = CallStatus.SCHEDULED,
                            callEventId = session.callEventId,
                            callDurationSeconds = session.durationSeconds,
                            direction = session.direction
                        )
                        val saved = VetRxRepository.registerCall(record)
                        onDismiss()
                        onNavigateToVisit?.invoke(saved)
                    },
                    modifier = Modifier
                        .weight(1f)
                        .height(44.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = VetRxSecondary)
                ) {
                    Icon(Icons.Default.CalendarMonth, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Record Visit", style = MaterialTheme.typography.labelMedium)
                }

                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.height(44.dp)
                ) {
                    Text(
                        text = "Dismiss",
                        color = VetRxOutline,
                        style = MaterialTheme.typography.labelMedium
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
