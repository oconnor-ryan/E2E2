import * as storage from './StorageHandler.js'
import * as ecdsa from '../encryption/ECDSA.js';
import * as ecdh from '../encryption/ECDH.js';
import * as aes from '../encryption/AES.js';
import { getDatabase } from './StorageHandler.js';

import { ErrorCode } from '../shared/Constants.js';

export async function createAccount(username: string) {
  let storageHandler = await getDatabase();
  //using Promise.all so that all three keys are generated concurrently
  let [idKeyPair, exchangeKeyPair, preKey] = await Promise.all([
    ecdsa.createKeyPair(), 
    ecdh.createKeyPair(), 
    ecdh.createKeyPair()
  ])

  let [exportedIdPubKey, exportedExchangePubKey, exportedPrePubKey] = await Promise.all([
    ecdsa.exportPublicKey(idKeyPair.publicKey),
    ecdh.exportPublicKey(exchangeKeyPair.publicKey),
    ecdh.exportPublicKey(preKey.publicKey)
  ]);

  let [exchangeKeySignature, preKeySignature] = await Promise.all([
    ecdsa.sign(exportedExchangePubKey, idKeyPair.privateKey),
    ecdsa.sign(exportedPrePubKey, idKeyPair.privateKey),
  ]);

  let response = await fetch(
    "/api/create-account", 
    {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
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
    storageHandler.addKey({keyType: "id_keypair", key: idKeyPair});
    storageHandler.addKey({keyType: "exchange_keypair", key: exchangeKeyPair});
    storageHandler.addKey({keyType: "exchange_prekey_keypair", key: idKeyPair});

    storageHandler.updateUsername(username);
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
  if(!jsonData) {
    jsonData = {};
  }

  let storageHandler = await storage.getDatabase();
  let keyPair = await storageHandler.getKey('id_keypair') as CryptoKeyPair | undefined;
  if(!keyPair) {
    throw new Error("No signing key found! Might want to restore to a backup account!");
  }

  let jsonStr = JSON.stringify(jsonData);
  let res = await fetch(
    url, 
    {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        //custom HTTP headers for storing the signature of the HTTP request body
        //and the user who claims to have sent the request
        'E2E2-Body-Signature': await ecdsa.sign(jsonStr, keyPair.privateKey),
        'E2E2-User-Id': storageHandler.getUsername() ?? ""
      },
      body: jsonStr
    }
    
  )

  let jsonRes = await res.json();
  if(jsonRes.error && jsonRes.error === ErrorCode.NOT_LOGGED_IN) {
    throw new Error("Unable to authenticate you!");
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
  let res = await ezFetch('/api/getinvites');
  if(res.error) {
    throw new Error(res.error);
  }
  return res.invites;
}

export async function invite(invitedUser: string, chatId: number) {
  let res = await ezFetch("/api/invite", {user: invitedUser, chatId: chatId});

  if(res.error) {
    throw new Error(res.error);
  }
}

export async function acceptInvite(chatId: number) {
  let acceptedResult = await ezFetch("/api/acceptinvite", {chatId: chatId});
  if(acceptedResult.error) {
    throw new Error(acceptedResult.error);
  }
}

export async function getChats() : Promise<{[chat_id: string] : string[]}>{
  let chatListResult = await ezFetch("/api/getchats");
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

  let res = await ezFetch("/api/createchat");
  if(res.error) {
    throw new Error(res.error);
  }

  let chatKey = await aes.generateAESKey();

  storageHandler.addChat({chatId: res.chat.id, members: [{id: username}], secretKey: chatKey});


  return res.chat;
}

export async function getChatInfo(chatId: number) : Promise<{members: {id: string, canInvite: boolean, isAdmin: boolean}[]}> {
  let chatInfoResult = await ezFetch("/api/getchatinfo", {chatId: chatId});
  if(chatInfoResult.error) {
    throw new Error(chatInfoResult.error);
  }

  return chatInfoResult.chatInfo;
}

