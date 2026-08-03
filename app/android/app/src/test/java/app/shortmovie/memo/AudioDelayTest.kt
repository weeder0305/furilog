package app.shortmovie.memo

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AudioDelayTest {
    @Test
    fun positiveDelayMovesAudioLater() {
        assertEquals(350_000L, shiftedPresentationTimeUs(150_000L, 200))
    }

    @Test
    fun negativeDelayDropsSamplesBeforeZeroAndMovesLaterSamplesEarlier() {
        assertNull(shiftedPresentationTimeUs(50_000L, -100))
        assertEquals(50_000L, shiftedPresentationTimeUs(150_000L, -100))
    }

    @Test
    fun delayIsLimitedToSupportedRange() {
        assertEquals(MAX_BLUETOOTH_DELAY_MS, clampBluetoothDelayMs(5_000))
        assertEquals(MIN_BLUETOOTH_DELAY_MS, clampBluetoothDelayMs(-5_000))
    }
}
