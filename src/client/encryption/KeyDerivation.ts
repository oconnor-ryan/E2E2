const cryptoSubtle = window.crypto.subtle;


export async function getKey(password: string, salt: BufferSource) {
  let enc = new TextEncoder();
  let keyMaterial = await cryptoSubtle.importKey(
    "raw",
    enc.encode(password),
    {name: "PBKDF2"},
    false,
    ["deriveBits", "deriveKey"]
  );

  return cryptoSubtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 600000,
      hash: "SHA-256"
    },
    keyMaterial,
    {"name": "AES-GCM", "length": 256},
    true,
    ["encrypt", "decrypt"]
  );

}

export async function encrypt(message: string, password: string, salt: Uint8Array, iv: Uint8Array) {
  let encMessage = new TextEncoder().encode(message);
  let key = await getKey(password, salt);

  return await cryptoSubtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    encMessage
  );
}

export async function decrypt(cyphertext: ArrayBuffer, password: string, salt: Uint8Array, iv: Uint8Array) {
  let key = await getKey(password, salt);
  let decrypted = await cryptoSubtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    cyphertext
  );

  return new TextDecoder().decode(decrypted);
}

