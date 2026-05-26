import axios from 'axios';
import Constants from 'expo-constants';

import { supabase } from './config';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string };

if (!extra.apiBaseUrl) {
  throw new Error('Missing apiBaseUrl. Set extra.apiBaseUrl in app.json.');
}

export const api = axios.create({ baseURL: extra.apiBaseUrl });

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});
