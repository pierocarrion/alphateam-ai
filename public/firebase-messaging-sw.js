/**
 * Firebase Cloud Messaging service worker.
 *
 * Must live at the site root (`/firebase-messaging-sw.js`) so it controls the
 * whole origin. The Firebase SDK auto-registers it; placing it here ensures
 * background push messages are handled even when no app tab is open.
 *
 * Requires the `firebase` client package to be installed; if it isn't, this
 * file simply does nothing (caught dynamic import).
 */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

try {
  const config = self.__FIREBASE_CONFIG__;
  if (config) {
    firebase.initializeApp(config);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const n = payload.notification ?? {};
      if (n.title) {
        self.registration.showNotification(n.title, {
          body: n.body ?? "",
          data: payload.data ?? {},
        });
      }
    });
  }
} catch {
  // no-op
}
