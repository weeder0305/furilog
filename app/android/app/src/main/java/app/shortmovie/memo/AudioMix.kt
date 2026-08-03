package app.shortmovie.memo

import kotlin.math.roundToInt

internal const val DEVICE_AUDIO_GAIN = 0.55f
internal const val MICROPHONE_AUDIO_GAIN = 1.20f

internal fun mixDeviceAndMicrophoneSample(deviceSample: Int, microphoneSample: Int): Int =
    (deviceSample * DEVICE_AUDIO_GAIN + microphoneSample * MICROPHONE_AUDIO_GAIN)
        .roundToInt()
        .coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt())
