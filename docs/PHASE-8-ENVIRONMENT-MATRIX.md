# VetRx — Phase 8 Environment & Device Matrix

**Release Candidate:** `v0.8.0-rc.1` (`7e448974460a98d0edc2dd391965dde364381c91`)  
**Production URL:** `https://vetrx.adcpmalappuram.in`

---

## Device & Browser Validation Matrix

| Device Category | Operating System | Browser Engine | Viewport Width | Test Mode | Result | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **Desktop Workstation** | Windows 11 Pro | Chromium (Chrome/Edge) | 1440px | Direct Desktop | **VERIFIED** | Full widescreen dashboard, sticky sidebar, table views, dual-pane modals. |
| **Desktop Workstation** | Windows 11 Pro | Gecko (Firefox) | 1440px | Direct Desktop | **VERIFIED** | Clean CSS grid, font baseline rendering, print dialog parity. |
| **Standard Android Phone** | Android 13/14 | Chrome Mobile | 360px | Headless Device Emulation | **VERIFIED** | Zero horizontal overflow (0px), card borders intact, `#CAN-8801` and `5 kg` badges cleanly fitted. |
| **Modern Android Phone** | Android 14 | Chrome Mobile | 412px | Headless Device Emulation | **VERIFIED** | Responsive card grids stack cleanly, search input placeholder visible. |
| **iPhone Standard** | iOS 17/18 | Safari / WebKit (Emulated) | 390px | Headless Mobile WebKit Viewport | **VERIFIED** | Single column cards, share modal action wrap without clipping, URL breaks cleanly. |
| **Tablet Portrait** | iPadOS / Android Tablet | Chromium / WebKit | 768px | Headless Tablet Viewport | **VERIFIED** | Responsive collapse breakpoint transitions smoothly; touch targets >= 44px. |
| **Tablet Landscape** | iPadOS / Android Tablet | Chromium / WebKit | 1024px | Headless Tablet Viewport | **VERIFIED** | Desktop layout activates, sidebar accessible, navigation links responsive. |
| **Ultra-compact Mobile** | Android Go / Legacy | Chrome Mobile | 320px | Headless Mobile Viewport | **VERIFIED** | Critical clinical controls accessible, zero document blow-out. |
