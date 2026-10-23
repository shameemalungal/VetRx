package com.vetrx.app.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vetrx.app.ui.theme.*

// ==============================================================================
// VetRx Bottom Navigation Bar — Primary Mobile Destinations
// Matches Stitch Bottom Navigation specifications
// ==============================================================================

enum class BottomNavDestination(
    val label: String,
    val icon: ImageVector,
    val route: String
) {
    DASHBOARD("Home", Icons.Default.Dashboard, "dashboard"),
    PATIENTS("Patients", Icons.Default.Pets, "patients"),
    PRESCRIPTIONS("Rx", Icons.Default.Medication, "prescriptions"),
    CALLS("Calls", Icons.Default.PhoneInTalk, "calls"),
    INVOICES("Invoices", Icons.Default.ReceiptLong, "invoices")
}

@Composable
fun VetRxBottomNav(
    currentRoute: String,
    onNavigate: (BottomNavDestination) -> Unit,
    modifier: Modifier = Modifier
) {
    NavigationBar(
        containerColor = VetRxSurfaceLowest,
        tonalElevation = 6.dp,
        modifier = modifier
    ) {
        BottomNavDestination.values().forEach { destination ->
            val isSelected = currentRoute == destination.route
            NavigationBarItem(
                selected = isSelected,
                onClick = { onNavigate(destination) },
                icon = {
                    Icon(
                        imageVector = destination.icon,
                        contentDescription = destination.label,
                        modifier = Modifier.size(22.dp)
                    )
                },
                label = {
                    Text(
                        text = destination.label,
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                        )
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = VetRxPrimary,
                    selectedTextColor = VetRxPrimary,
                    indicatorColor = VetRxPrimaryFixed.copy(alpha = 0.35f),
                    unselectedIconColor = VetRxOnSurfaceVariant,
                    unselectedTextColor = VetRxOnSurfaceVariant
                )
            )
        }
    }
}
