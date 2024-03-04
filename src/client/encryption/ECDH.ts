import { arrayBufferToBase64, base64ToArrayBuffer } from "./Base64.js";

const cryptoSubtle = window.crypto.subtle;


export async function createKeyPair() {
  return await cryptoSubtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-521"
    },
    false,
    ['deriveKey', 'deriveBits']
  );
}

export async function importPublicKey(base64String: string) {
  let buffer = base64ToArrayBuffer(base64String);
  return await cryptoSubtle.importKey(
    "spki",
    buffer,
    {
      name: "ECDH",
      namedCurve: "P-521"
    },
    false,
    //no key usages because deriveBits and deriveKey
    //are only applied to the private key of a ECDH pair
    []
  );
}

export async function exportPublicKey(pubKey: CryptoKey) {
  return arrayBufferToBase64(await crypto.subtle.exportKey(
    'spki', 
    pubKey
  ));
}

export async function deriveAESKey(myPrivateKey: CryptoKey, theirPublicKey: CryptoKey, extractable: boolean = false) {
  return await cryptoSubtle.deriveKey(
    {
      name: "ECDH",
      public: theirPublicKey
    },
    myPrivateKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    extractable,
    ["encrypt", "decrypt"]
  );
}

export async function deriveBits(myPrivateKey: CryptoKey, theirPublicKey: CryptoKey) {
  return await cryptoSubtle.deriveBits(
    {
      name: "ECDH",
      public: theirPublicKey
    },
    myPrivateKey,
    256
  );
}
