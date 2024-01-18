import { arrayBufferToBase64, base64ToArrayBuffer } from "./Base64.js";

const cryptoSubtle = window.crypto.subtle;


export async function getKeyPair() {
  let pair = await cryptoSubtle.generateKey(
    {
      name: "RSA-OAEP",
      // Consider using a 4096-bit key for systems that require long-term security
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-512",
    },
    true,
    ["encrypt", "decrypt"]
  );

  return pair;
}

export async function exportPublicKey(key: CryptoKey) {
  return arrayBufferToBase64(await cryptoSubtle.exportKey('spki', key));
}

export async function importPublicKey(base64String: string) {
  let buffer = base64ToArrayBuffer(base64String);
  return await cryptoSubtle.importKey(
    "spki", 
    buffer, 
    {
      name: "RSA-OAEP",
      hash: "SHA-512",
    },
    true,
    ["encrypt"]
  );
}

export async function encrypt(message: string, publicKey: CryptoKey) {
  let encMessage = new TextEncoder().encode(message);

  return await cryptoSubtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    publicKey,
    encMessage
  );
}

export async function decrypt(cyphertext: ArrayBuffer, privateKey: CryptoKey) {
  let decrypted = await cryptoSubtle.decrypt(
    {
      name: "RSA-OAEP",
    },
    privateKey,
    cyphertext
  );

  return new TextDecoder().decode(decrypted);
}