import { API_PATHS } from '@native-location/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { API_HTTP_URL, apiAuthHeaders } from './config';

const DEVICE_ID_KEY = 'native_location.device_id';

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const platform =
    Platform.OS === 'ios' || Platform.OS === 'android'
      ? Platform.OS
      : 'unknown';

  const response = await fetch(`${API_HTTP_URL}${API_PATHS.registerDevice}`, {
    method: 'POST',
    headers: apiAuthHeaders(),
    body: JSON.stringify({
      platform,
      displayName: `${platform}-device`,
    }),
  });

  if (!response.ok) {
    throw new Error(`device register failed: ${response.status}`);
  }

  const data = (await response.json()) as { deviceId: string };
  await AsyncStorage.setItem(DEVICE_ID_KEY, data.deviceId);
  return data.deviceId;
}
