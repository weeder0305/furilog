package app.shortmovie.memo

import android.annotation.SuppressLint
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.media.MediaMuxer
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import kotlin.math.max

@SuppressLint("NewApi")
class CapturedAudioSession(
    private val directory: File,
    private val mediaProjection: MediaProjection,
    private val mode: AudioMode,
    private val audioDelayMs: Int = 0
) {
    private val running = AtomicBoolean(false)
    private val timestamp = System.currentTimeMillis().toString()
    private val devicePcm = File(directory, "internal_$timestamp.pcm")
    private val microphonePcm = File(directory, "microphone_$timestamp.pcm")
    private val mixedPcm = File(directory, "mixed_$timestamp.pcm")
    private val encodedAudio = File(directory, "audio_$timestamp.m4a")
    private var deviceRecord: AudioRecord? = null
    private var microphoneRecord: AudioRecord? = null
    private var deviceThread: Thread? = null
    private var microphoneThread: Thread? = null

    @SuppressLint("MissingPermission")
    fun start() {
        check(mode.includesDeviceAudio)
        val bufferSize = captureBufferSize()
        var device: AudioRecord? = null
        var microphone: AudioRecord? = null
        try {
            val playbackConfig = android.media.AudioPlaybackCaptureConfiguration.Builder(mediaProjection)
                .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                .addMatchingUsage(AudioAttributes.USAGE_GAME)
                .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
                .build()
            device = AudioRecord.Builder()
                .setAudioFormat(audioFormat())
                .setBufferSizeInBytes(bufferSize)
                .setAudioPlaybackCaptureConfig(playbackConfig)
                .build()
                .also(::requireInitialized)
            microphone = if (mode.includesMicrophone) {
                AudioRecord.Builder()
                    .setAudioSource(MediaRecorder.AudioSource.CAMCORDER)
                    .setAudioFormat(audioFormat())
                    .setBufferSizeInBytes(bufferSize)
                    .build()
                    .also(::requireInitialized)
            } else {
                null
            }
            device.startRecording()
            microphone?.startRecording()
            check(device.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                "端末内部音声の録音を開始できませんでした"
            }
            check(microphone == null || microphone.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                "マイク録音を開始できませんでした"
            }
            running.set(true)
            deviceRecord = device
            microphoneRecord = microphone
            deviceThread = capture(device, devicePcm, "furilog-device-audio")
            if (microphone != null) {
                microphoneThread = capture(microphone, microphonePcm, "furilog-microphone-audio")
            }
        } catch (error: Exception) {
            running.set(false)
            try {
                device?.stop()
            } catch (_: Exception) {
                // The recorder may not have reached the recording state.
            }
            try {
                microphone?.stop()
            } catch (_: Exception) {
                // The recorder may not have reached the recording state.
            }
            device?.release()
            microphone?.release()
            deleteTemporaryFiles()
            throw error
        }
    }

    fun stop() {
        if (!running.getAndSet(false)) return
        listOfNotNull(deviceRecord, microphoneRecord).forEach { record ->
            try {
                record.stop()
            } catch (_: IllegalStateException) {
                // A blocked read may already have left the recording state.
            }
        }
        deviceThread?.join(CAPTURE_THREAD_JOIN_MILLIS)
        microphoneThread?.join(CAPTURE_THREAD_JOIN_MILLIS)
        deviceRecord?.release()
        microphoneRecord?.release()
        deviceRecord = null
        microphoneRecord = null
    }

    fun mergeIntoVideo(videoFile: File) {
        stop()
        val pcmToEncode = if (mode == AudioMode.MICROPHONE_AND_DEVICE) {
            mixPcm(devicePcm, microphonePcm, mixedPcm)
            mixedPcm
        } else {
            devicePcm
        }
        if (!pcmToEncode.isFile || pcmToEncode.length() == 0L) {
            throw IllegalStateException("端末内部音声を取得できませんでした")
        }
        encodePcmToM4a(pcmToEncode, encodedAudio)
        val mergedVideo = File(videoFile.parentFile, "${videoFile.nameWithoutExtension}_merged.mp4")
        muxVideoAndAudio(videoFile, encodedAudio, mergedVideo)
        if (!videoFile.delete() || !mergedVideo.renameTo(videoFile)) {
            mergedVideo.delete()
            throw IllegalStateException("動画と音声を結合できませんでした")
        }
        deleteTemporaryFiles()
    }

    fun cancel() {
        stop()
        deleteTemporaryFiles()
    }

    private fun capture(record: AudioRecord, target: File, name: String): Thread = thread(
        start = true,
        isDaemon = true,
        name = name
    ) {
        BufferedOutputStream(FileOutputStream(target)).use { output ->
            val buffer = ByteArray(captureBufferSize())
            while (running.get()) {
                val read = record.read(buffer, 0, buffer.size, AudioRecord.READ_BLOCKING)
                if (read > 0) output.write(buffer, 0, read - (read % BYTES_PER_SAMPLE))
                else if (read < 0) break
            }
        }
    }

    private fun mixPcm(device: File, microphone: File, output: File) {
        BufferedInputStream(FileInputStream(device)).use { deviceInput ->
            BufferedInputStream(FileInputStream(microphone)).use { microphoneInput ->
                BufferedOutputStream(FileOutputStream(output)).use { mixedOutput ->
                    val deviceBuffer = ByteArray(MIX_BUFFER_BYTES)
                    val microphoneBuffer = ByteArray(MIX_BUFFER_BYTES)
                    while (true) {
                        val deviceRead = readAligned(deviceInput, deviceBuffer)
                        val microphoneRead = readAligned(microphoneInput, microphoneBuffer)
                        if (deviceRead <= 0 && microphoneRead <= 0) break
                        val count = max(deviceRead.coerceAtLeast(0), microphoneRead.coerceAtLeast(0))
                        var offset = 0
                        while (offset + 1 < count) {
                            val deviceSample = if (offset + 1 < deviceRead) sampleAt(deviceBuffer, offset) else 0
                            val microphoneSample = if (offset + 1 < microphoneRead) sampleAt(microphoneBuffer, offset) else 0
                            val mixed = mixDeviceAndMicrophoneSample(deviceSample, microphoneSample)
                            mixedOutput.write(mixed and 0xff)
                            mixedOutput.write((mixed shr 8) and 0xff)
                            offset += BYTES_PER_SAMPLE
                        }
                    }
                }
            }
        }
    }

    private fun readAligned(input: BufferedInputStream, buffer: ByteArray): Int {
        val read = input.read(buffer)
        return if (read > 0) read - (read % BYTES_PER_SAMPLE) else read
    }

    private fun sampleAt(buffer: ByteArray, offset: Int): Int =
        ((buffer[offset + 1].toInt() shl 8) or (buffer[offset].toInt() and 0xff)).toShort().toInt()

    private fun encodePcmToM4a(pcmFile: File, outputFile: File) {
        val codec = MediaCodec.createEncoderByType(AUDIO_MIME_TYPE)
        val format = MediaFormat.createAudioFormat(AUDIO_MIME_TYPE, SAMPLE_RATE, CHANNEL_COUNT).apply {
            setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            setInteger(MediaFormat.KEY_BIT_RATE, AUDIO_BIT_RATE)
            setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, ENCODER_INPUT_BYTES)
        }
        val muxer = MediaMuxer(outputFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        var muxerStarted = false
        try {
            codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            codec.start()
            FileInputStream(pcmFile).use { input ->
                val bufferInfo = MediaCodec.BufferInfo()
                var inputFinished = false
                var outputFinished = false
                var submittedSamples = 0L
                var audioTrack = -1
                while (!outputFinished) {
                    if (!inputFinished) {
                        val inputIndex = codec.dequeueInputBuffer(CODEC_TIMEOUT_US)
                        if (inputIndex >= 0) {
                            val inputBuffer = codec.getInputBuffer(inputIndex)
                                ?: throw IllegalStateException("音声エンコーダーを準備できませんでした")
                            inputBuffer.clear()
                            val bytes = ByteArray(minOf(inputBuffer.remaining(), ENCODER_INPUT_BYTES))
                            var read = input.read(bytes)
                            if (read > 0) {
                                read -= read % BYTES_PER_SAMPLE
                                inputBuffer.put(bytes, 0, read)
                                codec.queueInputBuffer(
                                    inputIndex,
                                    0,
                                    read,
                                    submittedSamples * 1_000_000L / SAMPLE_RATE,
                                    0
                                )
                                submittedSamples += read / BYTES_PER_SAMPLE
                            } else {
                                codec.queueInputBuffer(
                                    inputIndex,
                                    0,
                                    0,
                                    submittedSamples * 1_000_000L / SAMPLE_RATE,
                                    MediaCodec.BUFFER_FLAG_END_OF_STREAM
                                )
                                inputFinished = true
                            }
                        }
                    }
                    when (val outputIndex = codec.dequeueOutputBuffer(bufferInfo, CODEC_TIMEOUT_US)) {
                        MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                            audioTrack = muxer.addTrack(codec.outputFormat)
                            muxer.start()
                            muxerStarted = true
                        }
                        MediaCodec.INFO_TRY_AGAIN_LATER -> Unit
                        else -> if (outputIndex >= 0) {
                            val outputBuffer = codec.getOutputBuffer(outputIndex)
                                ?: throw IllegalStateException("音声データを作成できませんでした")
                            if (bufferInfo.size > 0 && audioTrack >= 0 &&
                                bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG == 0
                            ) {
                                outputBuffer.position(bufferInfo.offset)
                                outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
                                muxer.writeSampleData(audioTrack, outputBuffer, bufferInfo)
                            }
                            outputFinished = bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
                            codec.releaseOutputBuffer(outputIndex, false)
                        }
                    }
                }
            }
        } finally {
            try {
                codec.stop()
            } catch (_: Exception) {
                // Cleanup after codec failure.
            }
            codec.release()
            if (muxerStarted) muxer.stop()
            muxer.release()
        }
    }

    private fun muxVideoAndAudio(videoFile: File, audioFile: File, outputFile: File) {
        val videoExtractor = MediaExtractor()
        val audioExtractor = MediaExtractor()
        try {
            videoExtractor.setDataSource(videoFile.absolutePath)
            audioExtractor.setDataSource(audioFile.absolutePath)
            val videoTrackIndex = findTrack(videoExtractor, "video/")
            val audioTrackIndex = findTrack(audioExtractor, "audio/")
            check(videoTrackIndex >= 0 && audioTrackIndex >= 0) { "動画または音声の形式を確認できませんでした" }
            videoExtractor.selectTrack(videoTrackIndex)
            audioExtractor.selectTrack(audioTrackIndex)
            val videoFormat = videoExtractor.getTrackFormat(videoTrackIndex)
            val audioFormat = audioExtractor.getTrackFormat(audioTrackIndex)
            val muxer = MediaMuxer(outputFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            try {
                val rotation = MediaMetadataRetriever().run {
                    try {
                        setDataSource(videoFile.absolutePath)
                        extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
                    } finally {
                        release()
                    }
                }
                if (rotation != 0) muxer.setOrientationHint(rotation)
                val outputVideoTrack = muxer.addTrack(videoFormat)
                val outputAudioTrack = muxer.addTrack(audioFormat)
                muxer.start()
                copyTrack(videoExtractor, muxer, outputVideoTrack, Long.MAX_VALUE, 0)
                val videoDurationUs = if (videoFormat.containsKey(MediaFormat.KEY_DURATION)) {
                    videoFormat.getLong(MediaFormat.KEY_DURATION)
                } else {
                    Long.MAX_VALUE
                }
                copyTrack(audioExtractor, muxer, outputAudioTrack, videoDurationUs, audioDelayMs)
                muxer.stop()
            } finally {
                muxer.release()
            }
        } finally {
            videoExtractor.release()
            audioExtractor.release()
        }
    }

    private fun findTrack(extractor: MediaExtractor, prefix: String): Int =
        (0 until extractor.trackCount).firstOrNull { index ->
            extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)?.startsWith(prefix) == true
        } ?: -1

    private fun copyTrack(
        extractor: MediaExtractor,
        muxer: MediaMuxer,
        outputTrack: Int,
        maximumPresentationTimeUs: Long,
        delayMs: Int
    ) {
        val buffer = ByteBuffer.allocateDirect(MUX_BUFFER_BYTES)
        val info = MediaCodec.BufferInfo()
        var firstPresentationTimeUs = -1L
        while (true) {
            buffer.clear()
            val size = extractor.readSampleData(buffer, 0)
            if (size < 0) break
            val sampleTime = extractor.sampleTime
            if (firstPresentationTimeUs < 0) firstPresentationTimeUs = sampleTime
            val normalizedTime = (sampleTime - firstPresentationTimeUs).coerceAtLeast(0L)
            val shiftedTime = shiftedPresentationTimeUs(normalizedTime, delayMs)
            if (shiftedTime == null) {
                extractor.advance()
                continue
            }
            if (shiftedTime > maximumPresentationTimeUs) break
            info.set(0, size, shiftedTime, mediaCodecFlags(extractor.sampleFlags))
            muxer.writeSampleData(outputTrack, buffer, info)
            extractor.advance()
        }
    }

    private fun requireInitialized(record: AudioRecord) {
        check(record.state == AudioRecord.STATE_INITIALIZED) { "音声入力を初期化できませんでした" }
    }

    private fun audioFormat(): AudioFormat = AudioFormat.Builder()
        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
        .setSampleRate(SAMPLE_RATE)
        .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
        .build()

    private fun captureBufferSize(): Int = max(
        AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        ),
        MIN_CAPTURE_BUFFER_BYTES
    )

    private fun deleteTemporaryFiles() {
        listOf(devicePcm, microphonePcm, mixedPcm, encodedAudio).forEach { it.delete() }
    }

    companion object {
        private const val AUDIO_MIME_TYPE = MediaFormat.MIMETYPE_AUDIO_AAC
        private const val SAMPLE_RATE = 48_000
        private const val CHANNEL_COUNT = 1
        private const val BYTES_PER_SAMPLE = 2
        private const val AUDIO_BIT_RATE = 128_000
        private const val MIN_CAPTURE_BUFFER_BYTES = 16_384
        private const val MIX_BUFFER_BYTES = 16_384
        private const val ENCODER_INPUT_BYTES = 16_384
        private const val MUX_BUFFER_BYTES = 4 * 1024 * 1024
        private const val CODEC_TIMEOUT_US = 10_000L
        private const val CAPTURE_THREAD_JOIN_MILLIS = 2_000L
    }
}
