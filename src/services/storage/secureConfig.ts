import * as SecureStore from 'expo-secure-store';

const ANTHROPIC_API_KEY_STORAGE_KEY = 'anthropic_api_key';

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(ANTHROPIC_API_KEY_STORAGE_KEY);
}

export async function setApiKey(apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(ANTHROPIC_API_KEY_STORAGE_KEY, apiKey.trim());
}

export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(ANTHROPIC_API_KEY_STORAGE_KEY);
}
