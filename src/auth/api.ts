import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import { RESOURCE_SERVER_URL } from './config';
import { refreshTokens } from './AuthContext';
import { getTokens, initTokens } from './tokenStore';

export const api: AxiosInstance = axios.create({
  baseURL: RESOURCE_SERVER_URL,
});

let inflightRefresh: Promise<string | null> | null = null;

function refreshOnce(): Promise<string | null> {
  if (!inflightRefresh) {
    inflightRefresh = refreshTokens()
      .then((t) => t?.accessToken ?? null)
      .finally(() => {
        inflightRefresh = null;
      });
  }
  return inflightRefresh;
}

api.interceptors.request.use(async (config) => {
  await initTokens();
  const tokens = getTokens();
  if (tokens?.accessToken) {
    config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const newAccess = await refreshOnce();
      if (newAccess) {
        original.headers.set('Authorization', `Bearer ${newAccess}`);
        return api.request(original);
      }
    }
    throw error;
  },
);
