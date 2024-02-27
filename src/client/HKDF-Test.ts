import * as hkdf from "./encryption/HKDF.js";
import * as ecdh from "./encryption/ECDH.js";
import * as aes from "./encryption/AES.js";
import { exportRaw } from "./encryption/Export.js";
import { arrayBufferToBase64, base64ToArrayBuffer } from "./encryption/Base64.js";
const cryptoSubtle = window.crypto.subtle;

const body = document.body;

(async () => {
  let ecdhPair1 = await ecdh.createKeyPair();
  let ephemeralKeyPair1 = await ecdh.createKeyPair();

  let ecdhPair2 = await ecdh.createKeyPair();
  let ecdhPreKey2 = await ecdh.createKeyPair();

  let dh1 = await ecdh.deriveBits(ecdhPair1.privateKey, ecdhPreKey2.publicKey);
  let dh2 = await ecdh.deriveBits(ephemeralKeyPair1.privateKey, ecdhPair2.publicKey);
  let dh3 = await ecdh.deriveBits(ephemeralKeyPair1.privateKey, ecdhPreKey2.publicKey);

  let buffer = new Uint8Array(dh1.byteLength + dh2.byteLength + dh3.byteLength);
  buffer.set(new Uint8Array(dh1), 0);
  buffer.set(new Uint8Array(dh2), dh1.byteLength);
  buffer.set(new Uint8Array(dh3), dh2.byteLength);

  let uiKeyMaterial1 = document.createElement('p');
  uiKeyMaterial1.textContent = arrayBufferToBase64(buffer);
  body.appendChild(uiKeyMaterial1);

  let hkdfKey = await hkdf.importKey(buffer);


  let aesKey = await hkdf.deriveKey(hkdfKey, window.crypto.getRandomValues(new Uint8Array(20)));


  let message = "HKDF function with concatenated AES Keys Derived from 3 ECDH functions!";

  let uiPlaintext = document.createElement('p');
  let uiCryptText = document.createElement('p');
  let uiDecryptText = document.createElement('p');


  uiPlaintext.textContent = message;
  body.appendChild(uiPlaintext)


  let enc = await aes.encrypt(message, aesKey);
  
  uiCryptText.textContent = enc;
  body.appendChild(uiCryptText);

  uiDecryptText.textContent = await aes.decrypt(enc, aesKey);
  body.appendChild(uiDecryptText);
  
})();