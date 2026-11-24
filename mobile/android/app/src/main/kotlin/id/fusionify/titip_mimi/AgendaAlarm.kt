package id.fusionify.titip_mimi

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

class AgendaAlarm : BroadcastReceiver() {
    companion object {
        private const val channel = "agenda"
        private fun store(context: Context) = context.getSharedPreferences("mimi_alarm", Context.MODE_PRIVATE)
        private fun notifications(context: Context) =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        fun createChannel(context: Context) {
            if (Build.VERSION.SDK_INT >= 26) notifications(context).createNotificationChannel(
                NotificationChannel(channel, "Pengingat agenda", NotificationManager.IMPORTANCE_DEFAULT)
            )
        }
        fun allowed(context: Context): Boolean {
            val manager = notifications(context)
            return (Build.VERSION.SDK_INT < 24 || manager.areNotificationsEnabled()) &&
                (Build.VERSION.SDK_INT < 26 || manager.getNotificationChannel(channel)?.importance != NotificationManager.IMPORTANCE_NONE)
        }
        private fun token(context: Context, id: String): PendingIntent {
            val intent = Intent(context, AgendaAlarm::class.java)
            intent.data = Uri.Builder().scheme("mimi").authority("agenda").appendPath(id).build()
            return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_IMMUTABLE)
        }
        fun replace(context: Context, desired: Map<String, Long>) {
            val prefs = store(context)
            val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            createChannel(context)
            for (id in prefs.all.keys - desired.keys) {
                manager.cancel(token(context, id))
                notifications(context).cancel(id, 1)
            }
            val editor = prefs.edit().clear()
            for ((id, time) in desired) {
                val alarm = token(context, id)
                if (Build.VERSION.SDK_INT >= 23) manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, alarm)
                else manager.set(AlarmManager.RTC_WAKEUP, time, alarm)
                editor.putLong(id, time)
            }
            check(editor.commit())
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        val prefs = store(context)
        val now = System.currentTimeMillis()
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            replace(context, prefs.all.mapNotNull { (id, value) ->
                (value as? Long)?.takeIf { it > now }?.let { id to it }
            }.toMap())
            return
        }
        val id = intent.data?.lastPathSegment ?: return
        if (!prefs.contains(id) || prefs.getLong(id, 0) > now || !allowed(context)) return
        val open = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val launch = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE)
        @Suppress("DEPRECATION")
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, channel) else Notification.Builder(context)
        notifications(context).notify(id, 1, builder.setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle("Mimi mau ingetin ♡")
            .setContentText("Ada agenda yang kamu titipkan. Yuk, buka Mimi.")
            .setContentIntent(launch).setAutoCancel(true).build())
    }
}
