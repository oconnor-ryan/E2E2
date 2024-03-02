import { arrayBufferToBase64, base64ToArrayBuffer } from "./Base64.js";

const cryptoSubtle = window.crypto.subtle;



export async function importKey(base64String: string) {
  let buffer = base64ToArrayBuffer(base64String);
  return await cryptoSubtle.importKey(
    "spki",
    buffer,
    {
      name: "ECDSA",
      namedCurve: "P-521"
    },
    false,
    ["sign"]
  );
}

export async function createKeyPair() {
  return await cryptoSubtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-521"
    },
    false, //note that public key can be exported even if extractable is false, but private key is not
    ['sign']
  );
}

export async function exportPublicKey(pubKey: CryptoKey) {
  return arrayBufferToBase64(await crypto.subtle.exportKey(
    'spki', 
    pubKey
  ));
}

export async function sign(message: string, privateKey: CryptoKey) {
  let signature = await cryptoSubtle.sign(
    {
      name: 'ECDSA',
      hash: {name: 'SHA-512'}
    },
    privateKey,
    new TextEncoder().encode(message)
  );
  return arrayBufferToBase64(signature);
}