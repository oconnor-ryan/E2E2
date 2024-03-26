import { arrayBufferToBase64, base64ToArrayBuffer } from "../util/Base64.js";
import { CryptoKeyWrapper } from "./CryptoKeyWrapper.js";

const cryptoSubtle = window.crypto.subtle;

export class ECDSAPublicKey extends CryptoKeyWrapper {

  constructor(key: CryptoKey) {
    super(key);
  }

  isValidKey(key: CryptoKey): boolean {
    //@ts-ignore
    return key.type === "public" && key.algorithm.name === "ECDSA" && key.algorithm.namedCurve && key.algorithm.namedCurve === "P-521";
  }

  async exportKey(type?: "base64") : Promise<string>
  async exportKey(type: "arraybuffer") : Promise<ArrayBuffer>
  async exportKey(type: "base64" | "arraybuffer" = "base64") : Promise<string | ArrayBuffer> {
    let exportedKey = await crypto.subtle.exportKey(
      'spki', 
      this.key
    );
    return type === "base64" ? arrayBufferToBase64(exportedKey) : exportedKey;
  }

  async verify(signature: string | ArrayBuffer, data: string | ArrayBuffer) {
    let bufferSig = signature instanceof ArrayBuffer ? signature : base64ToArrayBuffer(signature);
    let bufferData = data instanceof ArrayBuffer ? data : (new TextEncoder().encode(data)).buffer;
    let verified = await window.crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: {name: 'SHA-512'}
      },
      this.getCryptoKey(),
      bufferSig,
      bufferData
    );
    return verified;
  }

  static async importKey(data: ArrayBuffer | string) {
    let buffer = data instanceof ArrayBuffer ? data : base64ToArrayBuffer(data);
    let key = await cryptoSubtle.importKey(
      "spki",
      buffer,
      {
        name: "ECDSA",
        namedCurve: "P-521"
      },
      false,
      ["verify"]
    );

    return new ECDSAPublicKey(key);
  }

}

export class ECDSAPrivateKey extends CryptoKeyWrapper {

  constructor(key: CryptoKey) {
    super(key);
  }

  isValidKey(key: CryptoKey): boolean {
    //@ts-ignore
    return key.type === "private" && key.algorithm.name === "ECDSA" && key.algorithm.namedCurve && key.algorithm.namedCurve === "P-521";
  }

  async sign(message: string | ArrayBuffer, outputType: "arraybuffer") : Promise<ArrayBuffer>
  async sign(message: string | ArrayBuffer, outputType?: "base64" | "base64url") : Promise<string>
  async sign(message: string | ArrayBuffer, outputType: "arraybuffer" | "base64" | "base64url" = "base64") : Promise<string | ArrayBuffer> {
    let signature = await cryptoSubtle.sign(
      {
        name: 'ECDSA',
        hash: {name: 'SHA-512'}
      },
      this.getCryptoKey(),
      message instanceof ArrayBuffer ? message : new TextEncoder().encode(message)
    );
    if(outputType === "arraybuffer") {
      return signature;
    }
    return arrayBufferToBase64(signature, outputType === "base64url");
  }
}

export async function createECDSAKeyPair() {
  let keyPair = await cryptoSubtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-521"
    },
    false, //note that public key can be exported even if extractable is false, but private key is not
    ['sign', 'verify']
  );

  return {
    publicKey: new ECDSAPublicKey(keyPair.publicKey),
    privateKey: new ECDSAPrivateKey(keyPair.privateKey)
  };
}
