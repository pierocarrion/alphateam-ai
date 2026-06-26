"use client";

import { useEffect, useRef } from "react";

/**
 * Registers an FCM web push token for the signed-in user.
 *
 * The Firebase client SDK (`firebase/app` + `firebase/messaging`) is loaded
 * lazily via dynamic import, so this hook is a safe no-op when:
 *   - running on the server,
 *   - the SDK isn't installed yet,
 *   - the VAPID key env var isn't configured,
 *   - the user denies notification permission.
 *
 * On success it POSTs the token to `/api/push/subscribe`.
 *
 * Module specifiers are passed through variables so TypeScript does not require
 * the (optional) `firebase` package to be installed at build time.
 */
export function useFcmToken(enabled: boolean): void {
  const registered = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    let cancelled = false;

    async function register(): Promise<void> {
      const vapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;
      const firebaseConfig = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
      if (!vapidKey || !firebaseConfig) return;

      try {
        if (Notification.permission === "default") {
          const perm = await Notification.requestPermission();
          if (perm !== "granted") return;
        } else if (Notification.permission !== "granted") {
          return;
        }

        const appSpecifier = "firebase/app";
        const messagingSpecifier = "firebase/messaging";
        const firebaseApp = (await import(
          /* @vite-ignore */ appSpecifier
        )) as {
          initializeApp: (cfg: unknown) => unknown;
        };
        const messagingMod = (await import(
          /* @vite-ignore */ messagingSpecifier
        )) as {
          getMessaging: (app: unknown) => unknown;
          getToken: (m: unknown, opts: { vapidKey: string }) => Promise<string>;
        };

        const app = firebaseApp.initializeApp(JSON.parse(firebaseConfig));
        const messaging = messagingMod.getMessaging(app);
        const token = await messagingMod.getToken(messaging, { vapidKey });
        if (cancelled || !token) return;
        if (registered.current === token) return;
        registered.current = token;

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          }),
        });
      } catch {
        // Silently ignore: push is a best-effort enhancement.
      }
    }

    register();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
