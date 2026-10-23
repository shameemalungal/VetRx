package com.vetrx.app

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.vetrx.app.call.CallLifecycleManager
import com.vetrx.app.call.PostCallRegistrationSheet
import com.vetrx.app.data.models.Patient
import com.vetrx.app.data.models.Prescription
import com.vetrx.app.ui.components.BottomNavDestination
import com.vetrx.app.ui.components.VetRxBottomNav
import com.vetrx.app.ui.components.VetRxTopAppBar
import com.vetrx.app.ui.screens.*
import com.vetrx.app.ui.theme.VetRxTheme

// ==============================================================================
// VetRx Native Android Application Root Compose Component
// Orchestrates Native Navigation, Top/Bottom Bars & Post-Call Registration Sheet
// ==============================================================================

@Composable
fun VetRxApp() {
    val context = LocalContext.current
    var currentRoute by remember { mutableStateOf(BottomNavDestination.DASHBOARD.route) }
    var selectedPatientForRx by remember { mutableStateOf<Patient?>(null) }

    // Observe active call registration prompt session
    val pendingCallPrompt by CallLifecycleManager.pendingPromptSession.collectAsState()

    // Request essential runtime telephony and notification permissions on startup
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // Handle result silently or update settings status
    }

    LaunchedEffect(Unit) {
        val permissionsToRequest = mutableListOf(
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.CALL_PHONE
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        permissionLauncher.launch(permissionsToRequest.toTypedArray())
    }

    VetRxTheme {
        Scaffold(
            topBar = {
                VetRxTopAppBar(
                    onNotificationsClick = {
                        // Toggle settings / notifications
                        currentRoute = "settings"
                    },
                    onProfileClick = {
                        currentRoute = "settings"
                    }
                )
            },
            bottomBar = {
                VetRxBottomNav(
                    currentRoute = currentRoute,
                    onNavigate = { dest ->
                        currentRoute = dest.route
                    }
                )
            }
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                when (currentRoute) {
                    BottomNavDestination.DASHBOARD.route -> {
                        DashboardScreen(
                            onNewPrescriptionClick = {
                                selectedPatientForRx = null
                                currentRoute = BottomNavDestination.PRESCRIPTIONS.route
                            },
                            onAddPatientClick = {
                                currentRoute = BottomNavDestination.PATIENTS.route
                            },
                            onCreateInvoiceClick = {
                                currentRoute = BottomNavDestination.INVOICES.route
                            },
                            onTreatmentPackagesClick = {
                                currentRoute = "packages"
                            },
                            onViewPrescriptionClick = { rx ->
                                currentRoute = BottomNavDestination.PRESCRIPTIONS.route
                            },
                            onViewInvoiceClick = { inv ->
                                currentRoute = BottomNavDestination.INVOICES.route
                            },
                            onCallClick = { call ->
                                currentRoute = BottomNavDestination.CALLS.route
                            },
                            onViewAllRxClick = {
                                currentRoute = BottomNavDestination.PRESCRIPTIONS.route
                            },
                            onViewAllCallsClick = {
                                currentRoute = BottomNavDestination.CALLS.route
                            }
                        )
                    }

                    BottomNavDestination.PATIENTS.route -> {
                        OwnersAndPatientsScreen(
                            onPatientClick = { pat ->
                                selectedPatientForRx = pat
                                currentRoute = BottomNavDestination.PRESCRIPTIONS.route
                            },
                            onNewPrescriptionForPatient = { pat ->
                                selectedPatientForRx = pat
                                currentRoute = BottomNavDestination.PRESCRIPTIONS.route
                            }
                        )
                    }

                    BottomNavDestination.PRESCRIPTIONS.route -> {
                        PrescriptionsScreen(
                            initialSelectedPatient = selectedPatientForRx,
                            onPrescriptionCreated = { newRx ->
                                currentRoute = BottomNavDestination.INVOICES.route
                            },
                            onViewPrescription = { rx -> }
                        )
                    }

                    BottomNavDestination.CALLS.route -> {
                        CallsAndVisitsScreen(
                            onPatientClick = { patId ->
                                currentRoute = BottomNavDestination.PATIENTS.route
                            }
                        )
                    }

                    BottomNavDestination.INVOICES.route -> {
                        InvoicesScreen(
                            onCreateInvoiceClick = {}
                        )
                    }

                    "packages" -> {
                        TreatmentPackagesScreen(
                            onApplyPackageToRx = { pkg ->
                                currentRoute = BottomNavDestination.PRESCRIPTIONS.route
                            }
                        )
                    }

                    "inventory" -> {
                        InventoryScreen()
                    }

                    "settings" -> {
                        SettingsScreen()
                    }
                }

                // Smart Post-Call Registration Bottom Sheet Overlay
                pendingCallPrompt?.let { session ->
                    PostCallRegistrationSheet(
                        session = session,
                        onDismiss = {
                            CallLifecycleManager.dismissPrompt(context)
                        },
                        onNavigateToVisit = { callRecord ->
                            currentRoute = BottomNavDestination.CALLS.route
                        },
                        onNavigateToPatient = { patientId ->
                            currentRoute = BottomNavDestination.PATIENTS.route
                        }
                    )
                }
            }
        }
    }
}
