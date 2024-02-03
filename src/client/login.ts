import { createKeyPair, exportPublicKey, sign } from "./encryption/ECDSA.js";
import * as storage from './StorageHandler.js';

const accountForm = document.getElementById('create-account-form') as HTMLFormElement;
const loginForm = document.getElementById('login-form') as HTMLFormElement;


accountForm.onsubmit = async (e) => {
  e.preventDefault(); //dont allow post request to go through

  //@ts-ignore
  let username: string = accountForm.elements["username"].value;

  console.log(username);

  let keyPair = await createKeyPair();
  let signature = await sign("", keyPair.privateKey);
  let exportedPubKey = await exportPublicKey(keyPair.publicKey);

  storage.addKey("auth_key_pair", keyPair);

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

  console.log(await response.json());
}

loginForm.onsubmit = async (e) => {
  e.preventDefault(); //dont allow post request to go through

  let keyPair = await storage.getKey("auth_key_pair") as CryptoKeyPair;
  console.log(keyPair)
  if(!keyPair) {
    return;
  }

  //@ts-ignore
  let username: string = loginForm.elements["username"].value;

  console.log(username);

  let signature = await sign("", keyPair.privateKey);

  console.log("signature = ", signature);


  let response = await fetch(
    "/api/login", 
    {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        signature_base64: signature
      })
    }
  );

  console.log(await response.json());
}
