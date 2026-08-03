package app.shortmovie.memo

enum class AudioMode {
    MICROPHONE,
    DEVICE,
    MICROPHONE_AND_DEVICE,
    BLUETOOTH_DEVICE;

    val includesDeviceAudio: Boolean
        get() = this != MICROPHONE

    val includesMicrophone: Boolean
        get() = this == MICROPHONE || this == MICROPHONE_AND_DEVICE

    fun next(): AudioMode = when (this) {
        MICROPHONE -> DEVICE
        DEVICE -> MICROPHONE_AND_DEVICE
        MICROPHONE_AND_DEVICE -> MICROPHONE
        BLUETOOTH_DEVICE -> MICROPHONE
    }

    fun buttonLabel(): String = when (this) {
        MICROPHONE -> "音声 マイク"
        DEVICE -> "音声 内部"
        MICROPHONE_AND_DEVICE -> "音声 両方"
        BLUETOOTH_DEVICE -> "音声 BT補正"
    }
}
