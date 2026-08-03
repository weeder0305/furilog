package app.shortmovie.memo

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AudioModeTest {
    @Test
    fun modesCycleInDisplayedOrder() {
        assertEquals(AudioMode.DEVICE, AudioMode.MICROPHONE.next())
        assertEquals(AudioMode.MICROPHONE_AND_DEVICE, AudioMode.DEVICE.next())
        assertEquals(AudioMode.MICROPHONE, AudioMode.MICROPHONE_AND_DEVICE.next())
    }

    @Test
    fun deviceOnlyDoesNotIncludeMicrophone() {
        assertTrue(AudioMode.DEVICE.includesDeviceAudio)
        assertFalse(AudioMode.DEVICE.includesMicrophone)
        assertEquals("音声 内部", AudioMode.DEVICE.buttonLabel())
    }

    @Test
    fun defaultModeCapabilitiesAreMicrophoneOnly() {
        assertTrue(AudioMode.MICROPHONE.includesMicrophone)
        assertFalse(AudioMode.MICROPHONE.includesDeviceAudio)
        assertEquals("音声 マイク", AudioMode.MICROPHONE.buttonLabel())
    }

    @Test
    fun bluetoothModeUsesDeviceAudioWithoutMicrophone() {
        assertTrue(AudioMode.BLUETOOTH_DEVICE.includesDeviceAudio)
        assertFalse(AudioMode.BLUETOOTH_DEVICE.includesMicrophone)
        assertEquals(AudioMode.MICROPHONE, AudioMode.BLUETOOTH_DEVICE.next())
        assertEquals("音声 BT補正", AudioMode.BLUETOOTH_DEVICE.buttonLabel())
    }
}
