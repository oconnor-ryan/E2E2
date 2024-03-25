import { AesGcmKey } from "./AES-GCM.js";
import { CryptoKeyWrapper } from "./CryptoKeyWrapper.js";

const cryptoSubtle = window.crypto.subtle;


export class HKDFKey extends CryptoKeyWrapper {
  constructor(key: CryptoKey) {
    super(key);
  }

  isValidKey(key: CryptoKey): boolean {
    return key.algorithm.name === "HKDF";
  }


  async deriveAesGcmKey(salt?: ArrayBuffer, extractable: boolean = false) {
    let alreadyHasSalt = salt !== undefined;

    if(!alreadyHasSalt) {
      salt = window.crypto.getRandomValues(new Uint8Array(20));
    }
    let key = await cryptoSubtle.deriveKey(
      {
        name: "HKDF",
        salt: salt,
        info: new Uint8Array([]),
        hash: "SHA-512",
      },
      this.getCryptoKey(),
      AesGcmKey.GEN_PARAMS,
      extractable,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
    );

    return {key: new AesGcmKey(key), salt: salt as ArrayBuffer};
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
