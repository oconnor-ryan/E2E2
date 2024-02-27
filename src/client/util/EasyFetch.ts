import * as storage from './StorageHandler.js'
import * as ecdsa from '../encryption/ECDSA.js';
import * as ecdh from '../encryption/ECDH.js';
import * as aes from '../encryption/AES.js';

import { getDatabase } from './StorageHandler.js';

import { ErrorCode, KeyType, UserInfo } from '../shared/Constants.js';
import { arrayBufferToBase64 } from '../encryption/Base64.js';
import { x3dh_sender } from './X3DH.js';

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

  if(!acceptedResult.chat) {
    throw new Error("Unable to retrieve joined chat!");
  }

  await initKeyExchange(chatId);
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

  await storageHandler.addChat({chatId: res.chat.id, secretKey: chatKey});


  return res.chat;
}

export async function getChatInfo(chatId: number) : Promise<{members: {id: string, canInvite: boolean, isAdmin: boolean}[]}> {
  let chatInfoResult = await ezFetch("/api/getchatinfo", {chatId: chatId});
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

  let res = await ezFetch("/api/getuserkeysfromchat", {chatId: chatId});
  if(res.error) {
    throw new Error(res.error);
  }

  return res.keys;
}

export async function initKeyExchange(chatId: number, members?: UserInfo[]) {
  if(!members) {
    members = (await getUserKeysForChat(chatId)) ?? undefined;
  }
  if(!members) {
    throw new Error("No users found in chat!");
  }

  let storageHandler = await getDatabase();

  let myUsername = storageHandler.getUsername();
  if(!myUsername) {
    throw new Error("Not logged in!");
  }

  const myIdKeyPair = await storageHandler.getKey(KeyType.EXCHANGE_ID_PAIR) as CryptoKeyPair;
  const ephemeralKeyPair = await ecdh.createKeyPair();

  const senderKey = await aes.generateAESKey(true);

  let keyExchangeData: {
    chatId: number,
    ephemeralKeyBase64: string,
    memberKeyList: {id: string, senderKeyEncBase64: string, saltBase64: string}[]
  } = {
    chatId: chatId,
    ephemeralKeyBase64: await ecdh.exportPublicKey(ephemeralKeyPair.publicKey),
    memberKeyList: []
  };

  for(let member of members) {
    //dont encrypt key for yourself
    if(member.id === myUsername) {
      continue;
    }

    let {secretKey, salt} = await x3dh_sender(
      myIdKeyPair.privateKey,
      ephemeralKeyPair.privateKey,
      await ecdh.importKey(member.exchange_key_base64),
      await ecdh.importKey(member.exchange_prekey_base64)
    );
    
    let encSenderKeyBase64 = await aes.wrapKey(senderKey, secretKey);

    keyExchangeData.memberKeyList.push({
      id: member.id, 
      senderKeyEncBase64: encSenderKeyBase64, 
      saltBase64: arrayBufferToBase64(salt)
    });
  }

  let res = await ezFetch("/api/sendkeyexchangetochat", keyExchangeData, "POST");

  if(res.error) {
    throw new Error(res.error);
  }

  storageHandler.addChat({chatId: chatId, secretKey: senderKey});

}

