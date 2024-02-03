import { arrayBufferToBase64 } from "./Base64.js";

const cryptoSubtle = window.crypto.subtle;


export async function createKeyPair() {
  return await cryptoSubtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-521"
    },
    true,
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