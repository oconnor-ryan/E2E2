import { base64ToArrayBuffer } from "./Base64.js";
import { ECDHPrivateKey, ECDHPublicKey, HKDFKey } from "../encryption/encryption.js";

export async function x3dh_sender(
  myIdKey: ECDHPrivateKey,
  myEphemeralKey: ECDHPrivateKey,
  theirIdKey: ECDHPublicKey,
  theirPreKey: ECDHPublicKey
) {
  //perform 3 Diffie-Hellman functions record the derived bytes
  //from each function
 // let dh1 = await ecdh.deriveBits(myIdKey, theirPreKey); //authenticate with myIdKey
  //let dh2 = await ecdh.deriveBits(myEphemeralKey, theirIdKey); //authenticate with their Id Key
  //let dh3 = await ecdh.deriveBits(myEphemeralKey, theirPreKey); //forward secrecy by using ephemeral/short-term keys

  let dh1 = await myIdKey.deriveBits(theirPreKey);
  let dh2 = await myEphemeralKey.deriveBits(theirIdKey);
  let dh3 = await myEphemeralKey.deriveBits(theirPreKey);

  //TODO: in full X3DH, there is a 4th DH performed for one-time-keys to
  //improve forward secrecy, consider implementing this in future

  //concatenate the raw bytes of each key into one input key material
  //for HKDF
  let keyMaterial = concatBuffers(dh1, dh2, dh3);



  //though not technically a key, the HKDF CryptoKey is used
  //as the input key material (IKM) for the deriveKey function,
  //which actually performs HKDF. 
  let hkdfKey = await HKDFKey.importKey(keyMaterial);

  //perform HKDF function and get the AES key derived from it.
  let {key, salt} = await hkdfKey.deriveAesGcmKey();


  return {secretKey: key, salt: salt};
}

export async function x3dh_receiver(
  myIdKey: ECDHPrivateKey,
  myPreKey: ECDHPrivateKey,
  theirIdKey: ECDHPublicKey,
  theirEphemeralKey: ECDHPublicKey,
  saltBase64: string
) {
  //perform 3 Diffie-Hellman functions record the derived bytes
  //from each function. 
  //Notice that this is almost identical to x3dh_sender except 
  //the public and private keys are swapped.
  let dh1 = await myPreKey.deriveBits(theirIdKey);
  let dh2 = await myIdKey.deriveBits(theirEphemeralKey);
  let dh3 = await myPreKey.deriveBits(theirEphemeralKey);


  //concatenate the raw bytes of each key into one input key material
  //for HKDF
  let keyMaterial = concatBuffers(dh1, dh2, dh3);



  //though not technically a key, the HKDF CryptoKey is used
  //as the input key material (IKM) for the deriveKey function,
  //which actually performs HKDF. 
  let hkdfKey = await HKDFKey.importKey(keyMaterial);

  let salt = base64ToArrayBuffer(saltBase64);


  //perform HKDF function and get the AES key derived from it.
  let secretKey = (await hkdfKey.deriveAesGcmKey(salt)).key;


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