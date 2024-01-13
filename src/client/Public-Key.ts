(() => {
  const cryptoSubtle = window.crypto.subtle;


  async function getKeyPair() {
    let pair = await cryptoSubtle.generateKey(
      {
        name: "RSA-OAEP",
        // Consider using a 4096-bit key for systems that require long-term security
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-512",
      },
      false,
      ["encrypt", "decrypt"]
    );

    return pair;
  }

  async function encrypt(message: string, publicKey: CryptoKey) {
    let encMessage = new TextEncoder().encode(message);

    return await cryptoSubtle.encrypt(
      {
        name: "RSA-OAEP",
      },
      publicKey,
      encMessage
    );
  }

  async function decrypt(cyphertext: ArrayBuffer, privateKey: CryptoKey) {
    let decrypted = await cryptoSubtle.decrypt(
      {
        name: "RSA-OAEP",
      },
      privateKey,
      cyphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  function arrayBufferToBase64(buffer: ArrayBuffer) : string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
  }

  function base64ToArrayBuffer(base64: string) : ArrayBuffer {
    let binaryString = atob(base64);
    let rtn = new Uint8Array(binaryString.length);

    for(let i = 0; i < binaryString.length; i++) {
      rtn[i] = binaryString.charCodeAt(i);
    }

    return rtn.buffer;
  }

  async function test() {
    let plaintextElement = document.getElementById("plaintext") as HTMLInputElement;
    let cyphertextElement = document.getElementById("cyphertext")!;
    let encryptButton = document.getElementById("encrypt-button")!;
    let decryptButton = document.getElementById("decrypt-button")!;
    let errorElement = document.getElementById("error-message")!;




    let keyPair = await getKeyPair();

    let encryptListener = async () => {
      let message = plaintextElement.value


      let cyphertext = await encrypt(message, keyPair.publicKey);
      console.log("Encrypt Cypher: " + new Uint8Array(cyphertext));


      const base64String = arrayBufferToBase64(cyphertext);
      cyphertextElement.innerHTML = base64String;

    };

    encryptButton.addEventListener("click", encryptListener, false);

    let decryptListener = async () => {

      let encrypted = base64ToArrayBuffer(cyphertextElement.innerHTML);

      console.log("Decrypt Cypher: " + new Uint8Array(encrypted));


      try {
        let decrypted = await decrypt(encrypted, keyPair.privateKey);

        cyphertextElement.innerHTML = decrypted;
        errorElement.innerHTML = ""

      } catch(e: any) {
        e = e as Error;
        console.error(e);
        errorElement.innerHTML = "Decryption Failed with error message " + e.message;
      }

    }

    decryptButton.addEventListener("click", decryptListener, false);

  }

  test();
})();
