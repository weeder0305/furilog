package app.shortmovie.memo

internal const val MIN_BLUETOOTH_DELAY_MS = -1_000
internal const val MAX_BLUETOOTH_DELAY_MS = 1_000
internal const val BLUETOOTH_DELAY_STEP_MS = 10

internal fun clampBluetoothDelayMs(value: Int): Int =
    value.coerceIn(MIN_BLUETOOTH_DELAY_MS, MAX_BLUETOOTH_DELAY_MS)

internal fun shiftedPresentationTimeUs(normalizedTimeUs: Long, delayMs: Int): Long? {
    val shifted = normalizedTimeUs + clampBluetoothDelayMs(delayMs) * 1_000L
    return shifted.takeIf { it >= 0L }
}
