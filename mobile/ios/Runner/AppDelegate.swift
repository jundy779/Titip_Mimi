import Flutter
import UIKit
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate {
  private let center = UNUserNotificationCenter.current()
  private let prefix = "mimi.agenda."
  private let testID = "__test__"
  private var pendingID: String?
  private var reminders: FlutterMethodChannel?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    center.delegate = self
    if let controller = window?.rootViewController as? FlutterViewController {
      let channel = FlutterMethodChannel(name: "id.fusionify.titip_mimi/reminders", binaryMessenger: controller.binaryMessenger)
      reminders = channel
      channel.setMethodCallHandler { [weak self] call, result in
        self?.handle(call, result)
      }
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  private func handle(_ call: FlutterMethodCall, _ result: @escaping FlutterResult) {
    switch call.method {
    case "allow":
      center.requestAuthorization(options: [.alert, .sound]) { allowed, _ in
        DispatchQueue.main.async { result(allowed) }
      }
    case "take":
      result(pendingID)
      pendingID = nil
    case "sync", "disable":
      guard let schedule = call.arguments as? [String: NSNumber] else {
        result(FlutterError(code: "input", message: "Invalid schedule", details: nil))
        return
      }
      sync(schedule, disable: call.method == "disable", result)
    case "test":
      center.getNotificationSettings { settings in
        guard [.authorized, .provisional].contains(settings.authorizationStatus) else {
          DispatchQueue.main.async { result(FlutterError(code: "permission", message: "Notifications disabled", details: nil)) }
          return
        }
        let at = NSNumber(value: (Date().timeIntervalSince1970 + 60) * 1000)
        self.center.add(self.request(self.testID, at)) { error in
          DispatchQueue.main.async { result(self.flutterError(error)) }
        }
      }
    default: result(FlutterMethodNotImplemented)
    }
  }

  private func flutterError(_ error: Error?) -> FlutterError? {
    error.map { FlutterError(code: "schedule", message: $0.localizedDescription, details: nil) }
  }

  private func request(_ id: String, _ millis: NSNumber) -> UNNotificationRequest {
    let content = UNMutableNotificationContent()
    content.title = id == testID ? "Tes pengingat Mimi" : "Mimi mau ingetin ♡"
    content.body = "Ketuk untuk membuka Agenda."
    content.sound = .default
    content.userInfo = ["id": id, "at": millis]
    let seconds = millis.doubleValue / 1000 - Date().timeIntervalSince1970
    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, seconds), repeats: false)
    return UNNotificationRequest(identifier: prefix + id, content: content, trigger: trigger)
  }

  private func sync(_ schedule: [String: NSNumber], disable: Bool, _ result: @escaping FlutterResult) {
    center.getPendingNotificationRequests { requests in
      let ours = requests.filter { $0.identifier.hasPrefix(self.prefix) }
      var changed = schedule
      var removed = [String]()
      for request in ours {
        let id = String(request.identifier.dropFirst(self.prefix.count))
        if id == self.testID && !disable { continue }
        if schedule[id] == nil { removed.append(request.identifier) }
        else if let old = request.content.userInfo["at"] as? NSNumber, old == schedule[id] {
          changed.removeValue(forKey: id)
        }
      }
      self.center.removePendingNotificationRequests(withIdentifiers: removed)
      let group = DispatchGroup()
      var firstError: Error?
      for (id, millis) in changed {
        group.enter()
        self.center.add(self.request(id, millis)) { error in
          DispatchQueue.main.async {
            if firstError == nil { firstError = error }
            group.leave()
          }
        }
      }
      group.notify(queue: .main) { result(self.flutterError(firstError)) }
    }
  }

  override func userNotificationCenter(_ center: UNUserNotificationCenter,
    willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    if #available(iOS 14.0, *) { completionHandler([.banner, .sound]) }
    else { completionHandler([.alert, .sound]) }
  }

  override func userNotificationCenter(_ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
    if let id = response.notification.request.content.userInfo["id"] as? String {
      pendingID = id
      reminders?.invokeMethod("available", arguments: nil)
    }
    completionHandler()
  }
}
