package app.shortmovie.memo

import org.junit.Assert.assertEquals
import org.junit.Test

class ZoomLevelsTest {
    @Test
    fun cyclesFromOneToOnePointFiveToTwo() {
        assertEquals(1.5f, nextZoomRatio(1f, 4f))
        assertEquals(2f, nextZoomRatio(1.5f, 4f))
        assertEquals(1f, nextZoomRatio(2f, 4f))
    }

    @Test
    fun neverExceedsCameraMaximum() {
        assertEquals(1.25f, nextZoomRatio(1f, 1.25f))
        assertEquals(1f, nextZoomRatio(1.25f, 1.25f))
    }

    @Test
    fun fixedZoomCameraStaysAtOne() {
        assertEquals(1f, nextZoomRatio(1f, 1f))
    }
}
