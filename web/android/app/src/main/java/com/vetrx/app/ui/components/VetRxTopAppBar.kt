package com.vetrx.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Pets
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vetrx.app.ui.theme.*

// ==============================================================================
// VetRx Top App Bar — Native Mobile Clinical Header
// Based on Stitch Header with Brand Mark, Practice Title & Sync Indicator
// ==============================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VetRxTopAppBar(
    modifier: Modifier = Modifier,
    onNotificationsClick: () -> Unit = {},
    onProfileClick: () -> Unit = {}
) {
    Surface(
        color = VetRxSurfaceLowest,
        shadowElevation = 2.dp,
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Brand Logo & Practice Identity
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(VetRxPrimary),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Pets,
                        contentDescription = "VetRx",
                        tint = Color.White,
                        modifier = Modifier.size(22.dp)
                    )
                }

                Column {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = "VetRx",
                            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                            color = VetRxOnSurface
                        )
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = VetRxPrimaryFixed.copy(alpha = 0.4f)
                        ) {
                            Text(
                                text = "CLINICAL",
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp),
                                color = VetRxPrimary,
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                            )
                        }
                    }
                    Text(
                        text = "Oakwood Animal Hospital",
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                        color = VetRxOnSurfaceVariant
                    )
                }
            }

            // Sync Indicator, Notifications & Profile Avatar
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                SyncStatusBadge()

                IconButton(
                    onClick = onNotificationsClick,
                    modifier = Modifier.size(36.dp)
                ) {
                    Box {
                        Icon(
                            imageVector = Icons.Default.Notifications,
                            contentDescription = "Notifications",
                            tint = VetRxOnSurfaceVariant,
                            modifier = Modifier.size(20.dp)
                        )
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(VetRxPrimary)
                                .align(Alignment.TopEnd)
                        )
                    }
                }

                // Doctor Profile Avatar with green active shift badge
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(VetRxSecondaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "SJ",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = VetRxOnSecondaryContainer
                    )
                    Box(
                        modifier = Modifier
                            .size(9.dp)
                            .clip(CircleShape)
                            .background(VetRxTertiary)
                            .align(Alignment.BottomEnd)
                    )
                }
            }
        }
    }
}
