package id.fusionify.titip_mimi

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private lateinit var channel: MethodChannel
    private var permissionResult: MethodChannel.Result? = null

    override fun configureFlutterEngine(engine: FlutterEngine) {
        super.configureFlutterEngine(engine)
        channel = MethodChannel(engine.dartExecutor.binaryMessenger, "id.fusionify.titip_mimi/reminders")
        channel.setMethodCallHandler { call, result ->
            try {
                when (call.method) {
                    "allow" -> {
                        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                            if (permissionResult != null) result.error("busy", "Permission request pending", null)
                            else {
                                permissionResult = result
                                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7261)
                            }
                        } else result.success(MimiAlarm.prepare(this))
                    }
                    "sync", "disable" -> {
                        MimiAlarm.sync(this, call.arguments<Map<String, Number>>() ?: emptyMap(), call.method == "disable")
                        result.success(null)
                    }
                    "test" -> {
                        check(MimiAlarm.prepare(this))
                        MimiAlarm.set(this, MimiAlarm.testId, System.currentTimeMillis() + 60000)
                        result.success(null)
                    }
                    "take" -> {
                        val uri = intent.data
                        val id = uri?.takeIf { it.scheme == "mimi" && it.host == "agenda" }?.lastPathSegment
                        if (id != null) intent.data = null
                        result.success(id)
                    }
                    else -> result.notImplemented()
                }
            } catch (e: Exception) { result.error("reminder", e.message, null) }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (::channel.isInitialized) channel.invokeMethod("available", null)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 7261) {
            permissionResult?.success(grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED && MimiAlarm.prepare(this))
            permissionResult = null
        }
    }
}
