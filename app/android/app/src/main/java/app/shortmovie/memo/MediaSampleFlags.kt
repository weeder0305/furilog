package app.shortmovie.memo

import android.media.MediaCodec
import android.media.MediaExtractor

internal fun mediaCodecFlags(extractorFlags: Int): Int {
    var codecFlags = 0
    if (extractorFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0) {
        codecFlags = codecFlags or MediaCodec.BUFFER_FLAG_KEY_FRAME
    }
    if (extractorFlags and MediaExtractor.SAMPLE_FLAG_PARTIAL_FRAME != 0) {
        codecFlags = codecFlags or MediaCodec.BUFFER_FLAG_PARTIAL_FRAME
    }
    return codecFlags
}
