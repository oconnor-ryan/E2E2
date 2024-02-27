import * as storage from './StorageHandler.js'
import * as ecdsa from '../encryption/ECDSA.js';
import * as ecdh from '../encryption/ECDH.js';
import * as aes from '../encryption/AES.js';
import * as hkdf from '../encryption/HKDF.js';

import { getDatabase } from './StorageHandler.js';

import { ErrorCode, KeyType, UserInfo } from '../shared/Constants.js';
import { arrayBufferToBase64, base64ToArrayBuffer } from '../encryption/Base64.js';

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

async function x3dh_sender(
  myIdKey: CryptoKey,
  myEphemeralKey: CryptoKey,
  theirIdKey: CryptoKey,
  theirPreKey: CryptoKey
) {
  return await x3dh(
    myIdKey,
    myEphemeralKey,
    theirIdKey,
    theirPreKey
  );
}

async function x3dh_receiver(
  myIdKey: CryptoKey,
  myPreKey: CryptoKey,
  theirIdKey: CryptoKey,
  theirEphemeralKey: CryptoKey,
  saltBase64: string
) {
  return await x3dh(
    myIdKey,
    myPreKey,
    theirIdKey,
    theirEphemeralKey,
    saltBase64
  );
}

async function x3dh(
  privateIdKey: CryptoKey, 
  privateEphemeralOrPreKey: CryptoKey, 
  publicIdKey: CryptoKey,
  publicEphemeralOrPreKey: CryptoKey,
  saltBase64?: string
) {

  //perform 3 Diffie-Hellman functions record the derived bytes
  //from each function
  let dh1 = await ecdh.deriveBits(privateIdKey, publicEphemeralOrPreKey);
  let dh2 = await ecdh.deriveBits(privateEphemeralOrPreKey, publicIdKey);
  let dh3 = await ecdh.deriveBits(privateEphemeralOrPreKey, publicEphemeralOrPreKey);

  //concatenate the raw bytes of each key into one input key material
  //for HKDF
  let keyMaterial = concatBuffers(dh1, dh2, dh3);

  //though not technically a key, the HKDF CryptoKey is used
  //as the input key material (IKM) for the deriveKey function,
  //which actually performs HKDF. 
  let hkdfKey = await hkdf.importKey(keyMaterial);

  let salt;
  if(!saltBase64) {
    //generate 20 random bytes as the salt for HKDF
    salt = window.crypto.getRandomValues(new Uint8Array(20));
  } else {
    salt = base64ToArrayBuffer(saltBase64);
  }

  //perform HKDF function and get the AES key derived from it.
  let secretKey = await hkdf.deriveKey(hkdfKey, salt);

  return {secretKey: secretKey, salt: salt};
}

/**
 * Concatenates a list of buffers into a single ArrayBuffer.
 * Each buffer is stored in the returned buffer in the order it appears in 
 * the 'buffers' parameter
 * @param buffers 
 * @returns 
 */
function concatBuffers(...buffers: ArrayBuffer[]) {
  let byteLength = 0;
  for(let buffer of buffers) {
    byteLength += buffer.byteLength;
  }

  let newBuffer = new Uint8Array(byteLength);

  for(let i = 0; i < buffers.length; i++) {
    newBuffer.set(new Uint8Array(buffers[i]), i == 0 ? 0 : buffers[i-1].byteLength);
  }

  return newBuffer.buffer;
}