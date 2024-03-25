import { base64ToArrayBuffer, arrayBufferToBase64 } from "./util/Base64.js";
import { encrypt, decrypt } from "./encryption-old/KeyDerivation.js";

function test() {
  let plaintextElement = document.getElementById("plaintext") as HTMLInputElement;
  let cyphertextElement = document.getElementById("cyphertext")!;
  let encryptButton = document.getElementById("encrypt-button")!;
  let decryptButton = document.getElementById("decrypt-button")!;
  let errorElement = document.getElementById("error-message")!;




  let salt = window.crypto.getRandomValues(new Uint8Array(16));
  let iv = window.crypto.getRandomValues(new Uint8Array(12));

  let encryptListener = async () => {
    let password = window.prompt("Enter your Password:") ?? "";
    let message = plaintextElement.value


    let cyphertext = await encrypt(message, password, salt, iv);
    console.log("Encrypt Cypher: " + new Uint8Array(cyphertext));


    const base64String = arrayBufferToBase64(cyphertext);
    cyphertextElement.innerHTML = base64String;

    //Never use TextEncoder/TextDecoder for ArrayBuffers from encryption because most
    //characters outputted from TextEncoder are �, meaning that the binary character code
    //is not in UTF-8. When TextEncoder outputs �, it replaces these bytes with the
    //bytes that represent �.
    //
    //As a result, if you encode the message again with TextEncoder, it will not match the
    //input ArrayBuffer from before.
    //
    //Example: 
    // Input ArrayBuffer = Encrypt Cypher: [163,171,14,216,230,140,141,151,192,255,222,184,121,131,242,6,235,192,46,119]
    // String from TextDecoder on input above = ����挍���޸y�����.w
    // Output ArrayBuffer from TextEncoder on String above = [239,191,189,239,191,189,14,239,191,189,230,140,141,239,191,189,239,191,189,239,191,189,222,184,121,239,191,189,239,191,189,6,239,191,189,239,191,189,46,119]
    //
    //Instead, encode ArrayBuffers to Base64 so that it can be transmitted via text.

    //cyphertextElement.innerHTML = new TextDecoder().decode(cyphertext);

  };

  encryptButton.addEventListener("click", encryptListener, false);

  let decryptListener = async () => {
    let password = window.prompt("Enter your Password:") ?? "";

    // let encrypted = new TextEncoder().encode(cyphertextElement.innerHTML);

    let encrypted = base64ToArrayBuffer(cyphertextElement.innerHTML);

    console.log("Decrypt Cypher: " + new Uint8Array(encrypted));


    try {
      let decrypted = await decrypt(encrypted, password, salt, iv);

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

