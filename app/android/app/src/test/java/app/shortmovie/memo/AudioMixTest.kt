package app.shortmovie.memo

import org.junit.Assert.assertEquals
import org.junit.Test

class AudioMixTest {
    @Test
    fun microphoneIsLouderThanDeviceAtTheSameInputLevel() {
        assertEquals(17_500, mixDeviceAndMicrophoneSample(10_000, 10_000))
        assertEquals(5_500, mixDeviceAndMicrophoneSample(10_000, 0))
        assertEquals(12_000, mixDeviceAndMicrophoneSample(0, 10_000))
    }

    @Test
    fun mixedSampleIsClippedToPcm16Range() {
        assertEquals(Short.MAX_VALUE.toInt(), mixDeviceAndMicrophoneSample(30_000, 30_000))
        assertEquals(Short.MIN_VALUE.toInt(), mixDeviceAndMicrophoneSample(-30_000, -30_000))
    }
}
