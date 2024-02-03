import * as storage from '../StorageHandler.js'
import { sign } from '../encryption/ECDSA.js';


export async function login() {
  let keyPair = await storage.getKey('auth_key_pair') as CryptoKeyPair | undefined;
  if(!keyPair) {
    throw new Error("No auth key found!");
  }

  let signature = await sign("", keyPair.privateKey);

  let res = await (await fetch(
    '/api/login',
    {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({username: storage.getUsername() ?? "", signature_base64: signature})
    }
  )).json();

  if(res.error) {
    throw new Error(res.error);
  }
}

export async function ezFetch(url: string, json: any, method: string = "POST") {
  let mainFetch = async () => {
    return await (await fetch(
      url,
      {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(json)
      }
    )).json();
  };


  try {
    return await mainFetch();
  } catch(e) {

    //login has expired, so get new JWT by logging in
    try {await login();} 
    
    //login failed, throw error from login attempt
    catch(e) {throw e;}
  }

  //try main fetch request again once logged in
  return await mainFetch();
}