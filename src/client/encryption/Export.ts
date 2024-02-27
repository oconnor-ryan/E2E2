const cryptoSubtle = window.crypto.subtle;

export async function exportRaw(key: CryptoKey) {
  return await cryptoSubtle.exportKey("raw", key);
}