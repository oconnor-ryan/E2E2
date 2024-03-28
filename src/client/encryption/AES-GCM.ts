import { arrayBufferToBase64, base64ToArrayBuffer } from "../util/Base64.js";
import { CryptoKeyWrapper } from "./CryptoKeyWrapper.js";

//note that AesGcmKey class cannot be stored in IndexedDB, while CryptoKey can, 
//since IndexedDB only stores JSON and primitive values,
//so we need the constructor to be public to get these keys from IndexedDB
export class AesGcmKey extends CryptoKeyWrapper {
  private static readonly IV_LEN_BYTES = 50;
  public static readonly GEN_PARAMS = {
    name: "AES-GCM",
    length: 256
  }

  constructor(key: CryptoKey) {
    super(key);
  }

  static async generateKey(extractable: boolean = false) : Promise<AesGcmKey> {
    let key = await window.crypto.subtle.generateKey(
      AesGcmKey.GEN_PARAMS,
      extractable,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
    );

    return new AesGcmKey(key);
  }

  static async importKey(keyMaterial: ArrayBuffer | string, extractable: boolean = false) {
    let key = await window.crypto.subtle.importKey(
      "raw", 
      keyMaterial instanceof ArrayBuffer ? keyMaterial : base64ToArrayBuffer(keyMaterial), 
      AesGcmKey.GEN_PARAMS,
      extractable,
      ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
    );

    return new AesGcmKey(key);
  }

  isValidKey(key: CryptoKey): boolean {
    //@ts-ignore
    return key.algorithm.name === 'AES-GCM' && key.algorithm.length && key.algorithm.length === 256;
  }

  isExtractable() {
    return this.key.extractable;
  }

  getCryptoKey() : Readonly<CryptoKey> {
    return this.key;
  }

  /**
   * 
   * @param data 
   * @param key 
   * @param outputType 
   * 
   * Note that this uses Typescript function overloading
   * for type checking
  */
  async encrypt(data: string | ArrayBuffer) : Promise<string>;
  async encrypt(data: string | ArrayBuffer, outputType: "arraybuffer") : Promise<ArrayBuffer>;
  async encrypt(data: string | ArrayBuffer, outputType: "base64") : Promise<string>;
  async encrypt(data: string | ArrayBuffer, outputType?: "arraybuffer" | "base64") : Promise<ArrayBuffer | string>{
    if(!outputType) {
      outputType = "base64";
    }

    let buffer = new Uint8Array(AesGcmKey.IV_LEN_BYTES);
    let iv = window.crypto.getRandomValues(buffer);

    let ciphertext = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      this.key,
      data instanceof ArrayBuffer ? data : new TextEncoder().encode(data)
    );


    let output = this.concatIvAndCipherText(iv, ciphertext);

    if(outputType === "arraybuffer") {
      return output;
    }

    return arrayBufferToBase64(output);

  }

  async decrypt(data: ArrayBuffer | string, outputType: "arraybuffer") : Promise<ArrayBuffer>
  async decrypt(data: ArrayBuffer | string, outputType?: "string") : Promise<string>
  async decrypt(data: ArrayBuffer | string, outputType: "arraybuffer" | "string" = "string") : Promise<string | ArrayBuffer> {
    let encData: ArrayBuffer;
    if(data instanceof ArrayBuffer) {
      encData = data;
    } else {
      encData = base64ToArrayBuffer(data);
    }
  
    let {iv, ciphertext} = this.separateIvAndCipherText(encData, AesGcmKey.IV_LEN_BYTES);
  
    let decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      this.key,
      ciphertext
    );

  
    return outputType === 'arraybuffer' ? decrypted : new TextDecoder().decode(decrypted);
  }

  async wrapKeyAesGcmKey(keyToExport: AesGcmKey) {
    let iv = window.crypto.getRandomValues(new Uint8Array(AesGcmKey.IV_LEN_BYTES));
    
    if(!keyToExport.isExtractable()) {
      throw new Error("Cannot wrap a key who is not extractable!");
    }

    let exportedKey = await window.crypto.subtle.wrapKey(
      "raw",
      keyToExport.key,
      this.key,
      {
        name: "AES-GCM",
        iv: iv
      }
    );
  
    return this.concatIvAndCipherText(iv, exportedKey);
  }

  async upwrapKeyAesGcmKey(encKeyMaterial: string | ArrayBuffer) {
    if(typeof encKeyMaterial === 'string') {
      encKeyMaterial = base64ToArrayBuffer(encKeyMaterial);
    }

    let {iv, ciphertext} = this.separateIvAndCipherText(encKeyMaterial, AesGcmKey.IV_LEN_BYTES);
  
    let key = await window.crypto.subtle.unwrapKey(
      "raw",
      ciphertext,
      this.key,
      //the type of CryptoKey this object's key is
      {
        name: "AES-GCM",
        iv: iv
      },
      //the type of the key being unwrapped
      {
        name: "AES-GCM",
        length: 256
      },
      false,
      ["encrypt", "decrypt"]
    );
  
    return new AesGcmKey(key);
  }

  private concatIvAndCipherText(iv: ArrayBuffer, cipherText: ArrayBuffer) {
    //concatenate initialization vector (iv) with ciphertext
    let output = new Uint8Array(iv.byteLength + cipherText.byteLength);
  
    output.set(new Uint8Array(iv), 0);
    output.set(new Uint8Array(cipherText), iv.byteLength);
  
    return output.buffer;
  }
  
  private separateIvAndCipherText(encryptedBytes: ArrayBuffer, ivLength: number) {
    let iv = encryptedBytes.slice(0, ivLength);
    let cipherText = encryptedBytes.slice(ivLength);
    return {iv: iv, ciphertext: cipherText};
  }

  
}