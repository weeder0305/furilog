package app.shortmovie.memo

internal fun nextZoomRatio(current: Float, cameraMaximum: Float): Float {
    val maximum = minOf(2f, cameraMaximum.coerceAtLeast(1f))
    val levels = buildList {
        add(1f)
        if (maximum > 1.01f) add(minOf(1.5f, maximum))
        if (maximum > 1.51f) add(maximum)
    }.distinct()
    val currentIndex = levels.indexOfFirst { kotlin.math.abs(it - current) < 0.01f }
    return if (currentIndex < 0 || currentIndex == levels.lastIndex) 1f else levels[currentIndex + 1]
}
