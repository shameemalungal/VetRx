package com.vetrx.app.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// Clinical light color scheme directly mapping Stitch tokens
private val VetRxLightColorScheme = lightColorScheme(
    primary = VetRxPrimary,
    onPrimary = VetRxOnPrimary,
    primaryContainer = VetRxPrimaryContainer,
    onPrimaryContainer = VetRxOnPrimaryContainer,
    inversePrimary = VetRxPrimaryFixedDim,

    secondary = VetRxSecondary,
    onSecondary = VetRxOnSecondary,
    secondaryContainer = VetRxSecondaryFixed,
    onSecondaryContainer = VetRxOnSecondaryContainer,

    tertiary = VetRxTertiary,
    onTertiary = VetRxOnTertiary,
    tertiaryContainer = VetRxTertiaryFixed,
    onTertiaryContainer = VetRxOnTertiaryFixedVariant,

    background = VetRxBackground,
    onBackground = VetRxOnSurface,
    surface = VetRxSurface,
    onSurface = VetRxOnSurface,
    surfaceVariant = VetRxSurfaceHighest,
    onSurfaceVariant = VetRxOnSurfaceVariant,

    surfaceTint = VetRxPrimary,
    inverseSurface = VetRxInverseSurface,
    inverseOnSurface = VetRxInverseOnSurface,

    error = VetRxError,
    onError = VetRxOnError,
    errorContainer = VetRxErrorContainer,
    onErrorContainer = VetRxOnErrorContainer,

    outline = VetRxOutline,
    outlineVariant = VetRxOutlineVariant
)

@Composable
fun VetRxTheme(
    content: @Composable () -> Unit
) {
    val colorScheme = VetRxLightColorScheme
    val view = LocalView.current

    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = VetRxSurface.toArgb()
            window.navigationBarColor = VetRxSurface.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = true
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = true
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = VetRxTypography,
        shapes = VetRxShapes,
        content = content
    )
}
