package app.shortmovie.memo

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Binder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

class PlaybackCaptureService : Service() {
    inner class LocalBinder : Binder() {
        fun service(): PlaybackCaptureService = this@PlaybackCaptureService
    }

    private val binder = LocalBinder()
    private var mediaProjection: MediaProjection? = null
    private var projectionCallback: MediaProjection.Callback? = null
    var onProjectionStopped: (() -> Unit)? = null

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureForeground()
        return START_NOT_STICKY
    }

    fun startProjection(resultCode: Int, data: Intent): MediaProjection {
        ensureForeground()
        stopProjection(stopService = false)
        val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val projection = manager.getMediaProjection(resultCode, data)
            ?: throw IllegalStateException("端末内部音声の取得許可を開始できませんでした")
        val callback = object : MediaProjection.Callback() {
            override fun onStop() {
                mediaProjection = null
                projectionCallback = null
                onProjectionStopped?.invoke()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        projection.registerCallback(callback, Handler(Looper.getMainLooper()))
        mediaProjection = projection
        projectionCallback = callback
        return projection
    }

    fun stopProjection() {
        stopProjection(stopService = true)
    }

    private fun stopProjection(stopService: Boolean) {
        val projection = mediaProjection
        val callback = projectionCallback
        mediaProjection = null
        projectionCallback = null
        if (projection != null && callback != null) projection.unregisterCallback(callback)
        projection?.stop()
        if (stopService) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    override fun onDestroy() {
        stopProjection(stopService = false)
        onProjectionStopped = null
        super.onDestroy()
    }

    private fun ensureForeground() {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    NOTIFICATION_CHANNEL_ID,
                    "撮影中の端末内部音声",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "端末内部音声を動画へ保存している間に表示します"
                    setShowBadge(false)
                }
            )
        }
        val notification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.presence_video_online)
            .setContentTitle("ふりろぐで撮影中")
            .setContentText("許可された端末内部音声を録音しています")
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
        val serviceType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
        } else {
            0
        }
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, serviceType)
    }

    companion object {
        private const val NOTIFICATION_CHANNEL_ID = "furilog_playback_capture"
        private const val NOTIFICATION_ID = 2401
    }
}
