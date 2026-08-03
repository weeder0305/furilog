package app.shortmovie.memo

import android.app.Activity
import android.content.Intent
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File

@CapacitorPlugin(name = "NativeCamera")
class NativeCameraPlugin : Plugin() {
    @PluginMethod
    fun recordVideo(call: PluginCall) {
        startActivityForResult(call, Intent(context, CameraActivity::class.java), "cameraResult")
    }

    @ActivityCallback
    private fun cameraResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK) {
            call.reject("cancelled", "CAMERA_CANCELLED")
            return
        }
        val path = result.data?.getStringExtra(CameraActivity.EXTRA_TEMPORARY_PATH)
        val name = result.data?.getStringExtra(CameraActivity.EXTRA_FILE_NAME)
        val recordedAtMillis = result.data?.getLongExtra(CameraActivity.EXTRA_RECORDED_AT_MILLIS, 0L) ?: 0L
        val savedToAlbum = result.data?.getBooleanExtra(CameraActivity.EXTRA_SAVED_TO_ALBUM, false) ?: false
        if (path.isNullOrBlank() || name.isNullOrBlank()) {
            call.reject("撮影結果がありません。", "CAMERA_EMPTY_RESULT")
            return
        }
        val captureDirectory = File(context.cacheDir, CameraActivity.CAPTURE_DIRECTORY).canonicalFile
        val target = try { File(path).canonicalFile } catch (_: Exception) {
            call.reject("撮影結果のパスが不正です。", "CAMERA_INVALID_RESULT")
            return
        }
        val validResult = target.path.startsWith(captureDirectory.path + File.separator) &&
            target.name == name &&
            target.extension.equals("mp4", ignoreCase = true) &&
            target.isFile &&
            target.length() in 1..CameraActivity.MAX_RECORDING_BYTES
        if (!validResult) {
            call.reject("撮影結果を安全に確認できませんでした。", "CAMERA_INVALID_RESULT")
            return
        }
        val resultObject = JSObject()
        resultObject.put("path", target.absolutePath)
        resultObject.put("name", target.name)
        resultObject.put("mimeType", "video/mp4")
        resultObject.put("savedToAlbum", savedToAlbum)
        if (recordedAtMillis > 0L && recordedAtMillis <= System.currentTimeMillis() + 60_000L) {
            resultObject.put("recordedAt", recordedAtMillis)
        }
        call.resolve(resultObject)
    }

    @PluginMethod
    fun deleteTemporaryVideo(call: PluginCall) {
        val rawPath = call.getString("path")
        if (rawPath.isNullOrBlank()) {
            call.reject("削除対象がありません。", "INVALID_PATH")
            return
        }
        val captureDirectory = File(context.cacheDir, CameraActivity.CAPTURE_DIRECTORY).canonicalFile
        val target = File(rawPath).canonicalFile
        val insideCaptureDirectory = target.path.startsWith(captureDirectory.path + File.separator)
        if (!insideCaptureDirectory || target.extension.lowercase() != "mp4") {
            call.reject("許可されていない一時ファイルです。", "INVALID_PATH")
            return
        }
        if (target.exists() && !target.delete()) {
            call.reject("一時ファイルを削除できませんでした。", "DELETE_FAILED")
            return
        }
        call.resolve()
    }
}
