package com.vetrx.app

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.CancellationSignal
import android.os.Environment
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.print.PrintManager
import android.provider.MediaStore
import android.util.Base64
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.vetrx.app.call.CallNotificationHelper
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream

@CapacitorPlugin(name = "VetRxNative")
class VetRxNativePlugin : Plugin() {

    companion object {
        private var pendingCallPromptData: JSObject? = null
        private var pluginInstance: VetRxNativePlugin? = null

        fun setPendingCallPrompt(
            callEventId: String,
            phoneNumber: String,
            ownerName: String?,
            patientName: String?,
            durationSeconds: Int,
            action: String?
        ) {
            val obj = JSObject().apply {
                put("callEventId", callEventId)
                put("phoneNumber", phoneNumber)
                put("ownerName", ownerName)
                put("patientName", patientName)
                put("durationSeconds", durationSeconds)
                put("action", action ?: "register_call")
                put("timestamp", System.currentTimeMillis())
            }
            pendingCallPromptData = obj
            pluginInstance?.notifyListeners("callEnded", obj)
        }

        fun checkAndEmitPendingPrompt(context: Context) {
            val prompt = pendingCallPromptData ?: return
            pluginInstance?.notifyListeners("callEnded", prompt)
        }
    }

    override fun load() {
        super.load()
        pluginInstance = this
    }

    override fun handleOnDestroy() {
        if (pluginInstance == this) {
            pluginInstance = null
        }
        super.handleOnDestroy()
    }

    // ── 1. Save PDF to Public Downloads Directory ─────────────────────────────
    @PluginMethod
    fun savePdfToDownloads(call: PluginCall) {
        val base64Data = call.getString("base64Data")
        val filename = call.getString("filename") ?: "VetRx_Document.pdf"

        if (base64Data.isNullOrBlank()) {
            call.reject("Missing required base64Data for PDF export")
            return
        }

        try {
            val bytes = Base64.decode(base64Data, Base64.DEFAULT)
            if (bytes.isEmpty()) {
                call.reject("Decoded PDF content is empty (0 bytes)")
                return
            }

            val ctx = context
            var finalUri: Uri? = null
            var finalPath: String? = null

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
                    put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf")
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }

                val resolver = ctx.contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                    ?: throw IllegalStateException("Failed to create MediaStore entry in Downloads")

                resolver.openOutputStream(uri)?.use { output ->
                    output.write(bytes)
                    output.flush()
                }

                contentValues.clear()
                contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
                resolver.update(uri, contentValues, null, null)

                finalUri = uri
                finalPath = "${Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)}/$filename"
            } else {
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                if (!downloadsDir.exists()) downloadsDir.mkdirs()
                val targetFile = File(downloadsDir, filename)
                FileOutputStream(targetFile).use { it.write(bytes) }
                finalUri = Uri.fromFile(targetFile)
                finalPath = targetFile.absolutePath
            }

            val ret = JSObject().apply {
                put("success", true)
                put("filename", filename)
                put("path", finalPath)
                put("uri", finalUri?.toString())
                put("sizeBytes", bytes.size)
            }
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Failed to save PDF to Downloads: ${e.message}", e)
        }
    }

    // ── 2. Open PDF File in External PDF Viewer ───────────────────────────────
    @PluginMethod
    fun openPdfFile(call: PluginCall) {
        val uriString = call.getString("uri")
        val path = call.getString("path")
        val base64Data = call.getString("base64Data")
        val filename = call.getString("filename") ?: "VetRx_Document.pdf"

        try {
            val ctx = context
            val contentUri: Uri = if (!uriString.isNullOrBlank()) {
                Uri.parse(uriString)
            } else {
                val file = if (!path.isNullOrBlank()) {
                    File(path)
                } else if (!base64Data.isNullOrBlank()) {
                    val cacheFile = File(ctx.cacheDir, filename)
                    val bytes = Base64.decode(base64Data, Base64.DEFAULT)
                    FileOutputStream(cacheFile).use { it.write(bytes) }
                    cacheFile
                } else {
                    call.reject("Must provide uri, path, or base64Data to open PDF")
                    return
                }
                FileProvider.getUriForFile(ctx, "${ctx.packageName}.fileprovider", file)
            }

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(contentUri, "application/pdf")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            val chooser = Intent.createChooser(intent, "Open Prescription PDF")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(chooser)

            call.resolve(JSObject().apply { put("success", true) })
        } catch (e: Exception) {
            call.reject("Could not open PDF viewer: ${e.message}", e)
        }
    }

    // ── 3. Native Android Print PDF via PrintManager ─────────────────────────
    @PluginMethod
    fun printPdf(call: PluginCall) {
        val base64Data = call.getString("base64Data")
        val title = call.getString("title") ?: "VetRx Prescription"

        if (base64Data.isNullOrBlank()) {
            call.reject("Missing required base64Data for printing")
            return
        }

        try {
            val bytes = Base64.decode(base64Data, Base64.DEFAULT)
            if (bytes.isEmpty()) {
                call.reject("Cannot print empty PDF content")
                return
            }

            val act = activity
            if (act == null) {
                call.reject("Activity context not available for printing")
                return
            }

            val printManager = act.getSystemService(Context.PRINT_SERVICE) as? PrintManager
            if (printManager == null) {
                call.reject("Android PrintManager service is not available on this device")
                return
            }

            val tempFile = File(act.cacheDir, "print_job_${System.currentTimeMillis()}.pdf")
            FileOutputStream(tempFile).use { it.write(bytes) }

            act.runOnUiThread {
                try {
                    val printAdapter = object : PrintDocumentAdapter() {
                        override fun onLayout(
                            oldAttributes: PrintAttributes?,
                            newAttributes: PrintAttributes?,
                            cancellationSignal: CancellationSignal?,
                            callback: LayoutResultCallback?,
                            extras: android.os.Bundle?
                        ) {
                            if (cancellationSignal?.isCanceled == true) {
                                callback?.onLayoutCancelled()
                                return
                            }
                            val info = PrintDocumentInfo.Builder("${title}.pdf")
                                .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                                .build()
                            callback?.onLayoutFinished(info, true)
                        }

                        override fun onWrite(
                            pages: Array<out PageRange>?,
                            destination: ParcelFileDescriptor?,
                            cancellationSignal: CancellationSignal?,
                            callback: WriteResultCallback?
                        ) {
                            var input: InputStream? = null
                            var output: OutputStream? = null
                            try {
                                if (destination == null) {
                                    callback?.onWriteFailed("Missing destination file descriptor")
                                    return
                                }
                                input = FileInputStream(tempFile)
                                output = FileOutputStream(destination.fileDescriptor)
                                val buffer = ByteArray(4096)
                                var bytesRead: Int
                                while (input.read(buffer).also { bytesRead = it } >= 0) {
                                    if (cancellationSignal?.isCanceled == true) {
                                        callback?.onWriteCancelled()
                                        return
                                    }
                                    output.write(buffer, 0, bytesRead)
                                }
                                callback?.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
                            } catch (ex: Exception) {
                                callback?.onWriteFailed(ex.message)
                            } finally {
                                try { input?.close() } catch (_: Exception) {}
                                try { output?.close() } catch (_: Exception) {}
                            }
                        }
                    }

                    printManager.print(title, printAdapter, PrintAttributes.Builder().build())
                    call.resolve(JSObject().apply { put("success", true) })
                } catch (e: Exception) {
                    call.reject("Failed to trigger Android print dialogue: ${e.message}", e)
                }
            }
        } catch (e: Exception) {
            call.reject("Print preparation error: ${e.message}", e)
        }
    }

    // ── 4. Native Attachment Sharing (PDF File + WhatsApp) ────────────────────
    @PluginMethod
    fun sharePdf(call: PluginCall) {
        val base64Data = call.getString("base64Data")
        val filename = call.getString("filename") ?: "VetRx_Document.pdf"
        val title = call.getString("title") ?: "VetRx Document"
        val text = call.getString("text") ?: ""
        val targetApp = call.getString("targetApp") // "whatsapp" or null

        if (base64Data.isNullOrBlank()) {
            call.reject("Missing required base64Data for sharing")
            return
        }

        try {
            val bytes = Base64.decode(base64Data, Base64.DEFAULT)
            val ctx = context
            val cacheFile = File(ctx.cacheDir, filename)
            FileOutputStream(cacheFile).use { it.write(bytes) }

            val contentUri = FileProvider.getUriForFile(
                ctx,
                "${ctx.packageName}.fileprovider",
                cacheFile
            )

            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_STREAM, contentUri)
                putExtra(Intent.EXTRA_SUBJECT, title)
                if (text.isNotBlank()) {
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                if (targetApp == "whatsapp") {
                    setPackage("com.whatsapp")
                }
            }

            val act = activity ?: ctx
            if (targetApp == "whatsapp") {
                val pm = ctx.packageManager
                val isInstalled = try {
                    pm.getPackageInfo("com.whatsapp", 0)
                    true
                } catch (e: Exception) {
                    false
                }

                if (!isInstalled) {
                    val chooser = Intent.createChooser(intent, title).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    act.startActivity(chooser)
                    call.resolve(JSObject().apply {
                        put("success", true)
                        put("fallback", true)
                        put("message", "WhatsApp is not installed. Opened standard Android share sheet.")
                    })
                    return
                }
            }

            val chooser = if (targetApp == "whatsapp") intent else Intent.createChooser(intent, title)
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            act.startActivity(chooser)

            call.resolve(JSObject().apply {
                put("success", true)
                put("target", targetApp ?: "system_chooser")
            })
        } catch (e: Exception) {
            call.reject("Failed to share PDF: ${e.message}", e)
        }
    }

    // ── 5. Telephony / Call Registration Prompts ──────────────────────────────
    @PluginMethod
    fun getPendingCallPrompt(call: PluginCall) {
        val prompt = pendingCallPromptData
        val ret = JSObject().apply {
            put("hasPrompt", prompt != null)
            if (prompt != null) {
                put("prompt", prompt)
            }
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun dismissPendingCallPrompt(call: PluginCall) {
        pendingCallPromptData = null
        CallNotificationHelper.dismissNotification(context)
        call.resolve(JSObject().apply { put("success", true) })
    }
}
