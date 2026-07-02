import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';

/**
 * Storage adapter for supabase-js auth that keeps session data encrypted
 * at rest. SecureStore (iOS Keychain / Android Keystore) has a ~2048-byte
 * per-value limit that Supabase session objects can exceed, so the session
 * itself lives in AsyncStorage as AES-256-CTR ciphertext and only the
 * 256-bit encryption key is kept in SecureStore.
 */
export class LargeSecureStore {
  private async _encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));

    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(1)
    );
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(
      key,
      aesjs.utils.hex.fromBytes(encryptionKey)
    );

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) {
      return null;
    }

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1)
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) {
      return stored;
    }

    const hasEncryptionKey = !!(await SecureStore.getItemAsync(key));
    if (!hasEncryptionKey) {
      // Value predates encryption (written when supabase-js used raw
      // AsyncStorage). Supabase sessions are JSON objects; anything else
      // is unrecoverable without a key, so drop it.
      if (stored.startsWith('{')) {
        await this.setItem(key, stored);
        return stored;
      }
      await this.removeItem(key);
      return null;
    }

    try {
      return await this._decrypt(key, stored);
    } catch {
      // Corrupt ciphertext or key mismatch — clear so auth can recover
      // with a fresh login instead of crashing on every launch.
      await this.removeItem(key);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}
