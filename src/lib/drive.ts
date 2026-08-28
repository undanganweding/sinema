import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

let cachedAuth: ReturnType<typeof getAuth> | null = null;
let cachedProvider: GoogleAuthProvider | null = null;

function getFirebaseAuth() {
  if (!cachedAuth) {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      cachedAuth = getAuth(app);
    } catch (e) {
      console.warn('Firebase app init warning:', e);
      return null;
    }
  }
  return cachedAuth;
}

function getGoogleProvider() {
  if (!cachedProvider) {
    cachedProvider = new GoogleAuthProvider();
    cachedProvider.addScope('https://www.googleapis.com/auth/drive.file');
  }
  return cachedProvider;
}

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  try {
    const auth = getFirebaseAuth();
    if (!auth) {
      if (onAuthFailure) onAuthFailure();
      return () => {};
    }
    return onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        if (cachedAccessToken) {
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        } else if (!isSigningIn) {
          if (onAuthFailure) onAuthFailure();
        }
      } else {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    });
  } catch (err) {
    console.warn('initDriveAuth warning:', err);
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
};

export const googleSignInForDrive = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Konfigurasi Firebase belum siap.');
    }
    const provider = getGoogleProvider();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan access token dari Google Sign-In.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error for Google Drive:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const googleDriveSignOut = async () => {
  try {
    const auth = getFirebaseAuth();
    if (auth) {
      await signOut(auth);
    }
  } catch (e) {
    console.warn('Sign out warning:', e);
  }
  cachedAccessToken = null;
};

export interface DriveExportResult {
  fileId: string;
  name: string;
  webViewLink?: string;
}

export async function exportProjectToDrive(
  projectData: any,
  accessToken: string
): Promise<DriveExportResult> {
  const fileName = `Blueprint_${(projectData.title || 'Cinematic_Project').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.json`;
  const fileContent = JSON.stringify(projectData, null, 2);

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: 'AI Cinematic Production Studio - Blueprint Export',
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', new Blob([fileContent], { type: 'application/json' }));

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Drive Export failed: ${res.statusText} (${errorText})`);
  }

  const data = await res.json();
  return {
    fileId: data.id,
    name: data.name,
    webViewLink: data.webViewLink,
  };
}
