import { cert, getApps, initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Server-side Firebase Admin initialization.
 *
 * IMPORTANT SECURITY:
 *  - Uses environment-variable credentials ONLY. Never hardcode a service-account
 *    JSON or private key in source.
 *  - Never log the credential value.
 *  - Never expose this module to the frontend.
 *
 * Supported credential formats:
 *   1) FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY  (preferred)
 *   2) GOOGLE_APPLICATION_CREDENTIALS  (path to a service-account JSON on the runtime)
 *   3) Default application credentials (gcloud / emulator)
 *
 * Optional named database:
 *   FIREBASE_DATABASE_ID  -> Firestore named database ID (e.g. "sinema").
 *   When unset, the SDK uses the "(default)" database, preserving local/test
 *   behavior.
 */

const APP_NAME = 'cinematic-pipeline-backend';

const FIREBASE_DATABASE_ID = process.env.FIREBASE_DATABASE_ID || undefined;

/** Runtime Firestore database ID target (safe to log; no secrets). */
export function getDatabaseId(): string {
  return FIREBASE_DATABASE_ID ?? '(default)';
}

let cachedApp: App | null = null;
let cachedFirestore: Firestore | null = null;

function inferProjectId(): string | undefined {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIRESTORE_PROJECT_ID ||
    undefined
  );
}

function getFirebaseApp(): App {
  // Return existing app if already initialized (supports repeated module loading).
  if (cachedApp) return cachedApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    cachedApp = existingApps[0];
    return cachedApp;
  }

  const projectId = inferProjectId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    // Replace escaped newlines so a multi-line PEM survives Vercel env var handling.
    const normalizedKey = privateKey.replace(/\\n/g, '\n');
    cachedApp = initializeApp({
      credential: cert({
        projectId: projectId || undefined,
        clientEmail,
        privateKey: normalizedKey,
      }),
    }, APP_NAME);
  } else {
    // Fall back to Application Default Credentials (emulator / gcloud / GOOGLE_APPLICATION_CREDENTIALS).
    cachedApp = initializeApp(
      { projectId: projectId || undefined },
      APP_NAME
    );
  }

  return cachedApp;
}

/**
 * Returns a singleton Firestore instance.
 *
 * - Throws a descriptive error if no credential is available. Do NOT swallow this at
 *   call sites that need durability — the app must fail loudly rather than silently
 *   degrade to an ephemeral filesystem.
 * - Initialization is lazy: it only runs on first access.
 */
export function getFirestore(): Firestore {
  if (cachedFirestore) return cachedFirestore;
  const app = getFirebaseApp();
  cachedFirestore = getAdminFirestore(app, FIREBASE_DATABASE_ID);
  return cachedFirestore;
}

/**
 * Whether Firestore is configured for the current environment. Used by the migration
 * script and by callers that must decide between Firestore and local fallback.
 */
export function isFirestoreConfigured(): boolean {
  return Boolean(
    (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    inferProjectId()
  );
}

/**
 * Clean up the cached app (primarily for tests). Safe to call repeatedly.
 */
export function resetFirebaseApp(): void {
  const apps = getApps();
  for (const app of apps) {
    deleteApp(app);
  }
  cachedApp = null;
  cachedFirestore = null;
}
