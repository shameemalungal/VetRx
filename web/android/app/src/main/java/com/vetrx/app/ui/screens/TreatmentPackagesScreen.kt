package com.vetrx.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Medication
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vetrx.app.data.models.PrescriptionItem
import com.vetrx.app.data.models.TreatmentPackage
import com.vetrx.app.data.repository.VetRxRepository
import com.vetrx.app.ui.theme.*

// ==============================================================================
// VetRx Treatment Packages Screen — Protocol Library & Quick Script Bundles
// Faithfully implements Stitch `vetrx_treatment_packages_mobile`
// ==============================================================================

@Composable
fun TreatmentPackagesScreen(
    onApplyPackageToRx: (TreatmentPackage) -> Unit
) {
    val packages by VetRxRepository.treatmentPackages.collectAsState()
    var showCreatePackageDialog by remember { mutableStateOf(false) }

    Scaffold(
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showCreatePackageDialog = true },
                containerColor = VetRxPrimary,
                contentColor = Color.White,
                icon = { Icon(Icons.Default.Add, contentDescription = null) },
                text = { Text("New Package", fontWeight = FontWeight.Bold) },
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
                    text = "Treatment Packages",
                    style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.Bold),
                    color = VetRxOnSurface
                )
                Text(
                    text = "Pre-configured clinical drug protocols for instant prescription population",
                    style = MaterialTheme.typography.bodySmall,
                    color = VetRxOnSurfaceVariant
                )
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 96.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(packages) { pkg ->
                    TreatmentPackageCard(
                        pkg = pkg,
                        onApply = { onApplyPackageToRx(pkg) }
                    )
                }
            }
        }
    }
}

@Composable
private fun TreatmentPackageCard(
    pkg: TreatmentPackage,
    onApply: () -> Unit
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
                            .size(42.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(VetRxTertiaryFixed.copy(alpha = 0.4f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Inventory2, contentDescription = null, tint = VetRxTertiary, modifier = Modifier.size(22.dp))
                    }
                    Column {
                        Text(
                            text = pkg.name,
                            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                            color = VetRxOnSurface
                        )
                        Text(
                            text = "${pkg.species} • ${pkg.diagnosis}",
                            style = MaterialTheme.typography.bodySmall,
                            color = VetRxOnSurfaceVariant
                        )
                    }
                }

                Surface(
                    shape = CircleShape,
                    color = VetRxTertiaryFixed
                ) {
                    Text(
                        text = "${pkg.items.size} meds",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = VetRxTertiary,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = pkg.description,
                style = MaterialTheme.typography.bodySmall,
                color = VetRxOnSurfaceVariant
            )
            Spacer(modifier = Modifier.height(10.dp))

            // Medicine Chips Preview
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(VetRxSurfaceLow)
                    .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                pkg.items.forEach { med ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(Icons.Default.Medication, contentDescription = null, tint = VetRxPrimary, modifier = Modifier.size(14.dp))
                            Text(
                                text = med.medicineName,
                                style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                                color = VetRxOnSurface
                            )
                        }
                        Text(
                            text = "${med.dosage} • ${med.frequency}",
                            style = VetRxDataMono.copy(fontSize = 11.sp),
                            color = VetRxPrimary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Button(
                onClick = onApply,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = VetRxPrimary),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(42.dp)
            ) {
                Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Apply to Active Prescription", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
            }
        }
    }
}
