

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

export abstract class CryptoKeyPairWrapper<Private extends CryptoKeyWrapper, Public extends CryptoKeyWrapper> {
  public readonly privateKey: Private;
  public readonly publicKey: Public;


  constructor(privateKey: Private, publicKey: Public) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;


  }

  getCryptoKeyPair() : Readonly<CryptoKeyPair> {
    return {
      privateKey: this.privateKey.getCryptoKey(),
      publicKey: this.publicKey.getCryptoKey()
    };
  }
}

export abstract class CryptoKeyPairWrapperBuilder<Pair>{
  abstract getKeyPairWrapperFromCryptoKeyPair(pair: CryptoKeyPair): Pair;
  abstract generateKeyPairWrapper(): Promise<Pair>;
}