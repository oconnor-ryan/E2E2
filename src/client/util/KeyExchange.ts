import { KeyType, UserInfo } from "../shared/Constants.js";
import { getDatabase } from "./StorageHandler.js";

import * as ecdh from "../encryption/ECDH.js";
import * as aes from "../encryption/AES.js";
import * as x3dh from "./X3DH.js";
import { getUserKeysForChat, sendKeyExchange } from "./EasyFetch.js";
import { arrayBufferToBase64 } from "../encryption/Base64.js";

export async function importKey(chatId: number, data: {ephemeralKeyBase64: string, exchangeKeyBase64: string, encSenderKeyBase64: string, saltBase64: string}) {
  const storageHandler = await getDatabase();

  const exchangeKeyPair = await storageHandler.getKey(KeyType.EXCHANGE_ID_PAIR) as CryptoKeyPair;
  const exchangePreKeyPair = await storageHandler.getKey(KeyType.EXCHANGE_PREKEY_PAIR) as CryptoKeyPair;

  const theirEphemeralKey = await ecdh.importKey(data.ephemeralKeyBase64);
  const theirExchangeKey = await ecdh.importKey(data.exchangeKeyBase64);

  const secretKey = (await x3dh.x3dh_receiver(
    exchangeKeyPair.privateKey,
    exchangePreKeyPair.privateKey,
    theirExchangeKey,
    theirEphemeralKey,
    data.saltBase64
  )).secretKey;

  let senderKey = await aes.upwrapKey(data.encSenderKeyBase64, secretKey);

  await storageHandler.updateChat({chatId: chatId, secretKey: senderKey});

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

  const senderKey = await aes.generateAESKey(true);

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

    const ephemeralKeyPair = await ecdh.createKeyPair();


    let {secretKey, salt} = await x3dh.x3dh_sender(
      myIdKeyPair.privateKey,
      ephemeralKeyPair.privateKey,
      await ecdh.importKey(member.exchange_key_base64),
      await ecdh.importKey(member.exchange_prekey_base64)
    );
    
    let encSenderKeyBase64 = await aes.wrapKey(senderKey, secretKey);

    keyExchangeData.memberKeyList.push({
      id: member.id, 
      senderKeyEncBase64: encSenderKeyBase64, 
      saltBase64: arrayBufferToBase64(salt),
      ephemeralKeyBase64: await ecdh.exportPublicKey(ephemeralKeyPair.publicKey),
    });
  }


  //send exchange to server
  await sendKeyExchange(keyExchangeData.chatId, keyExchangeData.memberKeyList);

  //save to indexeddb
  await storageHandler.addChat({chatId: chatId, secretKey: senderKey});

}