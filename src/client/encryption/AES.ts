import { base64ToArrayBuffer, arrayBufferToBase64 } from "./Base64.js";
const cryptoSubtle = window.crypto.subtle;

const IV_LEN_BYTES = 50;

//if extractable is true, the key material can be exported into the Javascript
//runtime environment via exportKey
export async function generateAESKey(extractable: boolean = false) {
  return await cryptoSubtle.generateKey(
    {
      name: "AES-GCM",
      length: 256
    },
    extractable,
    ["encrypt", "decrypt"]
  );
}

export async function exportKeyAsBase64(key: CryptoKey) {
  return arrayBufferToBase64(await cryptoSubtle.exportKey('raw', key));
}

export async function importKey(base64String: string) {
  let buffer = base64ToArrayBuffer(base64String);
  return await cryptoSubtle.importKey(
    "raw", 
    buffer, 
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

function concatIvAndCipherText(iv: ArrayBuffer, cipherText: ArrayBuffer) {
  //concatenate initialization vector (iv) with ciphertext
  let output = new Uint8Array(iv.byteLength + cipherText.byteLength);

  output.set(new Uint8Array(iv), 0);
  output.set(new Uint8Array(cipherText), iv.byteLength);

  return arrayBufferToBase64(output.buffer);
}

function separateIvAndCipherText(stringBase64: string, ivLength: number) {
  let buffer = base64ToArrayBuffer(stringBase64);
  let iv = buffer.slice(0, ivLength);
  let cipherText = buffer.slice(ivLength);
  return {iv: iv, ciphertext: cipherText};
}

export async function wrapKey(keyToExport: CryptoKey, keyToEncrypt: CryptoKey) {
  let iv = window.crypto.getRandomValues(new Uint8Array(IV_LEN_BYTES));
  
  let exportedKey = await cryptoSubtle.wrapKey(
    "raw",
    keyToExport,
    keyToEncrypt,
    {
      name: "AES-GCM",
      iv: iv
    }
  );

  return concatIvAndCipherText(iv, exportedKey);
}


export async function upwrapKey(exportedBase64: string, keyToDecrypt: CryptoKey) {
  let {iv, ciphertext} = separateIvAndCipherText(exportedBase64, IV_LEN_BYTES);

  let key = await cryptoSubtle.unwrapKey(
    "raw",
    ciphertext,
    keyToDecrypt,
    //the type of key keyToDecrypt is
    {
      name: "AES-GCM",
      iv: iv
    },
    //the type of key the unwrapped key from exportedBase64 is
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );

  return key;
}

export async function encrypt(data: string, key: CryptoKey) {
  let buffer = new Uint8Array(IV_LEN_BYTES);
  let iv = window.crypto.getRandomValues(buffer);

  let ciphertext = await cryptoSubtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    new TextEncoder().encode(data)
  );

  console.log("Iv", iv);
  console.log("CipherText", new Uint8Array(ciphertext));

  //concatenate initialization vector (iv) with ciphertext
  let output = new Uint8Array(iv.buffer.byteLength + ciphertext.byteLength);

  output.set(iv, 0);
  output.set(new Uint8Array(ciphertext), iv.byteLength);

  let base64Output = arrayBufferToBase64(output.buffer);

  return base64Output;
}

export async function decrypt(encBase64Data: string, key: CryptoKey) {
  let encData = base64ToArrayBuffer(encBase64Data);

  let iv = encData.slice(0, IV_LEN_BYTES);
  let ciphertext = encData.slice(IV_LEN_BYTES);

  console.log("CipherText", new Uint8Array(ciphertext));

  console.log("Iv", new Uint8Array(iv));


  let decrypted = await cryptoSubtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}