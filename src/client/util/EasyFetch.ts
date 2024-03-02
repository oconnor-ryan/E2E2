import * as storage from './StorageHandler.js'
import * as ecdsa from '../encryption/ECDSA.js';
import * as ecdh from '../encryption/ECDH.js';

import { getDatabase } from './StorageHandler.js';

import { ErrorCode, KeyType, UserInfo } from '../shared/Constants.js';
import { initKeyExchange } from './KeyExchange.js';

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
    storageHandler.addKey({keyType: KeyType.IDENTITY_KEY_PAIR, key: idKeyPair});
    storageHandler.addKey({keyType: KeyType.EXCHANGE_ID_PAIR, key: exchangeKeyPair});
    storageHandler.addKey({keyType: KeyType.EXCHANGE_PREKEY_PAIR, key: preKey});

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
  let keyPair = await storageHandler.getKey(KeyType.IDENTITY_KEY_PAIR) as CryptoKeyPair | undefined;
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
  let res = await ezFetch("/api/chat/invite", {user: invitedUser, chatId: chatId});

  if(res.error) {
    throw new Error(res.error);
  }
}

export async function acceptInvite(chatId: number) {
  let acceptedResult = await ezFetch("/api/acceptinvite", {chatId: chatId});
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
  await storageHandler.addChat({chatId: res.chat.id, secretKey: null, keyExchangeId: null});


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

export async function getKeyExchanges(chatId: number) : Promise<Array<{
    ephemeralKeyBase64: string,
    senderKeyEncBase64: string,
    saltBase64: string,
    exchangeId: number,
    exchangeKeyBase64: string,
    identityKeyBase64: string,
}>>{


  let res = await ezFetch("/api/chat/sendkeyexchangetochat", {chatId: chatId}, "POST");

  if(res.error) {
    throw new Error(res.error);
  }

  return res.result;
}

export async function getLatestMessages(chatId: number, numMessages?: number) : Promise<{
  id: number;
  data_enc_base64: string;
  sender_id: string;
  chat_id: number;
  key_exchange_id: number;
}[]>{
  let res = await ezFetch("/api/chat/chatmessages", {chatId: chatId, numMessages: numMessages});
  if(res.error) {
    throw new Error(res.error);
  }

  return res.messages;
}
