import type { SecretStorage } from '../ApiKeyStore';

/** Szyfrowany magazyn telefonu udawany w pamięci. `fail*` udają błąd Keystore. */
export class MemorySecretStorage implements SecretStorage {
  failReads = false;
  failWrites = false;
  failRemoves = false;
  writes = 0;

  constructor(public value: string | null = null) {}

  async read() {
    if (this.failReads) throw new Error('KeyStoreException: odczyt');
    return this.value;
  }

  async write(value: string) {
    if (this.failWrites) throw new Error('KeyStoreException: zapis');
    this.writes++;
    this.value = value;
  }

  async remove() {
    if (this.failRemoves) throw new Error('KeyStoreException: usuwanie');
    this.value = null;
  }
}

/** Klucz w poprawnym formacie (nie prawdziwy). */
export const VALID_KEY = 'sk-proj-TESTOWY0123456789abcdWXYZ';
