import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

export type FirestoreConnectionStatus = 'checking' | 'connected' | 'offline';

let currentStatus: FirestoreConnectionStatus = 'checking';
const statusListeners = new Set<(status: FirestoreConnectionStatus) => void>();

function updateConnectionStatus(next: FirestoreConnectionStatus): void {
  currentStatus = next;
  for (const listener of statusListeners) {
    listener(next);
  }
}

export function getFirestoreConnectionStatus(): FirestoreConnectionStatus {
  return currentStatus;
}

export function subscribeFirestoreStatus(
  listener: (status: FirestoreConnectionStatus) => void
): () => void {
  statusListeners.add(listener);
  listener(currentStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<FirestoreConnectionStatus> {
  updateConnectionStatus('checking');
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    updateConnectionStatus('connected');
    return 'connected';
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (msg.includes('the client is offline') || msg.includes('unavailable')) {
      console.error('Please check your Firebase configuration.');
      updateConnectionStatus('offline');
      return 'offline';
    }
    // A permission-denied response from Firestore server still proves live server reachability
    updateConnectionStatus('connected');
    return 'connected';
  }
}

void testConnection();

export function formatFirebaseAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code || '';
  if (code === 'auth/popup-closed-by-user' || raw.includes('popup-closed-by-user')) {
    return 'Google sign-in window was closed before completing.';
  }
  if (code === 'auth/popup-blocked' || raw.includes('popup-blocked')) {
    return 'Popup was blocked by the browser. Please allow popups for this site and click Connect Firebase again.';
  }
  if (code === 'auth/unauthorized-domain' || raw.includes('unauthorized-domain')) {
    return `Domain "${window.location.hostname}" is not authorized in Firebase Auth. Open the authorized preview URL or add it in Firebase Console.`;
  }
  if (
    code === 'auth/operation-not-supported-in-this-environment' ||
    raw.includes('operation-not-supported-in-this-environment')
  ) {
    return 'Google popup login requires HTTPS/browser context. For APK builds, point CAPACITOR_SERVER_URL to your live HTTPS URL or use the web console.';
  }
  if (code === 'auth/network-request-failed' || raw.includes('network-request-failed')) {
    return 'Network error reaching Firebase Auth. Please check your internet connection.';
  }
  return raw || 'Unable to connect Google / Firebase account. Please try again.';
}

export async function signInWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, googleAuthProvider);
  await testConnection();
  return credential.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export { firebaseConfig };
