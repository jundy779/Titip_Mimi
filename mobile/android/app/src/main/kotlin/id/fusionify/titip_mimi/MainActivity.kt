package id.fusionify.titip_mimi

import android.Manifest
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var permissionReply: MethodChannel.Result? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "id.fusionify.titip_mimi/reminders")
            .setMethodCallHandler { call, reply ->
                try {
                    when (call.method) {
                        "authorize" -> {
                            AgendaAlarm.createChannel(this)
                            if (Build.VERSION.SDK_INT >= 33 && !AgendaAlarm.allowed(this)) {
                                if (permissionReply != null) reply.error("busy", "Permission pending", null)
                                else {
                                    permissionReply = reply
                                    requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 749)
                                }
                            } else reply.success(AgendaAlarm.allowed(this))
                        }
                        "replace" -> {
                            val rows = call.arguments as List<*>
                            val desired = rows.take(60).associate { item ->
                                val row = item as Map<*, *>
                                row["id"] as String to (row["at"] as Number).toLong()
                            }
                            AgendaAlarm.replace(this, desired)
                            reply.success(when {
                                rows.isNotEmpty() && !AgendaAlarm.allowed(this) -> "denied"
                                rows.size > 60 -> "limited"
                                else -> "ok"
                            })
                        }
                        else -> reply.notImplemented()
                    }
                } catch (error: Exception) {
                    reply.error("schedule", error.javaClass.simpleName, null)
                }
            }
    }

    override fun onRequestPermissionsResult(code: Int, permissions: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(code, permissions, results)
        if (code == 749) {
            permissionReply?.success(AgendaAlarm.allowed(this))
            permissionReply = null
        }
    }
}
