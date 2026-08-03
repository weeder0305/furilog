package app.shortmovie.memo

import android.media.MediaCodec
import android.media.MediaExtractor
import org.junit.Assert.assertEquals
import org.junit.Test

class MediaSampleFlagsTest {
    @Test
    fun syncSampleBecomesCodecKeyFrame() {
        assertEquals(
            MediaCodec.BUFFER_FLAG_KEY_FRAME,
            mediaCodecFlags(MediaExtractor.SAMPLE_FLAG_SYNC)
        )
    }

    @Test
    fun partialFrameUsesCodecFlagValue() {
        assertEquals(
            MediaCodec.BUFFER_FLAG_PARTIAL_FRAME,
            mediaCodecFlags(MediaExtractor.SAMPLE_FLAG_PARTIAL_FRAME)
        )
    }

    @Test
    fun unknownAndEncryptedFlagsAreNotForwarded() {
        assertEquals(0, mediaCodecFlags(MediaExtractor.SAMPLE_FLAG_ENCRYPTED))
    }
}
