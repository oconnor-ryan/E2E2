import { base64ToArrayBuffer } from "../encryption/Base64.js";
import * as ecdh from "../encryption/ECDH.js";
import * as hkdf from "../encryption/HKDF.js";


export async function x3dh_sender(
  myIdKey: CryptoKey,
  myEphemeralKey: CryptoKey,
  theirIdKey: CryptoKey,
  theirPreKey: CryptoKey
) {
  //perform 3 Diffie-Hellman functions record the derived bytes
  //from each function
  let dh1 = await ecdh.deriveBits(myIdKey, theirPreKey);
  let dh2 = await ecdh.deriveBits(myEphemeralKey, theirIdKey);
  let dh3 = await ecdh.deriveBits(myEphemeralKey, theirPreKey);




  //concatenate the raw bytes of each key into one input key material
  //for HKDF
  let keyMaterial = concatBuffers(dh1, dh2, dh3);



  //though not technically a key, the HKDF CryptoKey is used
  //as the input key material (IKM) for the deriveKey function,
  //which actually performs HKDF. 
  let hkdfKey = await hkdf.importKey(keyMaterial);

  //generate 20 random bytes as the salt for HKDF
  let salt = window.crypto.getRandomValues(new Uint8Array(20));


  //perform HKDF function and get the AES key derived from it.
  let secretKey = await hkdf.deriveKey(hkdfKey, salt);


  return {secretKey: secretKey, salt: salt};
}

export async function x3dh_receiver(
  myIdKey: CryptoKey,
  myPreKey: CryptoKey,
  theirIdKey: CryptoKey,
  theirEphemeralKey: CryptoKey,
  saltBase64: string
) {
  //perform 3 Diffie-Hellman functions record the derived bytes
  //from each function. 
  //Notice that this is almost identical to x3dh_sender except 
  //the public and private keys are swapped.
  let dh1 = await ecdh.deriveBits(myPreKey, theirIdKey);
  let dh2 = await ecdh.deriveBits(myIdKey, theirEphemeralKey);
  let dh3 = await ecdh.deriveBits(myPreKey, theirEphemeralKey);


  //concatenate the raw bytes of each key into one input key material
  //for HKDF
  let keyMaterial = concatBuffers(dh1, dh2, dh3);



  //though not technically a key, the HKDF CryptoKey is used
  //as the input key material (IKM) for the deriveKey function,
  //which actually performs HKDF. 
  let hkdfKey = await hkdf.importKey(keyMaterial);

  let salt = base64ToArrayBuffer(saltBase64);


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

  for(let i = 0, offset = 0; i < buffers.length; i++) {
    newBuffer.set(new Uint8Array(buffers[i]), offset);
    offset += buffers[i].byteLength;
  }

  return newBuffer.buffer;
}