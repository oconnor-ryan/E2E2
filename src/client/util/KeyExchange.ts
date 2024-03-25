import { KeyType, UserInfo } from "../shared/Constants.js";
import { getDatabase } from "./StorageHandler.js";

import { ECDHPublicKey, AesGcmKey, createECDHKeyPair } from "../encryption/encryption.js";
import * as x3dh from "./X3DH.js";
import { getUserKeysForChat, sendKeyExchange } from "./EasyFetch.js";
import { arrayBufferToBase64 } from "./Base64.js";

export async function saveKeyFromExchange(chatId: number, data: {ephemeralKeyBase64: string, exchangeKeyBase64: string, senderKeyEncBase64: string, saltBase64: string, keyExchangeId: number, identityKeyBase64: string}) {
  const storageHandler = await getDatabase();


  const exchangeKeyPair = await storageHandler.getKey(KeyType.EXCHANGE_ID_PAIR);
  const exchangePreKeyPair = await storageHandler.getKey(KeyType.EXCHANGE_PREKEY_PAIR);

  if(!exchangeKeyPair || !exchangePreKeyPair) {
    throw new Error("No saved exchange keys found!");
  }


  const theirEphemeralKey = await ECDHPublicKey.importKey(data.ephemeralKeyBase64);
  const theirExchangeKey = await ECDHPublicKey.importKey(data.exchangeKeyBase64);


  const secretKey = (await x3dh.x3dh_receiver(
    exchangeKeyPair.privateKey,
    exchangePreKeyPair.privateKey,
    theirExchangeKey,
    theirEphemeralKey,
    data.saltBase64
  )).secretKey;


  let senderKey = await secretKey.upwrapKeyAesGcmKey(data.senderKeyEncBase64);

  let chatInfo = await storageHandler.getChat(chatId);
  await storageHandler.updateChat({chatId: chatId, secretKey: senderKey, keyExchangeId: data.keyExchangeId, lastReadMessageUUID: chatInfo.lastReadMessageUUID});

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

  const myIdKeyPair = await storageHandler.getKey(KeyType.EXCHANGE_ID_PAIR);
  if(!myIdKeyPair) {
    throw new Error("Your identity key was not found!");
  }

  const senderKey = await AesGcmKey.generateKey(true);

  let keyExchangeData: {
    chatId: number,
    memberKeyList: {id: string, senderKeyEncBase64: string, saltBase64: string, ephemeralKeyBase64: string}[]
  } = {
    chatId: chatId,
    memberKeyList: []
  };

  for(let member of members) {
    //dont encrypt key for yourself
    if(member.id === myUsername) {
      continue;
    }

    const ephemeralKeyPair = await createECDHKeyPair();


    let {secretKey, salt} = await x3dh.x3dh_sender(
      myIdKeyPair.privateKey,
      ephemeralKeyPair.privateKey,
      await ECDHPublicKey.importKey(member.exchange_key_base64),
      await ECDHPublicKey.importKey(member.exchange_prekey_base64)
    );


    let encSenderKeyBase64 = arrayBufferToBase64(await secretKey.wrapKeyAesGcmKey(senderKey));


    keyExchangeData.memberKeyList.push({
      id: member.id, 
      senderKeyEncBase64: encSenderKeyBase64, 
      saltBase64: arrayBufferToBase64(salt),
      ephemeralKeyBase64: await ephemeralKeyPair.publicKey.exportKey(),
    });
  }


  //send exchange to server
  let keyExchangeId = await sendKeyExchange(keyExchangeData.chatId, keyExchangeData.memberKeyList);

  //save to indexeddb
  let chatInfo = await storageHandler.getChat(chatId);
  await storageHandler.addChat({chatId: chatId, secretKey: senderKey, keyExchangeId: keyExchangeId, lastReadMessageUUID: chatInfo.lastReadMessageUUID});

}