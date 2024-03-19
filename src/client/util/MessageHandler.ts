import * as aes from "../encryption/AES.js";
import * as ecdh from '../encryption/ECDH.js';
import * as ecdsa from '../encryption/ECDSA.js';


import * as fetcher from  "./EasyFetch.js";
import { getDatabase } from "./StorageHandler.js";

import { UserMessageCompleteCallbacks } from "../websocket/ChatSocketProtocol.js";
import { KeyType } from "../shared/Constants.js";
import { x3dh_receiver } from "./X3DH.js";
import { saveKeyFromExchange } from "./KeyExchange.js";

export interface Message {
  message: string, 
  type: string, 
  senderId: string
}

export class EncryptedMessageDecoder {
  private userMessageCallbacks;
  private chatId;

  constructor(userMessageCallbacks: UserMessageCompleteCallbacks, chatId: number) {
    this.userMessageCallbacks = userMessageCallbacks;
    this.chatId = chatId;
  }

  async decodeMessage(dataEnc: string | ArrayBuffer, key: CryptoKey) {
    let decrypted = await aes.decrypt(dataEnc, key);
    console.log(decrypted);
    let val = JSON.parse(decrypted) as Message;

    //automatically save each message to client after decoding
    saveMessage(val, this.chatId).catch(e => console.error(e));

    //@ts-ignore
    if(!this.userMessageCallbacks[val.type as string]) {
      throw new Error("Message Type is Unknown!");
    }


    //@ts-ignore
    this.userMessageCallbacks[val.type](val);
  }
}


//format message in the format other clients will expect
export async function formatMessage(message: string, type: "message" = "message") : Promise<Message> {
  let storageHandler = await getDatabase();

  let data = {
    type: type,
    senderId: storageHandler.getUsername() ?? "",
    message: message 
  };

  return data;
}


export async function saveMessage(data: Message, chatId: number) {
  let storageHandler = await getDatabase();

  await storageHandler.addMessage({
    chatId: chatId,
    data: data
  })
}

//helper function used only by a sender of a message to simplify formatting and saving a message
export async function formatAndSaveMessage(message: string, chatId: number, type: "message" = "message") {
  let formattedMessage = await formatMessage(message, type);
  saveMessage(formattedMessage, chatId).catch(e => console.error(e));
  return formattedMessage;
}

export async function encryptMessage(data: Message, key: CryptoKey) {
  return await aes.encrypt(JSON.stringify(data), key, "arraybuffer");
}

export async function decryptPrevMessages(chatId: number, decoder: EncryptedMessageDecoder) {
  let storageHandler = await getDatabase();

  let chatInfo = await storageHandler.getChat(chatId);


  //include the current key exchange being used so that server can only retrieve exchanges and messages that
  //occur after this key exchange
  let exchanges = await fetcher.getKeyExchanges(chatId, chatInfo.keyExchangeId ?? undefined);
  let messages = await fetcher.getLatestMessages(chatId, chatInfo.keyExchangeId ?? undefined);

  //in future, we will render messages differently to take advantage of having newest to oldest order.
  //(get 1st 100 messages, then next 100, etc)
  messages.reverse(); //for now, display messages in correct order.


  //no messages to decrypt
  if(messages.length === 0) {
    return;
  }


  let myExchangeKeyPrivate = (await storageHandler.getKey(KeyType.EXCHANGE_ID_PAIR) as CryptoKeyPair).privateKey;
  let myExchangePreKeyPrivate = (await storageHandler.getKey(KeyType.EXCHANGE_PREKEY_PAIR) as CryptoKeyPair).privateKey;


  let exchangeWithImportedKeys: {
    [id: string] : {
      ephemeralKeyPublic: CryptoKey,
      senderKeyEncBase64: string;
      saltBase64: string;
      exchangeKeyPublic: CryptoKey;
      identityKeyPublic: CryptoKey;
    }
  } = {};

  console.log(exchanges);
  for(let exchange of exchanges) {
    exchangeWithImportedKeys[String(exchange.exchangeId)] = {
      ephemeralKeyPublic: await ecdh.importPublicKey(exchange.ephemeralKeyBase64),
      exchangeKeyPublic: await ecdh.importPublicKey(exchange.exchangeKeyBase64),
      identityKeyPublic: await ecdsa.importPublicKey(exchange.identityKeyBase64),
      saltBase64: exchange.saltBase64,
      senderKeyEncBase64: exchange.senderKeyEncBase64
    }
  }

  //if there are no pending exchanges, try using the senderKey stored in IndexedDB
  if(exchanges.length === 0) {
    let senderKey = (await storageHandler.getChat(chatId)).secretKey;
    if(!senderKey) {
      throw new Error("No Sender Key and No Key Exchanges, cannot decrypt any messages");
    }
    for(let message of messages) {
      try {
        await decoder.decodeMessage(message.data_enc_base64, senderKey);
      } catch(e) {
        //you cannot decrypt this message most likely because these messages were sent before you joined
      }

    }
    return;
  }

  //take the newest key exchange and import it into IndexedDB
  if(exchanges.length > 0) {
    let newestExchange = exchanges[exchanges.length-1];


    await saveKeyFromExchange(chatId, {
      ephemeralKeyBase64: newestExchange.ephemeralKeyBase64,
      exchangeKeyBase64: newestExchange.exchangeKeyBase64,
      senderKeyEncBase64: newestExchange.senderKeyEncBase64,
      saltBase64: newestExchange.saltBase64,
      keyExchangeId: newestExchange.exchangeId,
      identityKeyBase64: newestExchange.identityKeyBase64
    });

  }

  for(let message of messages) {
    let exchangeData = exchangeWithImportedKeys[message.key_exchange_id];

    //a newly joined user cannot decrypt previously sent messages!
    if(!exchangeData) {
      continue;
    }

    let secretKey = (await x3dh_receiver(
      myExchangeKeyPrivate,
      myExchangePreKeyPrivate,
      exchangeData.exchangeKeyPublic,
      exchangeData.ephemeralKeyPublic,
      exchangeData.saltBase64
    )).secretKey;


    let senderKey = await aes.upwrapKey(exchangeData.senderKeyEncBase64, secretKey);


    await decoder.decodeMessage(message.data_enc_base64, senderKey);
  }
}