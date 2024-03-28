import { getDatabase } from "../util/StorageHandler.js";
import { KeyType } from "../shared/Constants.js";
import { EncryptedMessageDecoder, Message, encryptMessage, formatAndSaveMessage } from "../util/MessageHandler.js";
import { AesGcmKey } from "../encryption/encryption.js";

/**
 * These describe the callbacks that can be called after
 * a message from a WebSocket is parsed and handled.
 * 
 * This allows us to use the outputs obtained from the
 * message to be used in other Javascript modules (ex: 
 * to display messages, show notifications, display errors)
 * 
 * This is exclusively for messages sent by another
 * client.
 */
export interface UserMessageCompleteCallbacks {
  "message": (data: {senderId: string, message: string}) => void,
};

/**
 * These describe the callbacks that can be called after
 * a message from a WebSocket is parsed and handled.
 * 
 * This allows us to use the outputs obtained from the
 * message to be used in other Javascript modules (ex: 
 * to display messages, show notifications, display errors)
 * 
 * This is exclusively for messages sent by the server
 * rather than ones that another client has sent.
 */
export interface ServerMessageCompleteCallbacks {
  "userOnline": (user: string) => void,
  "userOffline": (user: string) => void,
  "retrieveNewKey": (error: Error | null) => void,
  "messageConfirm": (chatId: number, uuid: string) => void

};


export async function chatSocketBuilder(
  chatId: number, 
  userMessageParsedCallbacks: UserMessageCompleteCallbacks,
  serverMessageParsedCallbacks: ServerMessageCompleteCallbacks
) {
  const storageHandler = await getDatabase();

  let username = storageHandler.getUsername();
  if(!username) {
    throw new Error("Not logged in!");
  }

  let chatInfo = await storageHandler.getChat(chatId);
  let chatSenderKey = chatInfo.secretKey;
  let keyExchangeId = chatInfo.keyExchangeId;

  if(!chatSenderKey || !keyExchangeId) {
    throw new Error("No Sender Key stored!");
  }

  let idKeyPair = await storageHandler.getKey(KeyType.IDENTITY_KEY_PAIR);
  if(!idKeyPair) {
    throw new Error("Cannot find identity key!");
  }

  //sign the userId so that the server can validate that 
  //the userId matches with the signature provided
  let signature = await idKeyPair.privateKey.sign(username, "base64url");

  return new ChatSocketHandler(chatId, username, signature, chatSenderKey, keyExchangeId, userMessageParsedCallbacks, serverMessageParsedCallbacks);
}

export type {ChatSocketHandler}

class ChatSocketHandler {
  private ws: WebSocket;
  private senderKey: AesGcmKey;
  private userMessageCallbacks: UserMessageCompleteCallbacks;
  private serverMessageCallbacks: ServerMessageCompleteCallbacks;
  private chatId: number;
  private userId: string;

  private decoder;

  constructor(
    chatId: number, 
    userId: string, 
    signatureBase64URL: string, 
    senderKey: AesGcmKey,
    keyExchangeId: number,
    userMessageCallbacks: UserMessageCompleteCallbacks,
    serverMessageCallbacks: ServerMessageCompleteCallbacks
  ) {
    this.userMessageCallbacks = userMessageCallbacks;
    this.serverMessageCallbacks = serverMessageCallbacks;
    this.chatId = chatId;
    this.userId = userId;
    this.senderKey = senderKey;

    this.decoder = new EncryptedMessageDecoder(this.userMessageCallbacks, this.chatId);

    let protocol = window.isSecureContext ? "wss://" : "ws://";
    this.ws = new WebSocket(`${protocol}${window.location.host}?chatId=${chatId}&userId=${userId}&signatureBase64URL=${signatureBase64URL}&keyExchangeId=${keyExchangeId}`);
    this.ws.binaryType = "arraybuffer"; //use this instead of Blob

    this.ws.onopen = this.onOpen.bind(this);
    this.ws.onerror = this.onError.bind(this);
    this.ws.onclose = this.onClose.bind(this);
    this.ws.onmessage = this.onMessage.bind(this);
  }

  public async sendMessage(data: Message) {
    if(this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open!");
    }

    let encData = await encryptMessage(data, this.senderKey);
    this.ws.send(encData);
  }

  //when a WebSocket connection is successfully established
  protected onOpen(e: Event) {
    console.log("Connected To WebSocket Successfully!");
  }

  //when a WebSocket connection closes due to an error
  protected onError(e: Event) {
    console.error("WebSocket Error: ", e);
  }

  //when a WebSocket connection is closed by client or server
  protected onClose(e: CloseEvent) {
    console.log("WebSocket connection closed!");
  } 

  //when a message is received during WebSocket connection
  protected async onMessage(e: MessageEvent<any>) {
    if(e.data instanceof ArrayBuffer) {
      //to keep things simple, all messages are encrypted binary
      await this.handleEncryptedMessage(e.data);
    } 
    //string, so this is not an encrypted message from another
    //client. This is most likely a notification from the server
    else {
      this.handleServerMessage(e.data);
    }


  }

  protected async handleEncryptedMessage(data: ArrayBuffer) {
    await this.decoder.decodeMessageWithUUIDAppended(data, this.senderKey);
  }

  protected async handleServerMessage(data: string) {
    let messageJSON = JSON.parse(data);
    switch(messageJSON.type) {
      case "userOnline":
        this.serverMessageCallbacks["userOnline"](messageJSON.userId);
        break;
      case "userOffline":
        this.serverMessageCallbacks["userOffline"](messageJSON.userId);
        break;
      case "retrieveNewKey":
        this.serverMessageCallbacks["retrieveNewKey"](null);
        break;
      case "messageConfirm":
        this.serverMessageCallbacks["messageConfirm"](this.chatId, messageJSON.uuid);
        break;
    }
  }

  


}