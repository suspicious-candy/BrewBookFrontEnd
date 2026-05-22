import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { CLIENT_ID, SCOPES, discovery, redirectUri } from './config';
import { Tokens, getTokens, initTokens, setTokens, subscribeTokens } from './tokenStore';

WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  isReady: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function toTokens(result: AuthSession.TokenResponse, fallbackRefresh?: string): Tokens {
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken ?? fallbackRefresh ?? '',
    expiresAt: Date.now() + (result.expiresIn ?? 900) * 1000,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setLocalTokens] = useState<Tokens | null>(null);
  const [isReady, setReady] = useState(false);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery,
  );

  useEffect(() => {
    initTokens().then((t) => {
      setLocalTokens(t);
      setReady(true);
    });
    return subscribeTokens(setLocalTokens);
  }, []);

  useEffect(() => {
    if (response?.type !== 'success') return;
    const code = response.params.code;
    const codeVerifier = request?.codeVerifier;
    if (!code || !codeVerifier) return;
    AuthSession.exchangeCodeAsync(
      {
        clientId: CLIENT_ID,
        code,
        redirectUri,
        extraParams: { code_verifier: codeVerifier },
      },
      discovery,
    )
      .then((r) => setTokens(toTokens(r)))
      .catch((err) => console.error('Token exchange failed', err));
  }, [response, request?.codeVerifier]);

  const signIn = useCallback(async () => {
    if (!request) return false;
    const result = await promptAsync();
    return result.type === 'success';
  }, [request, promptAsync]);

  const signOut = useCallback(async () => {
    await setTokens(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      isReady,
      isAuthenticated: !!tokens,
      accessToken: tokens?.accessToken ?? null,
      signIn,
      signOut,
    }),
    [isReady, tokens, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export async function refreshTokens(): Promise<Tokens | null> {
  const current = getTokens();
  if (!current?.refreshToken) return null;
  try {
    const result = await AuthSession.refreshAsync(
      { clientId: CLIENT_ID, refreshToken: current.refreshToken },
      discovery,
    );
    const next = toTokens(result, current.refreshToken);
    await setTokens(next);
    return next;
  } catch {
    await setTokens(null);
    return null;
  }
}
