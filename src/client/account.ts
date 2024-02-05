import { createKeyPair, exportPublicKey, sign } from "./encryption/ECDSA.js";
import * as storage from './util/StorageHandler.js';
import { login } from "./util/EasyFetch.js";

const accountForm = document.getElementById('create-account-form') as HTMLFormElement;
const loginStatusButton = document.getElementById('login-button') as HTMLButtonElement;
const messageElement = document.getElementById('result-message') as HTMLParagraphElement;

async function main() {
  await storage.waitToOpenIndexedDB();

  accountForm.onsubmit = async (e) => {
    e.preventDefault(); //dont allow post request to go through
  
    //@ts-ignore
    let username: string = accountForm.elements["username"].value;
  
    console.log(username);
  
    let keyPair = await createKeyPair();
    let signature = await sign("", keyPair.privateKey);
    let exportedPubKey = await exportPublicKey(keyPair.publicKey);
  
    
  
    console.log("exported key = ", exportedPubKey);
    console.log("signature = ", signature);
  
  
    let response = await fetch(
      "/api/create-account", 
      {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          auth_pub_key_base64: exportedPubKey,
          signature_base64: signature
        })
      }
    );
  
    let jsonRes = await response.json();
  
    if(!jsonRes.error) {
      storage.addKey("auth_key_pair", keyPair);
      storage.updateUsername(username);
  
    }
  
    messageElement.innerHTML = `Create Account Result: ${JSON.stringify(jsonRes)}`;
  }
  
  loginStatusButton.onclick = async (e) => {
    try {
      let jsonRes = await login();
      messageElement.innerHTML = `Login Result: true`;
  
    } catch(e: any) {
      console.error(e);
      messageElement.innerHTML = e.message
    }
  }  
}

main();