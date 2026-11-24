import Flutter
import UIKit
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    if let controller = window?.rootViewController as? FlutterViewController {
      let channel = FlutterMethodChannel(name: "id.fusionify.titip_mimi/reminders",
                                         binaryMessenger: controller.binaryMessenger)
      let center = UNUserNotificationCenter.current()
      channel.setMethodCallHandler { call, reply in
        func finish(_ value: Any?) { DispatchQueue.main.async { reply(value) } }
        switch call.method {
        case "authorize":
          center.requestAuthorization(options: [.alert, .sound]) { allowed, _ in finish(allowed) }
        case "replace":
          guard let rows = call.arguments as? [[String: Any]] else {
            finish(FlutterError(code: "arguments", message: "Invalid reminders", details: nil))
            return
          }
          center.getPendingNotificationRequests { pending in
            let prefix = "mimi.agenda."
            let wanted = Set(rows.prefix(60).compactMap { ($0["id"] as? String).map { prefix + $0 } })
            let obsolete = pending.map(\.identifier).filter { $0.hasPrefix(prefix) && !wanted.contains($0) }
            center.removePendingNotificationRequests(withIdentifiers: obsolete)
            center.getNotificationSettings { settings in
              guard rows.isEmpty || settings.authorizationStatus != .denied else { finish("denied"); return }
              let group = DispatchGroup()
              let lock = NSLock()
              var failed = false
              for row in rows.prefix(60) {
                guard let id = row["id"] as? String, let at = row["at"] as? NSNumber else { continue }
                let delay = at.doubleValue / 1000 - Date().timeIntervalSince1970
                guard delay > 0 else { continue }
                let content = UNMutableNotificationContent()
                content.title = "Mimi mau ingetin ♡"
                content.body = "Ada agenda yang kamu titipkan. Yuk, buka Mimi."
                content.sound = .default
                let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, delay), repeats: false)
                group.enter()
                center.add(UNNotificationRequest(identifier: prefix + id, content: content, trigger: trigger)) { error in
                  if error != nil { lock.lock(); failed = true; lock.unlock() }
                  group.leave()
                }
              }
              group.notify(queue: .main) {
                if failed { reply(FlutterError(code: "schedule", message: "Scheduling failed", details: nil)) }
                else { reply(rows.count > 60 ? "limited" : "ok") }
              }
            }
          }
        default: reply(FlutterMethodNotImplemented)
        }
      }
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
