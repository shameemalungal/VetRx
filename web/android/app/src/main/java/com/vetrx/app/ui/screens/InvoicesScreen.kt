package com.vetrx.app.ui.screens

import android.content.Intent
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vetrx.app.data.models.Invoice
import com.vetrx.app.data.models.InvoiceCategory
import com.vetrx.app.data.models.InvoiceLineItem
import com.vetrx.app.data.models.InvoiceStatus
import com.vetrx.app.data.repository.VetRxRepository
import com.vetrx.app.ui.theme.*
import java.text.NumberFormat
import java.util.*

// ==============================================================================
// VetRx Invoices Screen — Billing, Tax Invoices & Line Items in INR (₹)
// Faithfully implements Stitch `vetrx_create_invoice_mobile` and `vetrx_invoices_history_mobile`
// ==============================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoicesScreen(
    onCreateInvoiceClick: () -> Unit
) {
    val context = LocalContext.current
    val invoices by VetRxRepository.invoices.collectAsState()
    val patients by VetRxRepository.patients.collectAsState()

    var isCreatingInvoice by remember { mutableStateOf(false) }
    var selectedPatient by remember { mutableStateOf(patients.firstOrNull()) }

    // Invoice Builder state
    var lineItems by remember {
        mutableStateOf(
            listOf(
                InvoiceLineItem("Consultation & Otoscopic Exam", InvoiceCategory.CONSULTATION, 1, 500.0),
                InvoiceLineItem("Posatex Otic Drops 15ml", InvoiceCategory.MEDICINE, 1, 750.0),
                InvoiceLineItem("Amoxycillin 500mg (10 tabs)", InvoiceCategory.MEDICINE, 1, 350.0)
            )
        )
    }

    var showAddItemDialog by remember { mutableStateOf(false) }

    val inrFormat = remember {
        NumberFormat.getCurrencyInstance(Locale("en", "IN"))
    }

    val subtotal = lineItems.sumOf { it.amount }
    val tax = 0.0
    val total = subtotal + tax

    if (isCreatingInvoice) {
        Scaffold(
            topBar = {
                Surface(color = VetRxSurfaceLowest, shadowElevation = 2.dp) {
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
                            IconButton(onClick = { isCreatingInvoice = false }) {
                                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = VetRxPrimary)
                            }
                            Column {
                                Text(
                                    text = "Create Tax Invoice",
                                    style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                    color = VetRxOnSurface
                                )
                                Text(
                                    text = "Billing items & clinical charges",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = VetRxOnSurfaceVariant
                                )
                            }
                        }
                        TextButton(onClick = { isCreatingInvoice = false }) {
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
                // 1. Patient & Case Summary Bento Card
                item {
                    selectedPatient?.let { pat ->
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
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(44.dp)
                                                .clip(CircleShape)
                                                .background(VetRxPrimaryContainer),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Icon(Icons.Default.Pets, contentDescription = null, tint = VetRxOnPrimaryContainer)
                                        }
                                        Column {
                                            Text(
                                                text = pat.name,
                                                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                                color = VetRxOnSurface
                                            )
                                            Text(
                                                text = "${pat.species} • ${pat.breed} • ${pat.weightKg} kg",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = VetRxOnSurfaceVariant
                                            )
                                        }
                                    }

                                    Surface(shape = CircleShape, color = VetRxPrimaryFixed.copy(alpha = 0.5f)) {
                                        Text(
                                            text = "Active Patient",
                                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                            color = VetRxPrimary,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(10.dp))

                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(VetRxSurfaceLow)
                                        .padding(10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text("Owner", style = MaterialTheme.typography.labelSmall, color = VetRxOutline)
                                        Text(pat.ownerName, style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold))
                                    }
                                    Column(horizontalAlignment = Alignment.End) {
                                        Text("Prescription", style = MaterialTheme.typography.labelSmall, color = VetRxOutline)
                                        Text("RX-2026-0892", style = VetRxDataMono, color = VetRxPrimary)
                                    }
                                }
                            }
                        }
                    }
                }

                // 2. Treatment & Services Section Header
                item {
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
                                text = "Treatment & Services",
                                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                                color = VetRxOnSurface
                            )
                            Surface(shape = CircleShape, color = VetRxSurfaceHigh) {
                                Text(
                                    text = "${lineItems.size}",
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }

                        Button(
                            onClick = { showAddItemDialog = true },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = VetRxPrimary),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                            modifier = Modifier.height(36.dp)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Add Item", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold))
                        }
                    }
                }

                // Line Items
                items(lineItems) { item ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = VetRxSurfaceLowest),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, VetRxOutlineVariant.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = item.description,
                                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                                    color = VetRxOnSurface
                                )
                                Text(
                                    text = "${item.category.name} • ${item.quantity} × ${inrFormat.format(item.unitPrice)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = VetRxOnSurfaceVariant
                                )
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = inrFormat.format(item.amount),
                                    style = VetRxDataMono.copy(fontWeight = FontWeight.Bold),
                                    color = VetRxOnSurface
                                )
                                IconButton(
                                    onClick = { lineItems = lineItems.filter { it != item } },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = VetRxError, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                }

                // 3. Totals & Payment Summary Card
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = VetRxSurfaceLowest),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, VetRxOutlineVariant.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
                    ) {
                        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Subtotal", style = MaterialTheme.typography.bodyMedium, color = VetRxOnSurfaceVariant)
                                Text(inrFormat.format(subtotal), style = VetRxDataMono)
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Taxes & Cess (GST)", style = MaterialTheme.typography.bodyMedium, color = VetRxOnSurfaceVariant)
                                Text(inrFormat.format(tax), style = VetRxDataMono)
                            }
                            HorizontalDivider(color = VetRxOutlineVariant.copy(alpha = 0.5f))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Total Payable Amount",
                                    style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                    color = VetRxOnSurface
                                )
                                Text(
                                    text = inrFormat.format(total),
                                    style = VetRxDataMono.copy(fontSize = 18.sp, fontWeight = FontWeight.Bold),
                                    color = VetRxPrimary
                                )
                            }
                        }
                    }
                }

                // 4. Final Save & Issue Button
                item {
                    Button(
                        onClick = {
                            val pat = selectedPatient ?: return@Button
                            val newInv = Invoice(
                                invoiceNumber = "INV-2026-${(10000..99999).random()}",
                                rxNumber = "RX-2026-0892",
                                patientName = pat.name,
                                ownerName = pat.ownerName,
                                ownerPhone = pat.ownerPhone,
                                status = InvoiceStatus.Issued,
                                items = lineItems,
                                subtotal = subtotal,
                                tax = tax,
                                total = total,
                                paidAmount = total
                            )
                            VetRxRepository.createInvoice(newInv)
                            isCreatingInvoice = false
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = VetRxPrimary)
                    ) {
                        Icon(Icons.Default.Receipt, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Generate & Issue Invoice", style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold))
                    }
                }
            }
        }
    } else {
        // Invoices History Directory
        Scaffold(
            floatingActionButton = {
                ExtendedFloatingActionButton(
                    onClick = {
                        selectedPatient = patients.firstOrNull()
                        isCreatingInvoice = true
                    },
                    containerColor = VetRxPrimary,
                    contentColor = Color.White,
                    icon = { Icon(Icons.Default.Add, contentDescription = null) },
                    text = { Text("New Invoice", fontWeight = FontWeight.Bold) },
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
                        text = "Invoices & Billing",
                        style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.Bold),
                        color = VetRxOnSurface
                    )
                    Text(
                        text = "Practice billing ledgers, GST tax invoices & client settlements",
                        style = MaterialTheme.typography.bodySmall,
                        color = VetRxOnSurfaceVariant
                    )
                }

                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 96.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(invoices) { inv ->
                        InvoiceHistoryCard(
                            invoice = inv,
                            inrFormat = inrFormat,
                            onShareClick = {
                                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_SUBJECT, "VetRx Invoice ${inv.invoiceNumber}")
                                    putExtra(Intent.EXTRA_TEXT, "VetRx Tax Invoice: ${inv.invoiceNumber}\nPatient: ${inv.patientName}\nOwner: ${inv.ownerName}\nTotal: ${inrFormat.format(inv.total)}\nStatus: ${inv.status.name}\nOakwood Animal Hospital")
                                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                }
                                context.startActivity(Intent.createChooser(shareIntent, "Share Invoice via"))
                            }
                        )
                    }
                }
            }
        }
    }

    // Modal Dialog to Add Line Item
    if (showAddItemDialog) {
        var desc by remember { mutableStateOf("") }
        var priceStr by remember { mutableStateOf("") }
        var category by remember { mutableStateOf(InvoiceCategory.MEDICINE) }

        AlertDialog(
            onDismissRequest = { showAddItemDialog = false },
            title = { Text("Add Billing Item", style = MaterialTheme.typography.headlineSmall) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = desc,
                        onValueChange = { desc = it },
                        label = { Text("Description / Service *") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp)
                    )
                    OutlinedTextField(
                        value = priceStr,
                        onValueChange = { priceStr = it },
                        label = { Text("Amount (₹) *") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp)
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val price = priceStr.toDoubleOrNull() ?: 0.0
                        if (desc.isNotBlank() && price > 0) {
                            lineItems = lineItems + InvoiceLineItem(desc, category, 1, price)
                            showAddItemDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = VetRxPrimary)
                ) {
                    Text("Add Item")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddItemDialog = false }) {
                    Text("Cancel", color = VetRxOutline)
                }
            }
        )
    }
}

@Composable
private fun InvoiceHistoryCard(
    invoice: Invoice,
    inrFormat: NumberFormat,
    onShareClick: () -> Unit
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
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(Icons.Default.Receipt, contentDescription = null, tint = VetRxOutline, modifier = Modifier.size(18.dp))
                    Text(
                        text = invoice.invoiceNumber,
                        style = VetRxDataMono.copy(fontWeight = FontWeight.Bold),
                        color = VetRxOnSurface
                    )
                }

                Surface(
                    shape = CircleShape,
                    color = VetRxTertiaryFixed,
                    contentColor = VetRxOnTertiaryFixedVariant
                ) {
                    Text(
                        text = invoice.status.name,
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

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
                    Text(
                        text = "${invoice.patientName} • ${invoice.ownerName}",
                        style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                        color = VetRxPrimary
                    )
                    Text(
                        text = inrFormat.format(invoice.total),
                        style = VetRxDataMono.copy(fontWeight = FontWeight.Bold),
                        color = VetRxOnSurface
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${invoice.items.size} line items",
                    style = MaterialTheme.typography.bodySmall,
                    color = VetRxOutline
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilledTonalButton(
                        onClick = onShareClick,
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = VetRxSurfaceContainer,
                            contentColor = VetRxPrimary
                        ),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(34.dp)
                    ) {
                        Icon(Icons.Default.Share, contentDescription = "Share", modifier = Modifier.size(15.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Share", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold))
                    }
                }
            }
        }
    }
}
