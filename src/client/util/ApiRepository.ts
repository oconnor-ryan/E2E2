import * as encrypt from '../encryption/encryption.js';

import { getDatabase, LOCAL_STORAGE_HANDLER } from '../storage/StorageHandler.js';

import { ErrorCode } from '../shared/Constants.js';
import { arrayBufferToBase64 } from './Base64.js';
import { downloadFile } from './FileUpload.js';
import { formatError } from './ClientError.js';



export async function createAccount(username: string) : Promise<boolean> {
  const db = await getDatabase();
  const ecdhKeyBuilder = new encrypt.ECDHKeyPairBuilder();
  
  //using Promise.all so that all three keys are generated concurrently
  const [idKeyPair, exchangeKeyPair, preKey] = await Promise.all([
    new encrypt.ECDSAKeyPairBuilder().generateKeyPairWrapper(), 
    ecdhKeyBuilder.generateKeyPairWrapper(), 
    ecdhKeyBuilder.generateKeyPairWrapper()
  ])

  const [exportedIdPubKey, exportedExchangePubKey, exportedPrePubKey] = await Promise.all([
    idKeyPair.publicKey.exportKey(),
    exchangeKeyPair.publicKey.exportKey(),
    preKey.publicKey.exportKey()
  ]);

  const [exchangeKeySignature, preKeySignature] = await Promise.all([
    idKeyPair.privateKey.sign(exportedExchangePubKey),
    idKeyPair.privateKey.sign(exportedPrePubKey),
  ]);

  const oneTimePrekeys = await ecdhKeyBuilder.generateMultipleKeyPairs(100);

  const exportedOneTimePrekeysPublic = await Promise.all(oneTimePrekeys.map(val => val.publicKey.exportKey()))

  let password = arrayBufferToBase64(window.crypto.getRandomValues(new Uint8Array(32)).buffer);
  let mailboxId = arrayBufferToBase64(window.crypto.getRandomValues(new Uint8Array(32)).buffer);


  let response = await fetch(
    "/api/create-account", 
    {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        password: password,
        mailboxId: mailboxId,
        identityKeyPublic: exportedIdPubKey,
        exchangeIdKeyPublic: exportedExchangePubKey,
        exchangeIdKeySignature: exchangeKeySignature,
        exchangePrekeyPublic: exportedPrePubKey,
        exchangePrekeySignature: preKeySignature,
        exchangeOneTimePrekeysPublic: exportedOneTimePrekeysPublic
      })
    }
  );

  try {
    let jsonRes = await response.json();

    if(jsonRes.error) {
      throw formatError(jsonRes.error, "Failed to make account!");
    }
    await db.accountStore.add({
      username: username,
      password: password,
      mailboxId: mailboxId,
      identityKeyPair: idKeyPair,
      exchangeIdKeyPair: exchangeKeyPair,
      exchangeIdPreKeyPair: preKey,
      exchangeIdPreKeyBundlePair: oneTimePrekeys,
      lastReadMessageInviteUUID: undefined,
      lastReadMessageUUID: undefined
    });

    LOCAL_STORAGE_HANDLER.updateUsernameAndPassword(username, password);
    return true;
  } catch(e) {
    let err = e as Error;
    throw formatError(err.name, err.message);
  }

}

async function ezFetchJSON(url: string, method: string = "GET", queryParams?: Record<string, any>, jsonBody?: any, headers?: HeadersInit) {
  let urlObj = new URL(url);
  if(queryParams) {
    urlObj.search = new URLSearchParams(queryParams).toString();
  }

  let myHeaders: Headers = new Headers(headers)
  myHeaders.append('Content-Type', 'application/json');

  let res = await (await fetch(url, {
    method: method,
    headers: myHeaders,
    body: JSON.stringify(jsonBody)
  })).json();

  return res;
}

/**
 * A easier way to fetch JSON data from a URL, using a JSON payload as the request body.
 * This function also automatically signs the HTTP Request body using a logged in user's signature.
 * @param url - 
 * @param jsonData 
 * @param method 
 * @returns 
 */
export async function authFetch(url: string, method: string = "GET", queryParams?: Record<string, any>, jsonData?: any) {
  const authHeader = LOCAL_STORAGE_HANDLER.getAuthHeader();
  const res = await ezFetchJSON(url, method, queryParams, jsonData, {'Authorization': authHeader});

  const jsonRes = await res.json();
  if(jsonRes.error 
    && (jsonRes.error === ErrorCode.NO_AUTH_HEADER 
       || jsonRes.error === ErrorCode.INVALID_AUTH_SCHEME
       || jsonRes.error === ErrorCode.NO_USER_EXISTS 
       || jsonRes.error === ErrorCode.WRONG_PASSWORD 
       )
  ) {
    throw new Error(jsonRes.error);
  }

  return jsonRes;
}



//you can put typed functions that use ezFetch so that you know exactly what
//responses you receive

export async function searchUsers(searchString: string) : Promise<string[]> {
  let res = await ezFetchJSON('/api/searchusers', 'GET', {search: searchString});
  if(res.error) {
    throw new Error(res.error);
  }

  return res.users;
}

export async function getInvites() : Promise<{sender: string, chat_id: number}[]> {
  let res = await authFetch('/api/chat/getinvites');
  if(res.error) {
    throw new Error(res.error);
  }
  return res.invites;
}






export async function getUserKeysForExchange(user: string) : Promise<any | null> {

  let res = await ezFetchJSON("/api/getuserkeysforexchange", 'GET', {username: user});
  if(res.error) {
    throw new Error(res.error);
  }

  return res.keys;
}



export async function uploadFile(file: File) {
  let formData = new FormData();
  formData.append("uploadedFile", file);

  let authHeader = LOCAL_STORAGE_HANDLER.getAuthHeader();

  let response = await fetch(`/api/uploadfile`, {
    method: 'POST',
    headers: {
      //do not explicity set multipart/form-data header
      //since Fetch API needs to add the boundary property to that header
      //'Content-Type': 'multipart/form-data',
      'Authorization': authHeader
    },
    body: formData
  });

  let json = await response.json();

  if(json.error) {
    throw new Error(json.error);
  }

  return {fileUUID: json.fileUUID as string, accessToken: json.accessToken as string};
}

export async function getFile(fileUUID: string, filename: string, accessToken: string, encKey: encrypt.AesGcmKey) {
  const url = new URL('/api/getfile');
  url.search = new URLSearchParams({fileuuid: fileUUID, accesstoken: accessToken}).toString();

  let res = await fetch(url);

  if(res.headers.get('Content-Type') === "application/json") {
    throw new Error((await res.json()).error);
  }

  //this is a octet-stream
  let encFile = await res.blob();


  let decryptBuffer = await encKey.decrypt(await encFile.arrayBuffer(), "arraybuffer");

  let decryptFile = new File([decryptBuffer], filename);
  //download file (this is a hacky solution)

  downloadFile(decryptFile);

  /*
  let db = await storage.getDatabase();

  //save to client database
  await db.fileStore.update({
    fileUUID: fileUUID,
    file: decryptFile,
    accessToken: accessToken
  });
  */

}