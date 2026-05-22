import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type Extra = {
  authServerUrl?: string;
  resourceServerUrl?: string;
  clientId?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

// Android emulator can't reach the host's localhost — it uses 10.0.2.2.
const defaultHost = Platform.OS === 'android' ? 'http://10.0.2.2' : 'http://localhost';

export const AUTH_SERVER_URL = extra.authServerUrl ?? `${defaultHost}:3000`;
export const RESOURCE_SERVER_URL = extra.resourceServerUrl ?? `${defaultHost}:5001`;
export const CLIENT_ID = extra.clientId ?? 'demo-client';
export const SCOPES = ['read', 'write'];

export const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `${AUTH_SERVER_URL}/oauth/authorize`,
  tokenEndpoint: `${AUTH_SERVER_URL}/oauth/token`,
};

export const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'brewbook',
  path: 'callback',
});

if (__DEV__) {
  console.log('[oauth] redirectUri =', redirectUri);
}
