import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_KEY = 'oauth.access_token';
const REFRESH_KEY = 'oauth.refresh_token';
const EXPIRY_KEY = 'oauth.expires_at';

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type Listener = (t: Tokens | null) => void;

let current: Tokens | null = null;
let initialized = false;
const listeners = new Set<Listener>();

async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return window.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string) {
  if (Platform.OS === 'web') {
    window.localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export async function initTokens(): Promise<Tokens | null> {
  if (initialized) return current;
  const [accessToken, refreshToken, expiresAtStr] = await Promise.all([
    getItem(ACCESS_KEY),
    getItem(REFRESH_KEY),
    getItem(EXPIRY_KEY),
  ]);
  if (accessToken && refreshToken && expiresAtStr) {
    current = { accessToken, refreshToken, expiresAt: Number(expiresAtStr) };
  }
  initialized = true;
  return current;
}

export function getTokens(): Tokens | null {
  return current;
}

export async function setTokens(t: Tokens | null) {
  current = t;
  if (t) {
    await Promise.all([
      setItem(ACCESS_KEY, t.accessToken),
      setItem(REFRESH_KEY, t.refreshToken),
      setItem(EXPIRY_KEY, String(t.expiresAt)),
    ]);
  } else {
    await Promise.all([removeItem(ACCESS_KEY), removeItem(REFRESH_KEY), removeItem(EXPIRY_KEY)]);
  }
  listeners.forEach((l) => l(current));
}

export function subscribeTokens(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
