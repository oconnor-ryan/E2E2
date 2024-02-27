import { base64ToArrayBuffer } from "../encryption/Base64.js";
import * as ecdh from "../encryption/ECDH.js";
import * as hkdf from "../encryption/HKDF.js";


export async function x3dh_sender(
  myIdKey: CryptoKey,
  myEphemeralKey: CryptoKey,
  theirIdKey: CryptoKey,
  theirPreKey: CryptoKey
) {
  return await x3dh(
    myIdKey,
    myEphemeralKey,
    theirIdKey,
    theirPreKey
  );
}

export async function x3dh_receiver(
  myIdKey: CryptoKey,
  myPreKey: CryptoKey,
  theirIdKey: CryptoKey,
  theirEphemeralKey: CryptoKey,
  saltBase64: string
) {
  return await x3dh(
    myIdKey,
    myPreKey,
    theirIdKey,
    theirEphemeralKey,
    saltBase64
  );
}

async function x3dh(
  privateIdKey: CryptoKey, 
  privateEphemeralOrPreKey: CryptoKey, 
  publicIdKey: CryptoKey,
  publicEphemeralOrPreKey: CryptoKey,
  saltBase64?: string
) {

  //perform 3 Diffie-Hellman functions record the derived bytes
  //from each function
  let dh1 = await ecdh.deriveBits(privateIdKey, publicEphemeralOrPreKey);
  let dh2 = await ecdh.deriveBits(privateEphemeralOrPreKey, publicIdKey);
  let dh3 = await ecdh.deriveBits(privateEphemeralOrPreKey, publicEphemeralOrPreKey);

  //concatenate the raw bytes of each key into one input key material
  //for HKDF
  let keyMaterial = concatBuffers(dh1, dh2, dh3);

  //though not technically a key, the HKDF CryptoKey is used
  //as the input key material (IKM) for the deriveKey function,
  //which actually performs HKDF. 
  let hkdfKey = await hkdf.importKey(keyMaterial);

  let salt;
  if(!saltBase64) {
    //generate 20 random bytes as the salt for HKDF
    salt = window.crypto.getRandomValues(new Uint8Array(20));
  } else {
    salt = base64ToArrayBuffer(saltBase64);
  }

  //perform HKDF function and get the AES key derived from it.
  let secretKey = await hkdf.deriveKey(hkdfKey, salt);

  return {secretKey: secretKey, salt: salt};
}

/**
 * Concatenates a list of buffers into a single ArrayBuffer.
 * Each buffer is stored in the returned buffer in the order it appears in 
 * the 'buffers' parameter
 * @param buffers 
 * @returns 
 */
function concatBuffers(...buffers: ArrayBuffer[]) {
  let byteLength = 0;
  for(let buffer of buffers) {
    byteLength += buffer.byteLength;
  }

  let newBuffer = new Uint8Array(byteLength);

  for(let i = 0; i < buffers.length; i++) {
    newBuffer.set(new Uint8Array(buffers[i]), i == 0 ? 0 : buffers[i-1].byteLength);
  }

  return newBuffer.buffer;
}