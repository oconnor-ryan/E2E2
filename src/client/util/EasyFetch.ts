import * as storage from './StorageHandler.js'
import { sign } from '../encryption/ECDSA.js';
import { NOT_LOGGED_IN_ERROR } from '../shared/Constants.js';


export async function login() {
  await storage.waitToOpenIndexedDB();

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

/**
 * A helper function that sends JSONs to endpoints and parses responses to JSON.
 * 
 * If the user's original URL responds with an 'error' property , another request is 
 * sent to the server to automatically refresh the user's session cookie. 
 * If the JWT is refreshed, the original request is sent again.
 * 
 * @param url - the URL we want to query
 * @param json - the JSON data we will pass in
 * @param method - 
 * @returns 
 * @throws Error - Error can be caused from bad network, being unable to log in, 
 * or being unable to parse the response to a JSON.
 */
export async function ezFetch(url: string, json?: any, method: string = "POST") {
  
  let mainFetch = async () => {
    let res = await (await fetch(
      url,
      {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(json)
      }
    )).json();

    //only throw error if error matches the error name for the server
    if(res.error && res.error === NOT_LOGGED_IN_ERROR) {
      throw new Error(res.error);
    }

    return res;
  };


  try {
    return await mainFetch();
  } catch(e) {

    //login has expired, so get new JWT by logging in
    await login();
    
  }

  //try main fetch request again once logged in
  return await mainFetch();
}

//you can put typed functions that use ezFetch so that you know exactly what
//responses you receive

export async function searchUsers(data: {search: string}) : Promise<string[]> {
  let res = await ezFetch("/api/searchusers", data);
  if(res.error) {
    throw new Error(res.error);
  }

  //you can also check to see if the json is properly formatted here using JSONValidator
  return res.users;
}