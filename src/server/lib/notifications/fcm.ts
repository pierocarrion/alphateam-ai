/**
 * Firebase Cloud Messaging (FCM) adapter.
 *
 * Sends web push notifications to registered device tokens. The `firebase-admin`
 * SDK is loaded lazily so the app builds and runs even before the dependency /
 * credentials are configured — in that case pushes are skipped with a warning.
 *
 * Required env (server-side):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY       (PEM; \n escapes OK)
 *   NEXT_PUBLIC_FCM_VAPID_KEY  (web push VAPID public key, used client-side)
 */
import { createLogger } from "@/shared/lib/logger";

const log = createLogger("fcm");

interface MessagingLike {
  sendEachForMulticast(message: {
    tokens: string[];
    notification?: { title: string; body: string };
    data?: Record<string, string>;
    webpush?: unknown;
  }): Promise<{ responses: Array<{ success: boolean; error?: Error }> }>;
}

let messagingPromise: Promise<MessagingLike | null> | null = null;

function getMessaging(): Promise<MessagingLike | null> {
  if (messagingPromise) return messagingPromise;
  messagingPromise = (async () => {
    const configured = Boolean(
      process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
    );
    if (!configured) {
      log.warn("FCM credentials missing — push notifications disabled");
      return null;
    }
    try {
      const admin = await import("firebase-admin");
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
      };
      if (!admin.apps?.length) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      }
      log.info("FCM initialized");
      return admin.messaging() as unknown as MessagingLike;
    } catch (err) {
      log.error("FCM init failed", err);
      return null;
    }
  })();
  return messagingPromise;
}

export interface PushPayload {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  url?: string;
}

/**
 * Sends a push to the given tokens. Returns the number of successful delivers.
 * Never throws — push failures are logged and swallowed so the calling flow
 * (which already persisted the in-app notification) is not affected.
 */
export async function sendPush(payload: PushPayload): Promise<number> {
  if (!payload.tokens.length) return 0;
  try {
    const messaging = await getMessaging();
    if (!messaging) return 0;
    const result = await messaging.sendEachForMulticast({
      tokens: payload.tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      webpush: payload.url ? { fcmOptions: { link: payload.url } } : undefined,
    });
    return result.responses.reduce((acc, r) => acc + (r.success ? 1 : 0), 0);
  } catch (err) {
    log.error("FCM send failed", err);
    return 0;
  }
}
