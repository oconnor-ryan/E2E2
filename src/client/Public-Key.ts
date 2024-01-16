import { arrayBufferToBase64, base64ToArrayBuffer } from "./encryption/Base64.js";
import { encrypt, decrypt, getKeyPair } from "./encryption/PublicKey.js";

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
