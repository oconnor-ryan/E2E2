const cryptoSubtle = window.crypto.subtle;


export async function importKey(buffer: ArrayBuffer) {
  //extractable is always false for HKDF because
  //exportKey is not supported for HKDF
  return await cryptoSubtle.importKey(
    "raw", 
    buffer,
    "HKDF",
    false,
    ["deriveKey"]
  );
}

export async function deriveKey(keyMaterial: CryptoKey, salt: ArrayBuffer) {
  return await cryptoSubtle.deriveKey(
    {
      name: "HKDF",
      salt: salt,
      info: new Uint8Array([]),
      hash: "SHA-512",
    },
    keyMaterial,
    {
      name: "AES-GCM", 
      length: 256
    },
    true,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
}