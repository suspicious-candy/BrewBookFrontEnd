import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState } from 'react-native';

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

if (!extra.supabaseUrl || !extra.supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config. Set extra.supabaseUrl and extra.supabaseAnonKey in app.json.',
  );
}

export const supabase = createClient(extra.supabaseUrl, extra.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // detectSessionInUrl is a web/SSR concept — disable for React Native.
    detectSessionInUrl: false,
  },
});

// Pause/resume the auto-refresh timer when the app goes background/foreground.
// Without this, refresh keeps running and burns battery, or fails silently.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
