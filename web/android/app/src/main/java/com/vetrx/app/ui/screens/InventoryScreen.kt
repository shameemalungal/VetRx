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
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vetrx.app.data.models.InventoryItem
import com.vetrx.app.data.repository.VetRxRepository
import com.vetrx.app.ui.theme.*

// ==============================================================================
// VetRx Inventory Screen — Medicine Stock, Batch Expiry & Reorder Levels
// ==============================================================================

@Composable
fun InventoryScreen() {
    val inventory by VetRxRepository.inventory.collectAsState()

    Scaffold(
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
                    text = "Inventory & Pharmacy",
                    style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.Bold),
                    color = VetRxOnSurface
                )
                Text(
                    text = "Stock on hand, batch numbers, dispensing units & reorder alerts",
                    style = MaterialTheme.typography.bodySmall,
                    color = VetRxOnSurfaceVariant
                )
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 96.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(inventory) { item ->
                    InventoryRowCard(item = item)
                }
            }
        }
    }
}

@Composable
private fun InventoryRowCard(item: InventoryItem) {
    val isLowStock = item.stockOnHand <= item.reorderLevel

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
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = item.name,
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                        color = VetRxOnSurface
                    )
                    Text(
                        text = "${item.category} • Batch: ${item.batchNumber}",
                        style = MaterialTheme.typography.bodySmall,
                        color = VetRxOnSurfaceVariant
                    )
                }

                Surface(
                    shape = CircleShape,
                    color = if (isLowStock) VetRxAmberContainer else VetRxTertiaryFixed
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        if (isLowStock) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = VetRxAmberDark, modifier = Modifier.size(12.dp))
                        }
                        Text(
                            text = if (isLowStock) "Low Stock" else "In Stock",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                            color = if (isLowStock) VetRxAmberDark else VetRxTertiary
                        )
                    }
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
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("Stock on Hand", style = MaterialTheme.typography.labelSmall, color = VetRxOutline)
                        Text("${item.stockOnHand} ${item.unit}", style = VetRxDataMono.copy(fontWeight = FontWeight.Bold), color = if (isLowStock) VetRxError else VetRxOnSurface)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Reorder At", style = MaterialTheme.typography.labelSmall, color = VetRxOutline)
                        Text("${item.reorderLevel} ${item.unit}", style = VetRxDataMono)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Expiry", style = MaterialTheme.typography.labelSmall, color = VetRxOutline)
                        Text(item.expiryDate, style = VetRxDataMono, color = VetRxPrimary)
                    }
                }
            }
        }
    }
}
