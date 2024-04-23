import { arrayBufferToBase64, base64ToArrayBuffer } from "../util/Base64.js";
import { CryptoKeyPairWrapper, CryptoKeyPairWrapperBuilder, CryptoKeyWrapper } from "./CryptoKeyWrapper.js";

const cryptoSubtle = window.crypto.subtle;

export class ECDHPublicKey extends CryptoKeyWrapper {
  constructor(key: CryptoKey) {
    super(key);
  }

  isValidKey(key: CryptoKey): boolean {
    //@ts-ignore
    return key.type === 'public' && key.algorithm.name === "ECDH" && key.algorithm.namedCurve && key.algorithm.namedCurve === 'P-521';
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

  static async importKey(data: ArrayBuffer | string) {
    let buffer = data instanceof ArrayBuffer ? data : base64ToArrayBuffer(data);
    let key =  await cryptoSubtle.importKey(
      "spki",
      buffer,
      {
        name: "ECDH",
        namedCurve: "P-521"
      },
      false,
      //no key usages because deriveBits and deriveKey
      //are only applied to the private key of a ECDH pair
      []
    );

    return new ECDHPublicKey(key);
  }
}

export class ECDHPrivateKey extends CryptoKeyWrapper {
  constructor(key: CryptoKey) {
    super(key);
  }

  isValidKey(key: CryptoKey): boolean {
    //@ts-ignore
    return key.type === 'private' && key.algorithm.name === "ECDH" && key.algorithm.namedCurve && key.algorithm.namedCurve === 'P-521';
  }

  async deriveBits(theirPublicKey: ECDHPublicKey) {
    return await cryptoSubtle.deriveBits(
      {
        name: "ECDH",
        public: theirPublicKey.getCryptoKey()
      },
      this.getCryptoKey(),
      256
    );
  }
}



export class ECDHKeyPair extends CryptoKeyPairWrapper<ECDHPrivateKey, ECDHPublicKey>{};
export class ECDHKeyPairBuilder extends CryptoKeyPairWrapperBuilder<ECDHKeyPair> {
  async generateKeyPairWrapper(): Promise<ECDHKeyPair> {
    let keyPair = await cryptoSubtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-521"
      },
      false,
      ['deriveKey', 'deriveBits']
    );

    return this.getKeyPairWrapperFromCryptoKeyPair(keyPair);
  }

  async generateMultipleKeyPairs(count: number = 1): Promise<ECDHKeyPair[]> {
    let keys: Promise<ECDHKeyPair>[] = [];
    for(let i = 0; i < count; i++) {
      keys.push(this.generateKeyPairWrapper());
    }

    return await Promise.all(keys);


  }
  
  getKeyPairWrapperFromCryptoKeyPair(pair: CryptoKeyPair): ECDHKeyPair {
    return new ECDHKeyPair(new ECDHPrivateKey(pair.privateKey), new ECDHPublicKey(pair.publicKey));
  }
}



