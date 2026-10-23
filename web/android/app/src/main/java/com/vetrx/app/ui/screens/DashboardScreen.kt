package com.vetrx.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vetrx.app.data.models.CallRecord
import com.vetrx.app.data.models.Invoice
import com.vetrx.app.data.models.Prescription
import com.vetrx.app.data.repository.VetRxRepository
import com.vetrx.app.ui.theme.*

// ==============================================================================
// VetRx Native Mobile Dashboard Screen
// Faithfully implements Stitch `vetrx_mobile_dashboard` specifications
// ==============================================================================

@Composable
fun DashboardScreen(
    onNewPrescriptionClick: () -> Unit,
    onAddPatientClick: () -> Unit,
    onCreateInvoiceClick: () -> Unit,
    onTreatmentPackagesClick: () -> Unit,
    onViewPrescriptionClick: (Prescription) -> Unit,
    onViewInvoiceClick: (Invoice) -> Unit,
    onCallClick: (CallRecord) -> Unit,
    onViewAllRxClick: () -> Unit,
    onViewAllCallsClick: () -> Unit
) {
    val prescriptions by VetRxRepository.prescriptions.collectAsState()
    val invoices by VetRxRepository.invoices.collectAsState()
    val calls by VetRxRepository.calls.collectAsState()
    val patients by VetRxRepository.patients.collectAsState()
    val packages by VetRxRepository.treatmentPackages.collectAsState()

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(VetRxBackground),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 1. Practitioner Greeting & Context
        item {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "CLINICAL WORKSPACE",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = VetRxPrimary
                    )
                    Surface(
                        shape = CircleShape,
                        color = VetRxTertiaryFixed,
                        contentColor = VetRxOnTertiaryFixedVariant
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(VetRxTertiary)
                            )
                            Text(
                                text = "Active Shift",
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Good morning, Dr. Sarah",
                    style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.Bold),
                    color = VetRxOnSurface
                )
                Text(
                    text = "Oakwood Animal Hospital • General & Surgical Practice",
                    style = MaterialTheme.typography.bodySmall,
                    color = VetRxOnSurfaceVariant
                )
            }
        }

        // 2. Primary Hero CTA Card: + New Prescription
        item {
            Surface(
                onClick = onNewPrescriptionClick,
                shape = RoundedCornerShape(16.dp),
                color = VetRxPrimaryContainer,
                shadowElevation = 4.dp,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(84.dp)
            ) {
                Box(modifier = Modifier.fillMaxSize()) {
                    // Ambient decorative gradient circle
                    Box(
                        modifier = Modifier
                            .size(100.dp)
                            .offset(x = 260.dp, y = (-20).dp)
                            .clip(CircleShape)
                            .background(VetRxPrimaryFixed.copy(alpha = 0.25f))
                    )

                    Row(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(VetRxOnPrimaryContainer.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.AddCircle,
                                    contentDescription = null,
                                    tint = VetRxOnPrimaryContainer,
                                    modifier = Modifier.size(28.dp)
                                )
                            }
                            Column {
                                Text(
                                    text = "+ New Prescription",
                                    style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                    color = VetRxOnPrimaryContainer
                                )
                                Text(
                                    text = "Start clinical prescription for a patient",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = VetRxOnPrimaryContainer.copy(alpha = 0.85f)
                                )
                            }
                        }

                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(VetRxOnPrimaryContainer.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.ArrowForward,
                                contentDescription = null,
                                tint = VetRxOnPrimaryContainer,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }
        }

        // 3. 3-Item Quick Action Row (+ Patient, + Invoice, Packages)
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                QuickActionItem(
                    label = "+ Patient",
                    icon = Icons.Default.PersonAdd,
                    iconColor = VetRxPrimary,
                    modifier = Modifier.weight(1f),
                    onClick = onAddPatientClick
                )
                QuickActionItem(
                    label = "+ Invoice",
                    icon = Icons.Default.PostAdd,
                    iconColor = VetRxSecondary,
                    modifier = Modifier.weight(1f),
                    onClick = onCreateInvoiceClick
                )
                QuickActionItem(
                    label = "Packages",
                    icon = Icons.Default.MedicalServices,
                    iconColor = VetRxTertiary,
                    modifier = Modifier.weight(1f),
                    onClick = onTreatmentPackagesClick
                )
            }
        }

        // 4. Practice Snapshot 2x2 Grid
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "PRACTICE SNAPSHOT",
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                    color = VetRxOnSurfaceVariant
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    StatCard(
                        title = "Today's Rx",
                        value = "${prescriptions.size}",
                        icon = Icons.Default.Description,
                        iconColor = VetRxSecondary,
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        title = "Total Patients",
                        value = "${patients.size}",
                        icon = Icons.Default.Pets,
                        iconColor = VetRxPrimary,
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    StatCard(
                        title = "Tx Packages",
                        value = "${packages.size}",
                        icon = Icons.Default.Inventory2,
                        iconColor = VetRxTertiary,
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        title = "Invoices",
                        value = "${invoices.size}",
                        icon = Icons.Default.ReceiptLong,
                        iconColor = VetRxSecondary,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // 5. Fast Protocol Pipeline Ribbon
        item {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = VetRxSurfaceLow,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(VetRxPrimary.copy(alpha = 0.1f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.AltRoute,
                            contentDescription = null,
                            tint = VetRxPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Column {
                        Text(
                            text = "FAST PROTOCOL PIPELINE",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                            color = VetRxPrimary
                        )
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text("Patient", style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold))
                            Icon(Icons.Default.ArrowForward, contentDescription = null, modifier = Modifier.size(12.dp), tint = VetRxOutline)
                            Text("Diagnosis", style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold))
                            Icon(Icons.Default.ArrowForward, contentDescription = null, modifier = Modifier.size(12.dp), tint = VetRxOutline)
                            Text("Medicines", style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold))
                            Icon(Icons.Default.ArrowForward, contentDescription = null, modifier = Modifier.size(12.dp), tint = VetRxOutline)
                            Text("Issue", style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold), color = VetRxPrimary)
                        }
                    }
                }
            }
        }

        // 6. Recent Calls / Telephony Integration Section
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(Icons.Default.PhoneInTalk, contentDescription = null, tint = VetRxPrimary, modifier = Modifier.size(20.dp))
                    Text(
                        text = "Today's Clinical Calls",
                        style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                        color = VetRxOnSurface
                    )
                }
                TextButton(onClick = onViewAllCallsClick) {
                    Text("View All", color = VetRxPrimary, fontWeight = FontWeight.Bold)
                }
            }
        }

        items(calls.take(2)) { call ->
            DashboardCallCard(
                call = call,
                onCallClick = { onCallClick(call) }
            )
        }

        // 7. Recent Prescriptions Section
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(Icons.Default.Description, contentDescription = null, tint = VetRxPrimary, modifier = Modifier.size(20.dp))
                    Text(
                        text = "Recent Prescriptions",
                        style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                        color = VetRxOnSurface
                    )
                }
                TextButton(onClick = onViewAllRxClick) {
                    Text("View All", color = VetRxPrimary, fontWeight = FontWeight.Bold)
                }
            }
        }

        items(prescriptions.take(3)) { rx ->
            DashboardRxCard(
                prescription = rx,
                onViewClick = { onViewPrescriptionClick(rx) }
            )
        }
    }
}

@Composable
private fun QuickActionItem(
    label: String,
    icon: ImageVector,
    iconColor: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = VetRxSurfaceLowest,
        shadowElevation = 1.dp,
        modifier = modifier.height(64.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = iconColor,
                modifier = Modifier.size(22.dp)
            )
            Spacer(modifier = Modifier.height(3.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                color = VetRxOnSurface
            )
        }
    }
}

@Composable
private fun StatCard(
    title: String,
    value: String,
    icon: ImageVector,
    iconColor: Color,
    modifier: Modifier = Modifier
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = VetRxSurfaceHigh.copy(alpha = 0.5f)),
        shape = RoundedCornerShape(12.dp),
        modifier = modifier.height(84.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelMedium,
                    color = VetRxOnSurfaceVariant
                )
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = iconColor,
                    modifier = Modifier.size(16.dp)
                )
            }
            Text(
                text = value,
                style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.Bold),
                color = VetRxOnSurface
            )
        }
    }
}

@Composable
private fun DashboardRxCard(
    prescription: Prescription,
    onViewClick: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = VetRxSurfaceLowest),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, VetRxOutlineVariant.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(VetRxSurfaceHigh),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Pets,
                            contentDescription = null,
                            tint = VetRxPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Column {
                        Text(
                            text = prescription.patientName,
                            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                            color = VetRxOnSurface
                        )
                        Text(
                            text = "${prescription.species} • ${prescription.breed}",
                            style = MaterialTheme.typography.bodySmall,
                            color = VetRxOnSurfaceVariant
                        )
                    }
                }

                Surface(
                    shape = CircleShape,
                    color = VetRxTertiaryFixed,
                    contentColor = VetRxOnTertiaryFixedVariant
                ) {
                    Text(
                        text = prescription.status,
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Surface(
                shape = RoundedCornerShape(8.dp),
                color = VetRxSurfaceLow,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = prescription.rxNumber,
                        style = VetRxDataMono,
                        color = VetRxPrimary
                    )
                    Text(
                        text = prescription.diagnosis,
                        style = MaterialTheme.typography.bodySmall,
                        color = VetRxOnSurfaceVariant,
                        maxLines = 1
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(Icons.Default.Person, contentDescription = null, tint = VetRxOutline, modifier = Modifier.size(14.dp))
                    Text(
                        text = prescription.ownerName,
                        style = MaterialTheme.typography.bodySmall,
                        color = VetRxOnSurfaceVariant
                    )
                }

                FilledTonalButton(
                    onClick = onViewClick,
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.filledTonalButtonColors(
                        containerColor = VetRxSurfaceContainer,
                        contentColor = VetRxPrimary
                    ),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                    modifier = Modifier.height(34.dp)
                ) {
                    Text(
                        text = "View Prescription",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold)
                    )
                }
            }
        }
    }
}

@Composable
private fun DashboardCallCard(
    call: CallRecord,
    onCallClick: () -> Unit
) {
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
                .padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = call.ownerName ?: call.callerPhone,
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                        color = VetRxOnSurface
                    )
                    Surface(
                        shape = CircleShape,
                        color = when (call.priority) {
                            com.vetrx.app.data.models.CallPriority.EMERGENCY -> VetRxErrorContainer
                            com.vetrx.app.data.models.CallPriority.URGENT -> VetRxAmberContainer
                            else -> VetRxPrimaryFixed.copy(alpha = 0.5f)
                        }
                    ) {
                        Text(
                            text = call.priority.name,
                            style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp),
                            color = when (call.priority) {
                                com.vetrx.app.data.models.CallPriority.EMERGENCY -> VetRxError
                                com.vetrx.app.data.models.CallPriority.URGENT -> VetRxAmberDark
                                else -> VetRxPrimary
                            },
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
                Text(
                    text = "${call.patientName ?: "General Animal"} • ${call.symptoms}",
                    style = MaterialTheme.typography.bodySmall,
                    color = VetRxOnSurfaceVariant,
                    maxLines = 1
                )
            }

            IconButton(
                onClick = onCallClick,
                colors = IconButtonDefaults.iconButtonColors(
                    containerColor = VetRxPrimaryContainer,
                    contentColor = VetRxOnPrimaryContainer
                ),
                modifier = Modifier.size(40.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Call,
                    contentDescription = "Call Contact",
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}
