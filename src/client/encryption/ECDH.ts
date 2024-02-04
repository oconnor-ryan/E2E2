import { arrayBufferToBase64 } from "./Base64.js";

const cryptoSubtle = window.crypto.subtle;


export async function createKeyPair() {
  return await cryptoSubtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-521"
    },
    false,
    ['deriveKey']
  );
}

export async function exportPublicKey(pubKey: CryptoKey) {
  return arrayBufferToBase64(await crypto.subtle.exportKey(
    'spki', 
    pubKey
  ));
}

export async function deriveAESKey(myPrivateKey: CryptoKey, theirPublicKey: CryptoKey) {
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
    false,
    ["encrypt", "decrypt"]
  );
}
