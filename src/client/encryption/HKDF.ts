import { AesGcm } from "./AES-GCM.js";
import { CryptoKeyWrapper } from "./CryptoKeyWrapper.js";

const cryptoSubtle = window.crypto.subtle;


export class HKDFKey extends CryptoKeyWrapper {
  constructor(key: CryptoKey) {
    super(key);
  }

  isValidKey(key: CryptoKey): boolean {
    return key.algorithm.name === "HKDF";
  }

  async deriveAesGcmKey(extractable: boolean = false) {
    let salt = window.crypto.getRandomValues(new Uint8Array(20));
    let key = await cryptoSubtle.deriveKey(
      {
        name: "HKDF",
        salt: salt,
        info: new Uint8Array([]),
        hash: "SHA-512",
      },
      this.getCryptoKey(),
      AesGcm.GEN_PARAMS,
      extractable,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
    );

    return {key: new AesGcm(key), salt: salt};
  }

  static async importKey(buffer: ArrayBuffer) {
    let key = await cryptoSubtle.importKey(
      "raw", 
      buffer,
      "HKDF",
      false,
      ["deriveKey"]
    );

    return new HKDFKey(key);
  }
}

export async function importKey(buffer: ArrayBuffer) {
  //extractable is always false for HKDF because
  //exportKey is not supported for HKDF
  return await cryptoSubtle.importKey(
    "raw", 
    buffer,
    "HKDF",
    false,
    ["deriveKey"]
  );
}

export async function deriveKey(keyMaterial: CryptoKey, salt: ArrayBuffer) {
  return await cryptoSubtle.deriveKey(
    {
      name: "HKDF",
      salt: salt,
      info: new Uint8Array([]),
      hash: "SHA-512",
    },
    keyMaterial,
    {
      name: "AES-GCM", 
      length: 256
    },
    true,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
}