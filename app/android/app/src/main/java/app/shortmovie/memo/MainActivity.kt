package app.shortmovie.memo

import android.os.Bundle
import androidx.activity.OnBackPressedCallback
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(NativeCameraPlugin::class.java)
        super.onCreate(savedInstanceState)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                bridge.webView.evaluateJavascript(
                    "window.__furilogHandleNativeBack?.() === true"
                ) { handled ->
                    if (handled != "true") moveTaskToBack(true)
                }
            }
        })
    }
}
