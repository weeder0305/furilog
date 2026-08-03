package app.shortmovie.memo

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.ContentValues
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.MediaStore
import android.provider.Settings
import android.view.Gravity
import android.view.Surface
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.MirrorMode
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.FallbackStrategy
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.io.File
import java.io.FileInputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class CameraActivity : AppCompatActivity() {
    private lateinit var previewView: PreviewView
    private lateinit var statusText: TextView
    private lateinit var timerText: TextView
    private lateinit var recordButton: Button
    private lateinit var switchButton: Button
    private lateinit var countdownButton: Button
    private lateinit var albumButton: Button
    private lateinit var audioButton: Button
    private lateinit var bluetoothButton: Button
    private lateinit var zoomButton: Button
    private lateinit var closeButton: Button
    private lateinit var cameraExecutor: ExecutorService
    private val mainHandler = Handler(Looper.getMainLooper())

    private var cameraProvider: ProcessCameraProvider? = null
    private var boundCamera: Camera? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var activeRecording: Recording? = null
    private var lensFacing = CameraSelector.LENS_FACING_BACK
    private var countdownSeconds = 0
    private var countdownActive = false
    private var permissionRequestAttempted = false
    private var permissionBlocked = false
    private var destroyingForLifecycle = false
    private var saveToAlbum = true
    private var audioMode = AudioMode.MICROPHONE
    private var bluetoothDelayMs = 0
    private var zoomRatio = 1f
    private var capturedAudioSession: CapturedAudioSession? = null
    private var playbackCaptureService: PlaybackCaptureService? = null
    private var playbackCaptureServiceBound = false
    private var activeMediaProjection: MediaProjection? = null
    private var pendingProjectionResult: Pair<Int, Intent>? = null

    private val playbackCaptureServiceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            playbackCaptureService = (binder as? PlaybackCaptureService.LocalBinder)?.service()
            playbackCaptureService?.onProjectionStopped = { handleProjectionStopped() }
            playbackCaptureServiceBound = playbackCaptureService != null
            pendingProjectionResult?.let { (resultCode, data) ->
                pendingProjectionResult = null
                startProjectionAndCountdown(resultCode, data)
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            playbackCaptureService = null
            playbackCaptureServiceBound = false
        }
    }

    private val projectionPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode != Activity.RESULT_OK || result.data == null) {
            statusText.text = "端末内部音声の取得が許可されませんでした"
            setIdleControlsEnabled(true)
            return@registerForActivityResult
        }
        val data = result.data ?: return@registerForActivityResult
        if (playbackCaptureService == null) {
            pendingProjectionResult = result.resultCode to data
            statusText.text = "端末内部音声を準備中…"
            bindPlaybackCaptureService()
        } else {
            startProjectionAndCountdown(result.resultCode, data)
        }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (requiredPermissions().all { grants[it] == true || hasPermission(it) }) {
            permissionBlocked = false
            statusText.text = "準備中…"
            startCamera()
        } else {
            permissionBlocked = requiredPermissions().any {
                !hasPermission(it) && !shouldShowRequestPermissionRationale(it)
            }
            statusText.text = if (permissionBlocked) {
                "端末の設定でカメラとマイクを許可してください"
            } else {
                "撮影にはカメラとマイクの許可が必要です"
            }
            recordButton.text = if (permissionBlocked) "設定を開く" else "権限を許可"
            recordButton.isEnabled = true
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        cameraExecutor = Executors.newSingleThreadExecutor()
        saveToAlbum = getSharedPreferences(PREFERENCES_NAME, MODE_PRIVATE)
            .getBoolean(PREFERENCE_SAVE_TO_ALBUM, true)
        bluetoothDelayMs = clampBluetoothDelayMs(
            getSharedPreferences(PREFERENCES_NAME, MODE_PRIVATE)
                .getInt(PREFERENCE_BLUETOOTH_DELAY_MS, 0)
        )
        deleteExpiredTemporaryFiles()
        buildInterface()
        bindPlaybackCaptureService()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (activeRecording != null || countdownActive) {
                    statusText.text = "撮影中は停止ボタンを押してください"
                } else {
                    setResult(RESULT_CANCELED)
                    finish()
                }
            }
        })
        if (hasAllPermissions()) startCamera() else requestPermissions()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        previewView.post { updateTargetRotation() }
    }

    override fun onDestroy() {
        destroyingForLifecycle = true
        mainHandler.removeCallbacksAndMessages(null)
        activeRecording?.stop()
        activeRecording = null
        capturedAudioSession?.cancel()
        capturedAudioSession = null
        playbackCaptureService?.onProjectionStopped = null
        playbackCaptureService?.stopProjection()
        activeMediaProjection = null
        if (playbackCaptureServiceBound) unbindService(playbackCaptureServiceConnection)
        playbackCaptureServiceBound = false
        cameraExecutor.shutdown()
        super.onDestroy()
    }

    private fun buildInterface() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.BLACK)
        }
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val systemBars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            view.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        statusText = TextView(this).apply {
            text = "権限を確認中…"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(13, 20, 33))
            setPadding(dp(16), dp(10), dp(16), dp(10))
            gravity = Gravity.CENTER
        }
        root.addView(statusText, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)

        val previewFrame = FrameLayout(this)
        previewView = PreviewView(this).apply {
            scaleType = PreviewView.ScaleType.FIT_CENTER
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            setBackgroundColor(Color.BLACK)
        }
        previewFrame.addView(
            previewView,
            FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        )
        timerText = TextView(this).apply {
            text = "00:00"
            textSize = 22f
            setTextColor(Color.WHITE)
            setBackgroundColor(0x88000000.toInt())
            setPadding(dp(12), dp(6), dp(12), dp(6))
            gravity = Gravity.CENTER
        }
        previewFrame.addView(
            timerText,
            FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT).apply {
                gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                topMargin = dp(12)
            }
        )
        root.addView(previewFrame, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))

        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(dp(8), dp(8), dp(8), dp(8))
            setBackgroundColor(Color.rgb(22, 33, 58))
        }
        closeButton = controlButton("閉じる") {
            setResult(RESULT_CANCELED)
            finish()
        }
        switchButton = controlButton(currentCameraLabel()) { switchCamera() }
        countdownButton = controlButton("即時") {
            countdownSeconds = when (countdownSeconds) {
                0 -> 3
                3 -> 5
                else -> 0
            }
            countdownButton.text = if (countdownSeconds == 0) "即時" else "${countdownSeconds}秒"
        }
        albumButton = controlButton(albumButtonLabel()) {
            saveToAlbum = !saveToAlbum
            getSharedPreferences(PREFERENCES_NAME, MODE_PRIVATE)
                .edit()
                .putBoolean(PREFERENCE_SAVE_TO_ALBUM, saveToAlbum)
                .apply()
            albumButton.text = albumButtonLabel()
        }
        audioButton = controlButton(audioMode.buttonLabel()) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                AlertDialog.Builder(this)
                    .setTitle("端末内部音声はAndroid 10以上で利用できます")
                    .setMessage("この端末ではマイク音声で撮影できます。")
                    .setPositiveButton("OK", null)
                    .show()
            } else {
                audioMode = audioMode.next()
                refreshAudioControls()
            }
        }
        bluetoothButton = controlButton(bluetoothButtonLabel()) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                AlertDialog.Builder(this)
                    .setTitle("Bluetooth補正はAndroid 10以上で利用できます")
                    .setMessage("この端末ではマイク音声で撮影できます。")
                    .setPositiveButton("OK", null)
                    .show()
            } else {
                showBluetoothDelayDialog()
            }
        }
        zoomButton = controlButton(zoomButtonLabel()) {
            if (lensFacing != CameraSelector.LENS_FACING_BACK) return@controlButton
            val maxZoom = boundCamera?.cameraInfo?.zoomState?.value?.maxZoomRatio ?: 1f
            zoomRatio = nextZoomRatio(zoomRatio, maxZoom)
            applyZoom()
        }
        recordButton = controlButton("撮影開始") {
            if (!hasAllPermissions()) {
                if (permissionBlocked && permissionRequestAttempted) openAppSettings()
                else requestPermissions()
            }
            else if (activeRecording != null) stopRecording()
            else if (!countdownActive) prepareRecording()
        }.apply { isEnabled = false }

        val captureSettings = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(dp(8), dp(5), dp(8), 0)
            setBackgroundColor(Color.rgb(22, 33, 58))
        }
        listOf(audioButton, bluetoothButton, zoomButton).forEach { button ->
            captureSettings.addView(button, LinearLayout.LayoutParams(0, dp(46), 1f).apply {
                marginStart = dp(3)
                marginEnd = dp(3)
            })
        }
        root.addView(captureSettings, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)

        listOf(closeButton, switchButton, countdownButton, albumButton, recordButton).forEach { button ->
            controls.addView(button, LinearLayout.LayoutParams(0, dp(52), 1f).apply {
                marginStart = dp(3)
                marginEnd = dp(3)
            })
        }
        root.addView(controls, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        setContentView(root)
    }

    private fun controlButton(label: String, listener: (View) -> Unit): Button = Button(this).apply {
        text = label
        textSize = 12f
        isAllCaps = false
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.rgb(109, 79, 196))
        setOnClickListener(listener)
    }

    private fun showBluetoothDelayDialog() {
        val valueText = TextView(this).apply {
            textSize = 18f
            gravity = Gravity.CENTER
            setPadding(dp(12), dp(8), dp(12), dp(8))
        }
        val delaySeekBar = SeekBar(this).apply {
            max = (MAX_BLUETOOTH_DELAY_MS - MIN_BLUETOOTH_DELAY_MS) / BLUETOOTH_DELAY_STEP_MS
            progress = (bluetoothDelayMs - MIN_BLUETOOTH_DELAY_MS) / BLUETOOTH_DELAY_STEP_MS
        }
        fun selectedDelay(): Int = clampBluetoothDelayMs(
            MIN_BLUETOOTH_DELAY_MS + delaySeekBar.progress * BLUETOOTH_DELAY_STEP_MS
        )
        fun updateValueText() {
            val delay = selectedDelay()
            val signed = if (delay > 0) "+$delay" else delay.toString()
            valueText.text = "$signed ms\n＋は音声を遅らせます"
        }
        delaySeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) = updateValueText()
            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        })
        updateValueText()
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(4), dp(18), dp(4))
            addView(valueText, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            addView(delaySeekBar, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        AlertDialog.Builder(this)
            .setTitle("Bluetoothイヤホンで撮影")
            .setMessage("端末内部音声を使い、映像とのずれを補正します。－は音声を早め、＋は遅らせます。設定は次回も保持されます。")
            .setView(content)
            .setPositiveButton("設定して使用") { _, _ ->
                bluetoothDelayMs = selectedDelay()
                getSharedPreferences(PREFERENCES_NAME, MODE_PRIVATE)
                    .edit()
                    .putInt(PREFERENCE_BLUETOOTH_DELAY_MS, bluetoothDelayMs)
                    .apply()
                audioMode = AudioMode.BLUETOOTH_DEVICE
                refreshAudioControls()
            }
            .setNegativeButton("キャンセル", null)
            .show()
    }

    private fun refreshAudioControls() {
        audioButton.text = audioMode.buttonLabel()
        bluetoothButton.text = bluetoothButtonLabel()
        bluetoothButton.setBackgroundColor(
            if (audioMode == AudioMode.BLUETOOTH_DEVICE) Color.rgb(55, 139, 117)
            else Color.rgb(109, 79, 196)
        )
        statusText.text = when (audioMode) {
            AudioMode.MICROPHONE -> "音声: マイク"
            AudioMode.DEVICE -> "音声: 端末内部（録音を許可したアプリのみ）"
            AudioMode.MICROPHONE_AND_DEVICE -> "音声: マイク＋端末内部（録音を許可したアプリのみ）"
            AudioMode.BLUETOOTH_DEVICE -> "Bluetooth撮影: 内部音声を${bluetoothDelayMs}ms補正"
        }
    }

    private fun bluetoothButtonLabel(): String {
        val signed = if (bluetoothDelayMs > 0) "+$bluetoothDelayMs" else bluetoothDelayMs.toString()
        return "BT撮影 ${signed}ms"
    }

    private fun startCamera() {
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener({
            try {
                cameraProvider = providerFuture.get()
                bindCameraUseCases()
            } catch (_: Exception) {
                statusText.text = "カメラを初期化できませんでした"
                recordButton.isEnabled = false
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun bindCameraUseCases() {
        val provider = cameraProvider ?: return
        val selector = CameraSelector.Builder().requireLensFacing(lensFacing).build()
        val preview = Preview.Builder().build().also { it.surfaceProvider = previewView.surfaceProvider }
        val qualitySelector = QualitySelector.fromOrderedList(
            listOf(Quality.FHD, Quality.HD, Quality.SD),
            FallbackStrategy.lowerQualityOrHigherThan(Quality.FHD)
        )
        val recorder = Recorder.Builder()
            .setQualitySelector(qualitySelector)
            .build()
        val capture = VideoCapture.Builder(recorder)
            .setMirrorMode(MirrorMode.MIRROR_MODE_ON_FRONT_ONLY)
            .build()
        try {
            provider.unbindAll()
            boundCamera = provider.bindToLifecycle(this, selector, preview, capture)
            videoCapture = capture
            if (lensFacing == CameraSelector.LENS_FACING_FRONT) zoomRatio = 1f
            applyZoom()
            statusText.text = "1080p優先 / 端末標準fps"
            recordButton.text = "撮影開始"
            recordButton.isEnabled = true
            switchButton.isEnabled = hasOppositeCamera(provider)
            previewView.post { updateTargetRotation() }
        } catch (_: Exception) {
            boundCamera = null
            videoCapture = null
            statusText.text = "このカメラでは動画撮影を開始できません"
            recordButton.isEnabled = false
        }
    }

    private fun hasOppositeCamera(provider: ProcessCameraProvider): Boolean {
        val opposite = if (lensFacing == CameraSelector.LENS_FACING_BACK) {
            CameraSelector.DEFAULT_FRONT_CAMERA
        } else {
            CameraSelector.DEFAULT_BACK_CAMERA
        }
        return try { provider.hasCamera(opposite) } catch (_: Exception) { false }
    }

    private fun updateTargetRotation() {
        val rotation = previewView.display?.rotation ?: Surface.ROTATION_0
        videoCapture?.targetRotation = rotation
    }

    private fun switchCamera() {
        if (activeRecording != null || countdownActive) return
        lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK) {
            CameraSelector.LENS_FACING_FRONT
        } else {
            CameraSelector.LENS_FACING_BACK
        }
        zoomRatio = 1f
        switchButton.text = currentCameraLabel()
        zoomButton.text = zoomButtonLabel()
        bindCameraUseCases()
    }

    private fun currentCameraLabel(): String =
        if (lensFacing == CameraSelector.LENS_FACING_BACK) "外カメラ" else "内カメラ"

    private fun applyZoom() {
        val camera = boundCamera
        if (camera == null || lensFacing != CameraSelector.LENS_FACING_BACK) {
            zoomRatio = 1f
            zoomButton.text = zoomButtonLabel()
            zoomButton.isEnabled = false
            return
        }
        val maxZoom = camera.cameraInfo.zoomState.value?.maxZoomRatio ?: 1f
        zoomRatio = zoomRatio.coerceIn(1f, minOf(2f, maxZoom))
        camera.cameraControl.setZoomRatio(zoomRatio)
        zoomButton.text = zoomButtonLabel()
        zoomButton.isEnabled = maxZoom > 1.01f
    }

    private fun zoomButtonLabel(): String {
        val value = if (zoomRatio == zoomRatio.toInt().toFloat()) {
            zoomRatio.toInt().toString()
        } else {
            String.format(Locale.US, "%.1f", zoomRatio)
        }
        return "ズーム ${value}倍"
    }

    private fun prepareRecording() {
        if (!audioMode.includesDeviceAudio) {
            startCountdown()
            return
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            statusText.text = "端末内部音声はAndroid 10以上で利用できます"
            return
        }
        AlertDialog.Builder(this)
            .setTitle("端末内部音声の確認")
            .setMessage(
                "次の画面では「画面全体」を許可してください。\n\n" +
                    "画面映像は保存せず、録音が許可されたアプリの音声だけを動画に使います。"
            )
            .setPositiveButton("確認画面へ") { _, _ -> launchProjectionPermission() }
            .setNegativeButton("キャンセル", null)
            .show()
    }

    private fun launchProjectionPermission() {
        setIdleControlsEnabled(false)
        statusText.text = "端末内部音声の取得を許可してください"
        val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            manager.createScreenCaptureIntent(MediaProjectionConfig.createConfigForDefaultDisplay())
        } else {
            manager.createScreenCaptureIntent()
        }
        projectionPermissionLauncher.launch(intent)
    }

    private fun startProjectionAndCountdown(resultCode: Int, data: Intent) {
        try {
            ContextCompat.startForegroundService(this, Intent(this, PlaybackCaptureService::class.java))
            activeMediaProjection = playbackCaptureService?.startProjection(resultCode, data)
                ?: throw IllegalStateException("端末内部音声のサービスを準備できませんでした")
            startCountdown()
        } catch (_: Exception) {
            activeMediaProjection = null
            playbackCaptureService?.stopProjection()
            statusText.text = "端末内部音声を開始できませんでした"
            setIdleControlsEnabled(true)
        }
    }

    private fun startCountdown() {
        if (countdownSeconds == 0) {
            beginRecording()
            return
        }
        countdownActive = true
        setIdleControlsEnabled(false)
        var remaining = countdownSeconds
        fun tick() {
            if (!countdownActive) return
            if (remaining <= 0) {
                countdownActive = false
                beginRecording()
                return
            }
            timerText.text = remaining.toString()
            statusText.text = "${remaining}秒後に撮影します"
            remaining -= 1
            mainHandler.postDelayed({ tick() }, 1000)
        }
        tick()
    }

    private fun beginRecording() {
        val capture = videoCapture ?: run {
            setIdleControlsEnabled(true)
            return
        }
        val directory = File(cacheDir, CAPTURE_DIRECTORY)
        if ((!directory.exists() && !directory.mkdirs()) || !directory.isDirectory) {
            statusText.text = "一時保存領域を準備できませんでした"
            setIdleControlsEnabled(true)
            return
        }
        val recordedAtMillis = System.currentTimeMillis()
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss_SSS", Locale.US).format(Date(recordedAtMillis))
        val outputFile = File(directory, "furilog_$timestamp.mp4")
        val outputOptions = FileOutputOptions.Builder(outputFile)
            .setFileSizeLimit(MAX_RECORDING_BYTES)
            .build()
        try {
            if (audioMode.includesDeviceAudio) {
                val projection = activeMediaProjection
                    ?: throw IllegalStateException("端末内部音声の許可がありません")
                capturedAudioSession = CapturedAudioSession(
                    directory,
                    projection,
                    audioMode,
                    if (audioMode == AudioMode.BLUETOOTH_DEVICE) bluetoothDelayMs else 0
                ).also { it.start() }
            }
            var pendingRecording = capture.output.prepareRecording(this, outputOptions)
            if (audioMode == AudioMode.MICROPHONE) pendingRecording = pendingRecording.withAudioEnabled()
            activeRecording = pendingRecording.start(ContextCompat.getMainExecutor(this)) { event ->
                    handleRecordEvent(event, outputFile, recordedAtMillis)
                }
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            recordButton.text = "撮影停止"
            recordButton.isEnabled = true
            recordButton.setBackgroundColor(Color.rgb(224, 92, 111))
            statusText.text = "撮影中"
        } catch (_: SecurityException) {
            capturedAudioSession?.cancel()
            capturedAudioSession = null
            stopPlaybackCapture()
            outputFile.delete()
            activeRecording = null
            statusText.text = "マイク権限を確認してください"
            setIdleControlsEnabled(true)
        } catch (_: Exception) {
            capturedAudioSession?.cancel()
            capturedAudioSession = null
            stopPlaybackCapture()
            outputFile.delete()
            activeRecording = null
            statusText.text = "撮影を開始できませんでした"
            setIdleControlsEnabled(true)
        }
    }

    private fun handleRecordEvent(event: VideoRecordEvent, outputFile: File, recordedAtMillis: Long) {
        when (event) {
            is VideoRecordEvent.Status -> timerText.text = formatDuration(event.recordingStats.recordedDurationNanos)
            is VideoRecordEvent.Finalize -> {
                activeRecording = null
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                if (destroyingForLifecycle) {
                    outputFile.delete()
                    return
                }
                if (event.hasError() || !outputFile.exists() || outputFile.length() == 0L) {
                    capturedAudioSession?.cancel()
                    capturedAudioSession = null
                    stopPlaybackCapture()
                    val failureMessage = recordingFailureMessage(event, outputFile)
                    outputFile.delete()
                    statusText.text = failureMessage
                    timerText.text = "00:00"
                    setIdleControlsEnabled(true)
                    return
                }
                val audioSession = capturedAudioSession
                capturedAudioSession = null
                if (audioSession != null) {
                    statusText.text = "動画と音声を結合中…"
                    recordButton.isEnabled = false
                    cameraExecutor.execute {
                        val audioFailure = try {
                            audioSession.mergeIntoVideo(outputFile)
                            if (outputFile.length() > MAX_RECORDING_BYTES) {
                                outputFile.delete()
                                "動画が保存可能な上限サイズを超えました"
                            } else {
                                null
                            }
                        } catch (_: Exception) {
                            audioSession.cancel()
                            outputFile.delete()
                            "端末内部音声を動画へ保存できませんでした"
                        }
                        runOnUiThread {
                            stopPlaybackCapture()
                            if (audioFailure != null) {
                                statusText.text = audioFailure
                                timerText.text = "00:00"
                                setIdleControlsEnabled(true)
                            } else {
                                completeSuccessfulRecording(outputFile, recordedAtMillis)
                            }
                        }
                    }
                    return
                }
                completeSuccessfulRecording(outputFile, recordedAtMillis)
            }
        }
    }

    private fun completeSuccessfulRecording(outputFile: File, recordedAtMillis: Long) {
        if (!saveToAlbum) {
            finishWithResult(outputFile, recordedAtMillis, false)
            return
        }
        statusText.text = "アルバムへ保存中…"
        recordButton.isEnabled = false
        cameraExecutor.execute {
            val published = publishToMediaStore(outputFile)
            runOnUiThread {
                if (!published) {
                    statusText.text = "アルバムへ保存できませんでした。空き容量を確認してください"
                    setIdleControlsEnabled(true)
                    return@runOnUiThread
                }
                finishWithResult(outputFile, recordedAtMillis, true)
            }
        }
    }

    private fun stopRecording() {
        recordButton.isEnabled = false
        statusText.text = "録画を終了中…"
        capturedAudioSession?.let { session -> cameraExecutor.execute { session.stop() } }
        activeRecording?.stop()
    }

    private fun setIdleControlsEnabled(enabled: Boolean) {
        closeButton.isEnabled = enabled
        switchButton.isEnabled = enabled
        countdownButton.isEnabled = enabled
        albumButton.isEnabled = enabled
        audioButton.isEnabled = enabled
        bluetoothButton.isEnabled = enabled
        val maxZoom = boundCamera?.cameraInfo?.zoomState?.value?.maxZoomRatio ?: 1f
        zoomButton.isEnabled = enabled && lensFacing == CameraSelector.LENS_FACING_BACK && maxZoom > 1.01f
        recordButton.isEnabled = enabled
        recordButton.text = "撮影開始"
        recordButton.setBackgroundColor(Color.rgb(109, 79, 196))
    }

    private fun albumButtonLabel(): String = if (saveToAlbum) "アルバム ON" else "アルバム OFF"

    private fun bindPlaybackCaptureService() {
        if (playbackCaptureServiceBound) return
        playbackCaptureServiceBound = bindService(
            Intent(this, PlaybackCaptureService::class.java),
            playbackCaptureServiceConnection,
            Context.BIND_AUTO_CREATE
        )
    }

    private fun stopPlaybackCapture() {
        activeMediaProjection = null
        playbackCaptureService?.stopProjection()
    }

    private fun handleProjectionStopped() {
        activeMediaProjection = null
        when {
            activeRecording != null -> {
                stopRecording()
                statusText.text = "端末内部音声の許可が終了したため撮影を停止します"
            }
            countdownActive -> {
                countdownActive = false
                mainHandler.removeCallbacksAndMessages(null)
                timerText.text = "00:00"
                statusText.text = "端末内部音声の許可が終了しました"
                setIdleControlsEnabled(true)
            }
        }
    }

    private fun finishWithResult(outputFile: File, recordedAtMillis: Long, savedToAlbum: Boolean) {
        val result = Intent().apply {
            putExtra(EXTRA_TEMPORARY_PATH, outputFile.absolutePath)
            putExtra(EXTRA_FILE_NAME, outputFile.name)
            putExtra(EXTRA_RECORDED_AT_MILLIS, recordedAtMillis)
            putExtra(EXTRA_SAVED_TO_ALBUM, savedToAlbum)
        }
        setResult(RESULT_OK, result)
        finish()
    }

    private fun publishToMediaStore(source: File): Boolean {
        var uri: android.net.Uri? = null
        return try {
            val values = ContentValues().apply {
                put(MediaStore.Video.Media.DISPLAY_NAME, source.name)
                put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/ふりろぐ")
                    put(MediaStore.Video.Media.IS_PENDING, 1)
                }
            }
            uri = contentResolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
                ?: return false
            contentResolver.openOutputStream(uri, "w")?.use { output ->
                FileInputStream(source).use { input -> input.copyTo(output, DEFAULT_BUFFER_SIZE) }
            } ?: throw IllegalStateException("MediaStore output is unavailable")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                contentResolver.update(uri, ContentValues().apply {
                    put(MediaStore.Video.Media.IS_PENDING, 0)
                }, null, null)
            }
            true
        } catch (_: Exception) {
            uri?.let { contentResolver.delete(it, null, null) }
            false
        }
    }

    private fun requiredPermissions(): Array<String> {
        val permissions = mutableListOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) permissions += Manifest.permission.WRITE_EXTERNAL_STORAGE
        return permissions.toTypedArray()
    }

    private fun requestPermissions() {
        permissionRequestAttempted = true
        permissionLauncher.launch(requiredPermissions())
    }

    private fun openAppSettings() {
        startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", packageName, null)
        })
    }

    override fun onResume() {
        super.onResume()
        if (::recordButton.isInitialized && permissionRequestAttempted && hasAllPermissions() && videoCapture == null) {
            permissionBlocked = false
            statusText.text = "準備中…"
            startCamera()
        }
    }

    private fun hasAllPermissions(): Boolean = requiredPermissions().all(::hasPermission)

    private fun hasPermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    private fun deleteExpiredTemporaryFiles() {
        val cutoff = System.currentTimeMillis() - TimeUnit.HOURS.toMillis(24)
        File(cacheDir, CAPTURE_DIRECTORY).listFiles()?.forEach { file ->
            if (file.isFile && file.extension.lowercase() in TEMPORARY_EXTENSIONS && file.lastModified() < cutoff) {
                file.delete()
            }
        }
    }

    private fun formatDuration(nanos: Long): String {
        val seconds = TimeUnit.NANOSECONDS.toSeconds(nanos)
        return String.format(Locale.US, "%02d:%02d", seconds / 60, seconds % 60)
    }

    private fun recordingFailureMessage(event: VideoRecordEvent.Finalize, outputFile: File): String =
        when (event.error) {
            VideoRecordEvent.Finalize.ERROR_NO_VALID_DATA ->
                "撮影時間が短すぎるため保存できませんでした。少し長めに撮影してください"
            VideoRecordEvent.Finalize.ERROR_INSUFFICIENT_STORAGE ->
                "空き容量が不足しているため保存できませんでした"
            VideoRecordEvent.Finalize.ERROR_SOURCE_INACTIVE ->
                "カメラが中断されたため保存できませんでした。画面を開いたまま撮影してください"
            VideoRecordEvent.Finalize.ERROR_ENCODING_FAILED,
            VideoRecordEvent.Finalize.ERROR_RECORDER_ERROR ->
                "動画を正常に作成できませんでした。もう一度撮影してください"
            VideoRecordEvent.Finalize.ERROR_INVALID_OUTPUT_OPTIONS ->
                "保存先を準備できませんでした。アプリを開き直してお試しください"
            else -> if (
                event.recordingStats.recordedDurationNanos < MIN_USABLE_RECORDING_NANOS ||
                !outputFile.exists() ||
                outputFile.length() == 0L
            ) {
                "撮影時間が短すぎるため保存できませんでした。少し長めに撮影してください"
            } else {
                "録画に失敗しました。もう一度撮影してください"
            }
        }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        const val CAPTURE_DIRECTORY = "camera-captures"
        const val EXTRA_TEMPORARY_PATH = "temporaryPath"
        const val EXTRA_FILE_NAME = "fileName"
        const val EXTRA_RECORDED_AT_MILLIS = "recordedAtMillis"
        const val EXTRA_SAVED_TO_ALBUM = "savedToAlbum"
        const val MAX_RECORDING_BYTES = 2L * 1024L * 1024L * 1024L
        const val MIN_USABLE_RECORDING_NANOS = 500_000_000L
        private const val PREFERENCES_NAME = "furilog-camera"
        private const val PREFERENCE_SAVE_TO_ALBUM = "saveToAlbum"
        private const val PREFERENCE_BLUETOOTH_DELAY_MS = "bluetoothDelayMs"
        private val TEMPORARY_EXTENSIONS = setOf("mp4", "m4a", "pcm")
    }
}
