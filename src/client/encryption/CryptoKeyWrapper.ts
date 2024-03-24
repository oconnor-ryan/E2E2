

export abstract class CryptoKeyWrapper {
  protected key: CryptoKey;

  constructor(key: CryptoKey) {
    if(!this.isValidKey(key)) {
      throw new Error("Invalid Key being used in this constructor: Algorithm: " + JSON.stringify(key.algorithm) + ", Type: " + key.type);
    }

    this.key = key;
  }

  abstract isValidKey(key: CryptoKey) : boolean;

  getCryptoKey() : Readonly<CryptoKey> {
    return this.key;
  }

  isExtractable() : boolean {
    return this.key.extractable;
  }

}

export class CryptoKeyPairWrapper {
  protected keyPair: CryptoKeyPair;

  constructor(keyPair: CryptoKeyPair) {
    this.keyPair = keyPair;
  }

  getCryptoKeyPair() : Readonly<CryptoKeyPair> {
    return this.keyPair;
  }
}