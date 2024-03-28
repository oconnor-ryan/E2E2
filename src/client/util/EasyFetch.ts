import * as storage from './StorageHandler.js'
import * as encrypt from '../encryption/encryption.js';

import { getDatabase } from './StorageHandler.js';

import { ErrorCode, KeyType, UserInfo } from '../shared/Constants.js';
import { initKeyExchange } from './KeyExchange.js';
import { arrayBufferToBase64 } from './Base64.js';
import { downloadFile } from './FileUpload.js';


function getAuthHeader(storageHandler: storage.StorageHandler) {
  let userId = storageHandler.getUsername();
  let password = storageHandler.getPassword();

  if(!userId || !password) {
    throw new Error("No user ID and/or password found!");
  }

  let authHeader = "Basic " + btoa(userId + ":" + password);
  return authHeader;
}

export async function createAccount(username: string) {
  let storageHandler = await getDatabase();
  //using Promise.all so that all three keys are generated concurrently
  let [idKeyPair, exchangeKeyPair, preKey] = await Promise.all([
    encrypt.createECDSAKeyPair(), 
    encrypt.createECDHKeyPair(), 
    encrypt.createECDHKeyPair()
  ])

  let [exportedIdPubKey, exportedExchangePubKey, exportedPrePubKey] = await Promise.all([
    idKeyPair.publicKey.exportKey(),
    exchangeKeyPair.publicKey.exportKey(),
    preKey.publicKey.exportKey()
  ]);

  let [exchangeKeySignature, preKeySignature] = await Promise.all([
    idKeyPair.privateKey.sign(exportedExchangePubKey),
    idKeyPair.privateKey.sign(exportedPrePubKey),
  ]);

  let password = arrayBufferToBase64(window.crypto.getRandomValues(new Uint8Array(32)).buffer);

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
        id_pubkey_base64: exportedIdPubKey,
        exchange_pubkey_base64: exportedExchangePubKey,
        exchange_pubkey_sig_base64: exchangeKeySignature,
        exchange_prekey_pubkey_base64: exportedPrePubKey,
        exchange_prekey_pubkey_sig_base64: preKeySignature
      })
    }
  );

  let jsonRes = await response.json();

  if(!jsonRes.error) {
    storageHandler.addKey({keyType: KeyType.IDENTITY_KEY_PAIR, privateKey: idKeyPair.privateKey, publicKey: idKeyPair.publicKey});
    storageHandler.addKey({keyType: KeyType.EXCHANGE_ID_PAIR, privateKey: exchangeKeyPair.privateKey, publicKey: exchangeKeyPair.publicKey});
    storageHandler.addKey({keyType: KeyType.EXCHANGE_PREKEY_PAIR, privateKey: preKey.privateKey, publicKey: preKey.publicKey});


    storageHandler.updateUsername(username);
    storageHandler.updatePassword(password);
  }
}

/**
 * A easier way to fetch JSON data from a URL, using a JSON payload as the request body.
 * This function also automatically signs the HTTP Request body using a logged in user's signature.
 * @param url - 
 * @param jsonData 
 * @param method 
 * @returns 
 */
export async function ezFetch(url: string, jsonData?: any, method: string = "POST") {

  let storageHandler = await storage.getDatabase();
  let keyPair = await storageHandler.getKey(KeyType.IDENTITY_KEY_PAIR);
  if(!keyPair) {
    throw new Error("No signing key found! Might want to restore to a backup account!");
  }
  
  let authHeader = getAuthHeader(storageHandler);

  let jsonStr = JSON.stringify(jsonData);
  let res = await fetch(
    url, 
    {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        //custom HTTP headers for storing the signature of the HTTP request body
        //and the user who claims to have sent the request
        'Authorization': authHeader
      },
      body: jsonStr
    }
    
  )

  let jsonRes = await res.json();
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
  let res = await ezFetch("/api/searchusers", {search: searchString});
  if(res.error) {
    throw new Error(res.error);
  }

  //you can also check to see if the json is properly formatted here using JSONValidator
  return res.users;
}

export async function getInvites() : Promise<{sender: string, chat_id: number}[]> {
  let res = await ezFetch('/api/chat/getinvites');
  if(res.error) {
    throw new Error(res.error);
  }
  return res.invites;
}

export async function invite(invitedUser: string, chatId: number) {
  let res = await ezFetch("/api/chat/invite", {user: invitedUser, chatId: chatId});

  if(res.error) {
    throw new Error(res.error);
  }
}

export async function acceptInvite(chatId: number) {
  let acceptedResult = await ezFetch("/api/chat/acceptinvite", {chatId: chatId});
  if(acceptedResult.error) {
    throw new Error(acceptedResult.error);
  }

  if(!acceptedResult.chat) {
    throw new Error("Unable to retrieve joined chat!");
  }


  await initKeyExchange(chatId);
}

export async function getChats() : Promise<{[chat_id: string] : string[]}>{
  let chatListResult = await ezFetch("/api/chat/getchats");
  if(chatListResult.error) {
    throw new Error(chatListResult.error);
  }

  return chatListResult.chats;
}

export async function createChat() : Promise<{id: number, invitedUsers: string[]}> {
  let storageHandler = await getDatabase();
  let username = storageHandler.getUsername();
  if(!username) {
    throw new Error("Missing username from localStorage! Create an account or recover from backup!");
  }

  let res = await ezFetch("/api/chat/createchat");
  if(res.error) {
    throw new Error(res.error);
  }

  //because no users have accepted invite yet, no keys are 
  //stored and any messages that the owner writes should be
  //stored in a queue on the client until a key exchange is performed
  await storageHandler.addChat({chatId: res.chat.id, secretKey: null, keyExchangeId: null, lastReadMessageUUID: null});


  return res.chat;
}

export async function getChatInfo(chatId: number) : Promise<{members: {id: string, canInvite: boolean, isAdmin: boolean}[]}> {
  let chatInfoResult = await ezFetch("/api/chat/getchatinfo", {chatId: chatId});
  if(chatInfoResult.error) {
    throw new Error(chatInfoResult.error);
  }

  return chatInfoResult.chatInfo;
}

export async function getUserKeys(user: string) : Promise<UserInfo | null> {

  let res = await ezFetch("/api/getuserkeys", {username: user});
  if(res.error) {
    throw new Error(res.error);
  }

  return res.keys;
}

export async function getUserKeysForChat(chatId: number) : Promise<UserInfo[] | null> {

  let res = await ezFetch("/api/chat/getuserkeysfromchat", {chatId: chatId});
  if(res.error) {
    throw new Error(res.error);
  }

  return res.keys;
}

export async function sendKeyExchange(chatId: number, memberKeyList: {id: string, senderKeyEncBase64: string, saltBase64: string, ephemeralKeyBase64: string}[]) {
  let keyExchangeData = {
    chatId: chatId,
    memberKeyList: memberKeyList
  };

  let res = await ezFetch("/api/chat/sendkeyexchangetochat", keyExchangeData, "POST");

  if(res.error) {
    throw new Error(res.error);
  }

  return res.keyExchangeId;
}

export async function getKeyExchanges(chatId: number, keyExchangeId?: number) : Promise<Array<{
    ephemeralKeyBase64: string,
    senderKeyEncBase64: string,
    saltBase64: string,
    exchangeId: number,
    exchangeKeyBase64: string,
    identityKeyBase64: string,
}>>{


  let res = await ezFetch(`/api/chat/getkeyexchangeforchat`, {chatId: chatId, currentKeyExchangeId: keyExchangeId});

  if(res.error) {
    throw new Error(res.error);
  }

  return res.result;
}

export async function getLatestMessages(chatId: number, lastestMessageUUID?: string, currentKeyExchangeId?: number, numMessages?: number) : Promise<{
  id: number,
  data_enc_base64: string,
  chat_id: number,
  key_exchange_id: number,
  message_uuid: string
}[]>{
  let res = await ezFetch("/api/chat/chatmessages", {chatId: chatId, numMessages: numMessages, currentKeyExchangeId: currentKeyExchangeId, lastReadMessageUUID: lastestMessageUUID});
  if(res.error) {
    throw new Error(res.error);
  }

  return res.messages;
}

export async function uploadFile(file: File, chatId: number) {
  let storageHandler = await getDatabase();

  let formData = new FormData();
  formData.append("uploadedFile", file);
  formData.append('chatId', String(chatId));

  let authHeader = getAuthHeader(storageHandler);

  
  let response = await fetch(`/api/chat/uploadfile?chatId=${chatId}`, {
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

  return json.fileuuid as string;
}

export async function getFile(fileUUID: string, chatId: number, filename: string) {
  const url = `/api/chat/getfile?chatId=${chatId}&fileuuid=${fileUUID}`;

  let storageHandler = await getDatabase();

  let authHeader = getAuthHeader(storageHandler);

  let res = await fetch(
    url, 
    {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
        //custom HTTP headers for storing the signature of the HTTP request body
        //and the user who claims to have sent the request
        'Authorization': authHeader
      },
    }
    
  )

  if(res.headers.get('Content-Type') === "application/json") {
    throw new Error((await res.json()).error);
  }

  let encFile = await res.blob();

  let encKey = (await storageHandler.getChat(chatId)).secretKey!;

  let decryptBuffer = await encKey.decrypt(await encFile.arrayBuffer(), "arraybuffer");

  let decryptFile = new File([decryptBuffer], filename);

  //download file (this is a hacky solution)

  downloadFile(decryptFile);

}