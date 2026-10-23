package com.vetrx.app.ui.screens

import android.content.Intent
import android.net.Uri
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
import com.vetrx.app.data.models.Owner
import com.vetrx.app.data.models.Patient
import com.vetrx.app.data.repository.VetRxRepository
import com.vetrx.app.ui.theme.*

// ==============================================================================
// VetRx Owners & Patients Screen — Native Clinical Directory
// Includes one-tap Call Integration, Navigation Intent & Prescription Launch
// ==============================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnersAndPatientsScreen(
    onPatientClick: (Patient) -> Unit,
    onNewPrescriptionForPatient: (Patient) -> Unit
) {
    val context = LocalContext.current
    val patients by VetRxRepository.patients.collectAsState()
    val owners by VetRxRepository.owners.collectAsState()

    var searchQuery by remember { mutableStateOf("") }
    var selectedFilter by remember { mutableStateOf("All") }
    var showAddPatientSheet by remember { mutableStateOf(false) }

    val filters = listOf("All", "Canine", "Feline", "Bovine", "Equine")

    val filteredPatients = patients.filter { patient ->
        val matchesFilter = if (selectedFilter == "All") true else patient.species.equals(selectedFilter, ignoreCase = true)
        val matchesSearch = searchQuery.isBlank() ||
                patient.name.contains(searchQuery, ignoreCase = true) ||
                patient.ownerName.contains(searchQuery, ignoreCase = true) ||
                patient.ownerPhone.contains(searchQuery, ignoreCase = true)
        matchesFilter && matchesSearch
    }

    Scaffold(
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showAddPatientSheet = true },
                containerColor = VetRxPrimary,
                contentColor = Color.White,
                icon = { Icon(Icons.Default.Add, contentDescription = null) },
                text = { Text("New Patient", fontWeight = FontWeight.Bold) },
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
            // Screen Header & Search Bar
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(VetRxSurfaceLowest)
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                Text(
                    text = "Patients & Clients",
                    style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.Bold),
                    color = VetRxOnSurface
                )
                Text(
                    text = "Search registered animals, medical records & owner contacts",
                    style = MaterialTheme.typography.bodySmall,
                    color = VetRxOnSurfaceVariant
                )

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search by pet, owner name, or phone...") },
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = null, tint = VetRxOutline)
                    },
                    trailingIcon = {
                        if (searchQuery.isNotBlank()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Clear, contentDescription = "Clear", tint = VetRxOutline)
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = VetRxPrimary,
                        unfocusedBorderColor = VetRxOutlineVariant,
                        focusedContainerColor = VetRxSurfaceLow,
                        unfocusedContainerColor = VetRxSurfaceLow
                    ),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Species Filter Chips
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(filters) { filter ->
                        val isSelected = selectedFilter == filter
                        FilterChip(
                            selected = isSelected,
                            onClick = { selectedFilter = filter },
                            label = { Text(filter) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = VetRxPrimaryContainer,
                                selectedLabelColor = VetRxOnPrimaryContainer
                            ),
                            shape = RoundedCornerShape(8.dp)
                        )
                    }
                }
            }

            // Patient List
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 96.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filteredPatients) { patient ->
                    val owner = owners.firstOrNull { it.id == patient.ownerId }

                    PatientCard(
                        patient = patient,
                        owner = owner,
                        onCardClick = { onPatientClick(patient) },
                        onCallClick = {
                            CallLifecycleManager.initiateCall(
                                context = context,
                                phoneNumber = patient.ownerPhone,
                                owner = owner,
                                patient = patient
                            )
                        },
                        onNavigateClick = {
                            val address = owner?.address ?: "Bangalore, India"
                            val mapIntent = Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=${Uri.encode(address)}")).apply {
                                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                            }
                            try {
                                context.startActivity(mapIntent)
                            } catch (e: Exception) {
                                // Maps not installed
                            }
                        },
                        onNewRxClick = { onNewPrescriptionForPatient(patient) }
                    )
                }
            }
        }
    }

    if (showAddPatientSheet) {
        AddPatientModalSheet(
            onDismiss = { showAddPatientSheet = false },
            onSave = { newPatient, newOwner ->
                newOwner?.let { VetRxRepository.addOwner(it) }
                VetRxRepository.addPatient(newPatient)
                showAddPatientSheet = false
            }
        )
    }
}

@Composable
private fun PatientCard(
    patient: Patient,
    owner: Owner?,
    onCardClick: () -> Unit,
    onCallClick: () -> Unit,
    onNavigateClick: () -> Unit,
    onNewRxClick: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = VetRxSurfaceLowest),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, VetRxOutlineVariant.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
            .clickable { onCardClick() }
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
                            .size(44.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(
                                when (patient.species.lowercase()) {
                                    "feline" -> VetRxSecondaryContainer.copy(alpha = 0.3f)
                                    "bovine" -> VetRxTertiaryFixed.copy(alpha = 0.3f)
                                    else -> VetRxPrimaryFixed.copy(alpha = 0.3f)
                                }
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Pets,
                            contentDescription = null,
                            tint = when (patient.species.lowercase()) {
                                "feline" -> VetRxSecondary
                                "bovine" -> VetRxTertiary
                                else -> VetRxPrimary
                            },
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Column {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = patient.name,
                                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                color = VetRxOnSurface
                            )
                            Surface(
                                shape = CircleShape,
                                color = VetRxTertiaryFixed.copy(alpha = 0.5f)
                            ) {
                                Text(
                                    text = patient.status,
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp, fontWeight = FontWeight.Bold),
                                    color = VetRxTertiary,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Text(
                            text = "${patient.species} • ${patient.breed} • ${patient.gender} • ${patient.ageYears}",
                            style = MaterialTheme.typography.bodySmall,
                            color = VetRxOnSurfaceVariant
                        )
                    }
                }

                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = VetRxSurfaceLow
                ) {
                    Text(
                        text = "${patient.weightKg} kg",
                        style = VetRxDataMono,
                        color = VetRxOnSurface,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Owner Details Row
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = VetRxSurfaceLow,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(Icons.Default.Person, contentDescription = null, tint = VetRxOutline, modifier = Modifier.size(16.dp))
                        Text(
                            text = patient.ownerName,
                            style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                            color = VetRxOnSurface
                        )
                    }
                    Text(
                        text = patient.ownerPhone,
                        style = VetRxDataMono,
                        color = VetRxPrimary
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Action Buttons: Call, Maps Navigation, + New Prescription
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // One-tap native call action with telemetry
                Button(
                    onClick = onCallClick,
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = VetRxPrimaryContainer,
                        contentColor = VetRxOnPrimaryContainer
                    ),
                    contentPadding = PaddingValues(horizontal = 12.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(38.dp)
                ) {
                    Icon(Icons.Default.Call, contentDescription = "Call", modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Call", style = MaterialTheme.typography.labelMedium)
                }

                OutlinedButton(
                    onClick = onNavigateClick,
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = VetRxSecondary),
                    contentPadding = PaddingValues(horizontal = 12.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(38.dp)
                ) {
                    Icon(Icons.Default.Navigation, contentDescription = "Navigate", modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Map", style = MaterialTheme.typography.labelMedium)
                }

                FilledTonalButton(
                    onClick = onNewRxClick,
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.filledTonalButtonColors(
                        containerColor = VetRxPrimaryFixed.copy(alpha = 0.4f),
                        contentColor = VetRxOnPrimaryFixedVariant
                    ),
                    contentPadding = PaddingValues(horizontal = 12.dp),
                    modifier = Modifier
                        .weight(1.2f)
                        .height(38.dp)
                ) {
                    Icon(Icons.Default.Medication, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("+ New Rx", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddPatientModalSheet(
    onDismiss: () -> Unit,
    onSave: (Patient, Owner?) -> Unit
) {
    var petName by remember { mutableStateOf("") }
    var species by remember { mutableStateOf("Canine") }
    var breed by remember { mutableStateOf("") }
    var weightStr by remember { mutableStateOf("") }
    var ownerName by remember { mutableStateOf("") }
    var ownerPhone by remember { mutableStateOf("") }
    var ownerAddress by remember { mutableStateOf("") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = VetRxSurfaceLowest,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp)
        ) {
            Text(
                text = "Register New Patient",
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                color = VetRxOnSurface
            )
            Text(
                text = "Add animal signalment and owner contact information",
                style = MaterialTheme.typography.bodySmall,
                color = VetRxOnSurfaceVariant
            )

            Spacer(modifier = Modifier.height(14.dp))

            OutlinedTextField(
                value = petName,
                onValueChange = { petName = it },
                label = { Text("Patient / Animal Name *") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp)
            )

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = species,
                    onValueChange = { species = it },
                    label = { Text("Species *") },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp)
                )
                OutlinedTextField(
                    value = breed,
                    onValueChange = { breed = it },
                    label = { Text("Breed") },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = weightStr,
                onValueChange = { weightStr = it },
                label = { Text("Weight (kg)") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp)
            )

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = ownerName,
                onValueChange = { ownerName = it },
                label = { Text("Owner / Client Name *") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp)
            )

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = ownerPhone,
                onValueChange = { ownerPhone = it },
                label = { Text("Phone Number *") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp)
            )

            Spacer(modifier = Modifier.height(18.dp))

            Button(
                onClick = {
                    if (petName.isNotBlank() && ownerName.isNotBlank() && ownerPhone.isNotBlank()) {
                        val ownerId = "own-${System.currentTimeMillis()}"
                        val newOwner = Owner(
                            id = ownerId,
                            name = ownerName,
                            phone = ownerPhone,
                            address = ownerAddress.ifBlank { null }
                        )
                        val newPatient = Patient(
                            name = petName,
                            species = species,
                            breed = breed.ifBlank { "Mixed" },
                            gender = "M",
                            ageYears = "Adult",
                            weightKg = weightStr.toDoubleOrNull() ?: 15.0,
                            ownerId = ownerId,
                            ownerName = ownerName,
                            ownerPhone = ownerPhone
                        )
                        onSave(newPatient, newOwner)
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = VetRxPrimary)
            ) {
                Text("Save Patient", style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold))
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
