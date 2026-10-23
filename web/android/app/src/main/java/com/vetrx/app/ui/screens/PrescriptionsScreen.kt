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
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vetrx.app.data.models.Patient
import com.vetrx.app.data.models.Prescription
import com.vetrx.app.data.models.PrescriptionItem
import com.vetrx.app.data.repository.VetRxRepository
import com.vetrx.app.ui.theme.*
import java.util.*

// ==============================================================================
// VetRx Prescriptions Screen — Native Prescription Directory & Clinical Builder
// Based on Stitch `vetrx_new_prescription_clinical_details_mobile`
// ==============================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrescriptionsScreen(
    initialSelectedPatient: Patient? = null,
    onPrescriptionCreated: (Prescription) -> Unit,
    onViewPrescription: (Prescription) -> Unit
) {
    val prescriptions by VetRxRepository.prescriptions.collectAsState()
    val patients by VetRxRepository.patients.collectAsState()
    val treatmentPackages by VetRxRepository.treatmentPackages.collectAsState()

    var isBuildingRx by remember { mutableStateOf(initialSelectedPatient != null) }
    var selectedPatient by remember { mutableStateOf(initialSelectedPatient ?: patients.firstOrNull()) }

    // Prescription form fields
    var symptoms by remember { mutableStateOf(if (initialSelectedPatient?.name == "Bruno") "Scratching right ear, shaking head vigorously, thick brown waxy discharge on otoscopy." else "") }
    var diagnosis by remember { mutableStateOf(if (initialSelectedPatient?.name == "Bruno") "Canine Acute Otitis Externa" else "") }
    var advice by remember { mutableStateOf(if (initialSelectedPatient?.name == "Bruno") "Keep ear canal completely dry during bath. Use e-collar if scratching head continues tonight." else "") }
    var followUpDays by remember { mutableStateOf("7d") }
    var medicineList by remember {
        mutableStateOf(
            if (initialSelectedPatient?.name == "Bruno") {
                listOf(
                    PrescriptionItem(
                        medicineName = "Amoxycillin 500 mg",
                        dosage = "1 tablet",
                        route = "PO",
                        frequency = "BID",
                        durationDays = 5,
                        quantity = 10,
                        instructions = "Give after food."
                    ),
                    PrescriptionItem(
                        medicineName = "Posatex Otic Drops 15ml",
                        dosage = "4 drops",
                        route = "Right Ear",
                        frequency = "SID",
                        durationDays = 7,
                        quantity = 1,
                        instructions = "Clean ear canal 15m before applying."
                    )
                )
            } else {
                emptyList()
            }
        )
    }

    var showAddMedicineSheet by remember { mutableStateOf(false) }
    var showPackagesSheet by remember { mutableStateOf(false) }

    if (isBuildingRx) {
        // Prescription Builder Flow
        Scaffold(
            topBar = {
                Surface(
                    color = VetRxSurfaceLowest,
                    shadowElevation = 2.dp
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            IconButton(onClick = { isBuildingRx = false }) {
                                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = VetRxPrimary)
                            }
                            Column {
                                Text(
                                    text = "New Prescription",
                                    style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                    color = VetRxOnSurface
                                )
                                Text(
                                    text = "Step 2 & 3 of 4 • Clinical Details & Medicines",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = VetRxOnSurfaceVariant
                                )
                            }
                        }

                        TextButton(onClick = { isBuildingRx = false }) {
                            Text("Cancel", color = VetRxOutline)
                        }
                    }
                }
            },
            containerColor = VetRxBackground
        ) { padding ->
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 96.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // 4-Stage Pill Indicator
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(modifier = Modifier.weight(1f).height(6.dp).clip(CircleShape).background(VetRxPrimary))
                        Box(modifier = Modifier.weight(1f).height(6.dp).clip(CircleShape).background(VetRxPrimary))
                        Box(modifier = Modifier.weight(1f).height(6.dp).clip(CircleShape).background(VetRxPrimary))
                        Box(modifier = Modifier.weight(1f).height(6.dp).clip(CircleShape).background(VetRxSurfaceHigh))
                    }
                }

                // 1. Patient Signalment Quick Card
                item {
                    selectedPatient?.let { pat ->
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
                                        Icon(Icons.Default.Pets, contentDescription = null, tint = VetRxOnPrimaryContainer)
                                    }
                                    Column {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Text(
                                                text = pat.name,
                                                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                                color = VetRxOnSurface
                                            )
                                            Surface(
                                                shape = CircleShape,
                                                color = VetRxPrimaryFixed.copy(alpha = 0.5f)
                                            ) {
                                                Text(
                                                    text = "Active",
                                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp, fontWeight = FontWeight.Bold),
                                                    color = VetRxPrimary,
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                        Text(
                                            text = "${pat.species} • ${pat.breed} • ${pat.gender} • ${pat.ageYears} • ${pat.weightKg} kg",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = VetRxOnSurfaceVariant
                                        )
                                        Text(
                                            text = "Owner: ${pat.ownerName}",
                                            style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                                            color = VetRxOutline
                                        )
                                    }
                                }

                                TextButton(
                                    onClick = {
                                        // Switch patient to next in list
                                        val nextIdx = (patients.indexOf(selectedPatient) + 1) % patients.size
                                        selectedPatient = patients[nextIdx]
                                    }
                                ) {
                                    Text("Change", color = VetRxPrimary, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                // 2. Clinical Findings & Diagnosis Card
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = VetRxSurfaceLowest),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, VetRxOutlineVariant.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(28.dp)
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(VetRxPrimaryFixed.copy(alpha = 0.4f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.MedicalServices, contentDescription = null, tint = VetRxPrimary, modifier = Modifier.size(16.dp))
                                }
                                Text(
                                    text = "Clinical Details",
                                    style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                    color = VetRxOnSurface
                                )
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            OutlinedTextField(
                                value = symptoms,
                                onValueChange = { symptoms = it },
                                label = { Text("Presenting Symptoms *") },
                                placeholder = { Text("Describe clinical signs, temperature, observation...") },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(10.dp),
                                maxLines = 3
                            )

                            Spacer(modifier = Modifier.height(10.dp))

                            OutlinedTextField(
                                value = diagnosis,
                                onValueChange = { diagnosis = it },
                                label = { Text("Definitive / Tentative Diagnosis *") },
                                placeholder = { Text("Enter diagnosis...") },
                                leadingIcon = { Icon(Icons.Default.Verified, contentDescription = null, tint = VetRxPrimary) },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(10.dp)
                            )
                        }
                    }
                }

                // 3. Medicines Core Section
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "Medicines & Rx Items",
                                    style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                                    color = VetRxOnSurface
                                )
                                Surface(
                                    shape = CircleShape,
                                    color = VetRxPrimary,
                                    contentColor = Color.White
                                ) {
                                    Text(
                                        text = "${medicineList.size}",
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }

                        // Action Buttons: + Add Medicine & Apply Treatment Package
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Button(
                                onClick = { showAddMedicineSheet = true },
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = VetRxPrimary),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(46.dp)
                            ) {
                                Icon(Icons.Default.AddCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Add Medicine", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                            }

                            FilledTonalButton(
                                onClick = { showPackagesSheet = true },
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.filledTonalButtonColors(containerColor = VetRxSurfaceContainer, contentColor = VetRxPrimary),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(46.dp)
                            ) {
                                Icon(Icons.Default.Inventory2, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Apply Package", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                            }
                        }
                    }
                }

                // Stacked Medicine Item Cards
                items(medicineList) { item ->
                    MedicineRowCard(
                        item = item,
                        onRemove = {
                            medicineList = medicineList.filter { it.id != item.id }
                        }
                    )
                }

                // 4. Owner Advice Card
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = VetRxSurfaceLowest),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, VetRxOutlineVariant.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(Icons.Default.SupportAgent, contentDescription = null, tint = VetRxTertiary)
                                Text(
                                    text = "Client Advice & Nursing Care",
                                    style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                    color = VetRxOnSurface
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = advice,
                                onValueChange = { advice = it },
                                placeholder = { Text("Dietary restrictions, bathing instructions, activity limits...") },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(10.dp),
                                maxLines = 3
                            )
                        }
                    }
                }

                // 5. Follow-Up Recheck Row
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
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(VetRxSecondaryFixed),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.CalendarToday, contentDescription = null, tint = VetRxOnSecondaryFixed, modifier = Modifier.size(18.dp))
                                }
                                Column {
                                    Text("Follow-up Recheck", style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold))
                                    Text("Clinical review & cytology recheck", style = MaterialTheme.typography.bodySmall, color = VetRxOnSurfaceVariant)
                                }
                            }

                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                listOf("3d", "5d", "7d", "14d").forEach { d ->
                                    val isSelected = followUpDays == d
                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = if (isSelected) VetRxPrimaryContainer else VetRxSurfaceLow,
                                        modifier = Modifier.clickable { followUpDays = d }
                                    ) {
                                        Text(
                                            text = d,
                                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                            color = if (isSelected) VetRxOnPrimaryContainer else VetRxOnSurface,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Final Action Buttons: Issue Prescription & Save Draft
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
                            onClick = {
                                val pat = selectedPatient ?: return@Button
                                val newRx = Prescription(
                                    rxNumber = "RX-2026-${(1000..9999).random()}",
                                    patientId = pat.id,
                                    patientName = pat.name,
                                    species = pat.species,
                                    breed = pat.breed,
                                    weightKg = pat.weightKg,
                                    ownerName = pat.ownerName,
                                    symptoms = symptoms.ifBlank { "Clinical Consultation" },
                                    diagnosis = diagnosis.ifBlank { "General Clinical Protocol" },
                                    items = medicineList,
                                    advice = advice,
                                    followUpDays = followUpDays,
                                    status = "Issued"
                                )
                                val saved = VetRxRepository.createPrescription(newRx)
                                isBuildingRx = false
                                onPrescriptionCreated(saved)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(54.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = VetRxPrimary)
                        ) {
                            Icon(Icons.Default.Check, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Issue Prescription", style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold))
                        }

                        OutlinedButton(
                            onClick = {
                                val pat = selectedPatient ?: return@OutlinedButton
                                val draftRx = Prescription(
                                    rxNumber = "RX-DRAFT-${(100..999).random()}",
                                    patientId = pat.id,
                                    patientName = pat.name,
                                    species = pat.species,
                                    breed = pat.breed,
                                    weightKg = pat.weightKg,
                                    ownerName = pat.ownerName,
                                    symptoms = symptoms,
                                    diagnosis = diagnosis,
                                    items = medicineList,
                                    advice = advice,
                                    status = "Draft"
                                )
                                VetRxRepository.createPrescription(draftRx)
                                isBuildingRx = false
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Save as Draft", style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }
        }
    } else {
        // Prescriptions Directory List
        Scaffold(
            floatingActionButton = {
                ExtendedFloatingActionButton(
                    onClick = {
                        selectedPatient = patients.firstOrNull()
                        isBuildingRx = true
                    },
                    containerColor = VetRxPrimary,
                    contentColor = Color.White,
                    icon = { Icon(Icons.Default.Add, contentDescription = null) },
                    text = { Text("New Prescription", fontWeight = FontWeight.Bold) },
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
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(VetRxSurfaceLowest)
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                ) {
                    Text(
                        text = "Prescriptions",
                        style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.Bold),
                        color = VetRxOnSurface
                    )
                    Text(
                        text = "Clinical treatment charts, issued medicines & digital scripts",
                        style = MaterialTheme.typography.bodySmall,
                        color = VetRxOnSurfaceVariant
                    )
                }

                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 96.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(prescriptions) { rx ->
                        PrescriptionDirectoryCard(
                            prescription = rx,
                            onViewClick = { onViewPrescription(rx) }
                        )
                    }
                }
            }
        }
    }

    // Modal Sheet to Add Medicine
    if (showAddMedicineSheet) {
        AddMedicineModalSheet(
            onDismiss = { showAddMedicineSheet = false },
            onAdd = { item ->
                medicineList = medicineList + item
                showAddMedicineSheet = false
            }
        )
    }

    // Modal Sheet to Select Treatment Package
    if (showPackagesSheet) {
        ModalBottomSheet(
            onDismissRequest = { showPackagesSheet = false },
            containerColor = VetRxSurfaceLowest
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp)
            ) {
                Text(
                    text = "Apply Treatment Package",
                    style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold)
                )
                Text(
                    text = "Instantly load standardized pharmaceutical bundles",
                    style = MaterialTheme.typography.bodySmall,
                    color = VetRxOnSurfaceVariant
                )
                Spacer(modifier = Modifier.height(14.dp))

                treatmentPackages.forEach { pkg ->
                    Surface(
                        onClick = {
                            diagnosis = pkg.diagnosis
                            medicineList = medicineList + pkg.items
                            showPackagesSheet = false
                        },
                        shape = RoundedCornerShape(12.dp),
                        color = VetRxSurfaceLow,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(pkg.name, style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold))
                                Surface(shape = CircleShape, color = VetRxTertiaryFixed) {
                                    Text(
                                        "${pkg.items.size} meds",
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                        color = VetRxTertiary,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                            Text(pkg.description, style = MaterialTheme.typography.bodySmall, color = VetRxOnSurfaceVariant)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun MedicineRowCard(
    item: PrescriptionItem,
    onRemove: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = VetRxSurfaceLowest),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, VetRxOutlineVariant.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = item.medicineName,
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                        color = VetRxOnSurface
                    )
                    Text(
                        text = "${item.dosage} • ${item.route} • ${item.frequency} • ${item.durationDays} days",
                        style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                        color = VetRxPrimary
                    )
                }

                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = VetRxSurfaceLow
                ) {
                    Text(
                        text = "Qty: ${item.quantity}",
                        style = VetRxDataMono,
                        color = VetRxOnSurface,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Surface(
                shape = RoundedCornerShape(8.dp),
                color = VetRxSurfaceLow.copy(alpha = 0.7f),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(Icons.Default.Restaurant, contentDescription = null, tint = VetRxTertiary, modifier = Modifier.size(14.dp))
                    Text(
                        text = "Instructions: ${item.instructions}",
                        style = MaterialTheme.typography.bodySmall,
                        color = VetRxOnSurfaceVariant
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(onClick = onRemove) {
                    Icon(Icons.Default.Delete, contentDescription = null, tint = VetRxError, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Remove", color = VetRxError, style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable
private fun PrescriptionDirectoryCard(
    prescription: Prescription,
    onViewClick: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = VetRxSurfaceLowest),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, VetRxOutlineVariant.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
            .clickable { onViewClick() }
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = prescription.patientName,
                            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                            color = VetRxOnSurface
                        )
                        Surface(
                            shape = CircleShape,
                            color = if (prescription.status == "Issued") VetRxTertiaryFixed else VetRxAmberContainer
                        ) {
                            Text(
                                text = prescription.status,
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp, fontWeight = FontWeight.Bold),
                                color = if (prescription.status == "Issued") VetRxTertiary else VetRxAmberDark,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                    Text(
                        text = "${prescription.species} • ${prescription.breed} • Owner: ${prescription.ownerName}",
                        style = MaterialTheme.typography.bodySmall,
                        color = VetRxOnSurfaceVariant
                    )
                }

                Text(
                    text = prescription.rxNumber,
                    style = VetRxDataMono,
                    color = VetRxPrimary
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Surface(
                shape = RoundedCornerShape(8.dp),
                color = VetRxSurfaceLow,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "Diagnosis: ${prescription.diagnosis}",
                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
                    color = VetRxOnSurface,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${prescription.items.size} prescribed items",
                    style = MaterialTheme.typography.labelSmall,
                    color = VetRxOutline
                )
                TextButton(onClick = onViewClick) {
                    Text("View Rx", color = VetRxPrimary, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddMedicineModalSheet(
    onDismiss: () -> Unit,
    onAdd: (PrescriptionItem) -> Unit
) {
    var medName by remember { mutableStateOf("") }
    var dosage by remember { mutableStateOf("1 tablet") }
    var route by remember { mutableStateOf("PO") }
    var frequency by remember { mutableStateOf("BID") }
    var durationDaysStr by remember { mutableStateOf("5") }
    var quantityStr by remember { mutableStateOf("10") }
    var instructions by remember { mutableStateOf("Give after food.") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = VetRxSurfaceLowest
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp)
        ) {
            Text(
                text = "Add Medicine to Prescription",
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold)
            )
            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = medName,
                onValueChange = { medName = it },
                label = { Text("Medicine Name / Formulation *") },
                placeholder = { Text("e.g. Amoxycillin 500mg, Meloxicam 20mg/ml") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp)
            )

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = dosage,
                    onValueChange = { dosage = it },
                    label = { Text("Dosage") },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp)
                )
                OutlinedTextField(
                    value = route,
                    onValueChange = { route = it },
                    label = { Text("Route (PO/SC/IM/IV)") },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = frequency,
                    onValueChange = { frequency = it },
                    label = { Text("Frequency (SID/BID/TID)") },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp)
                )
                OutlinedTextField(
                    value = durationDaysStr,
                    onValueChange = { durationDaysStr = it },
                    label = { Text("Duration (Days)") },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = instructions,
                onValueChange = { instructions = it },
                label = { Text("SIG / Owner Administration Instructions") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = {
                    if (medName.isNotBlank()) {
                        val item = PrescriptionItem(
                            medicineName = medName,
                            dosage = dosage,
                            route = route,
                            frequency = frequency,
                            durationDays = durationDaysStr.toIntOrNull() ?: 5,
                            quantity = quantityStr.toIntOrNull() ?: 10,
                            instructions = instructions
                        )
                        onAdd(item)
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = VetRxPrimary)
            ) {
                Text("Add Medicine", style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold))
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
