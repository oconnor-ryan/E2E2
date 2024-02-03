import { createKeyPair, exportPublicKey, sign } from "./encryption/ECDSA.js";

const accountForm = document.getElementById('create-account-form') as HTMLFormElement;
const loginForm = document.getElementById('login-form') as HTMLFormElement;

let keyPair: CryptoKeyPair | undefined;
let signature: string | undefined;
let exportedPubKey: string | undefined;

accountForm.onsubmit = async (e) => {
  e.preventDefault(); //dont allow post request to go through

  //@ts-ignore
  let username: string = accountForm.elements["username"].value;

  console.log(username);

  keyPair = await createKeyPair();
  signature = await sign("", keyPair.privateKey);
  exportedPubKey = await exportPublicKey(keyPair.publicKey);

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
  if(!keyPair) {
    console.error("You forgot to create account!");
    return;
  }

  //@ts-ignore
  let username: string = loginForm.elements["username"].value;

  console.log(username);

  signature = await sign("", keyPair.privateKey);

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
