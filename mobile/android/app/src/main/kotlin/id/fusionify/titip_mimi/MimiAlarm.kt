package id.fusionify.titip_mimi

import android.app.*
import android.content.*
import android.net.Uri
import android.os.Build
import org.json.JSONObject

class MimiAlarm : BroadcastReceiver() {
    companion object {
        const val channelId = "mimi_agenda"
        const val testId = "__test__"
        private fun store(c: Context) = c.getSharedPreferences("agenda_alarms", Context.MODE_PRIVATE)
        private fun current(c: Context) = JSONObject(store(c).getString("schedule", "{}") ?: "{}")
        private fun identity(id: String) = Uri.Builder().scheme("mimi").authority("agenda").appendPath(id).build()
        private val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

        fun prepare(c: Context): Boolean {
            val manager = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= 26) {
                manager.createNotificationChannel(NotificationChannel(channelId, "Pengingat agenda", NotificationManager.IMPORTANCE_HIGH))
                if (manager.getNotificationChannel(channelId).importance == NotificationManager.IMPORTANCE_NONE) return false
            }
            return Build.VERSION.SDK_INT < 24 || manager.areNotificationsEnabled()
        }

        private fun alarm(c: Context, id: String) = PendingIntent.getBroadcast(c, 0,
            Intent(c, MimiAlarm::class.java).setData(identity(id)), flags)

        fun set(c: Context, id: String, at: Long) {
            val manager = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            if (Build.VERSION.SDK_INT >= 23) manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarm(c, id))
            else manager.set(AlarmManager.RTC_WAKEUP, at, alarm(c, id))
        }

        fun sync(c: Context, entries: Map<String, Number>, disable: Boolean) {
            val old = current(c)
            val manager = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val notifications = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            for (id in old.keys()) {
                if (id !in entries) {
                    manager.cancel(alarm(c, id))
                    notifications.cancel(id, 1)
                }
            }
            for ((id, time) in entries) {
                if (old.optLong(id) != time.toLong()) {
                    notifications.cancel(id, 1)
                    set(c, id, time.toLong())
                }
            }
            if (disable) {
                manager.cancel(alarm(c, testId))
                notifications.cancel(testId, 1)
            }
            check(store(c).edit().putString("schedule", JSONObject(entries).toString()).commit())
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        val schedule = current(context)
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            for (id in schedule.keys()) {
                val time = schedule.getLong(id)
                if (time > System.currentTimeMillis()) set(context, id, time)
            }
            return
        }
        val id = intent.data?.lastPathSegment ?: return
        if (id != testId && (!schedule.has(id) || schedule.getLong(id) > System.currentTimeMillis())) return
        if (!prepare(context)) return
        val tap = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java)
            .setData(identity(id)).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP), flags)
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        @Suppress("DEPRECATION")
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, channelId)
            else Notification.Builder(context).setPriority(Notification.PRIORITY_HIGH)
        manager.notify(id, 1, builder.setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(if (id == testId) "Tes pengingat Mimi" else "Mimi mau ingetin ♡")
            .setContentText("Ketuk untuk membuka Agenda.").setContentIntent(tap).setAutoCancel(true).build())
    }
}
