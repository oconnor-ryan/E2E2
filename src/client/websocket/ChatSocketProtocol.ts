import { getDatabase } from "../util/StorageHandler.js";
import * as ecdsa from "../encryption/ECDSA.js";
import * as ecdh from "../encryption/ECDH.js";
import * as aes from "../encryption/AES.js";
import * as x3dh from "../util/X3DH.js";
import { KeyType } from "../shared/Constants.js";

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
  "message": (user: string, message: string) => void,
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
  "retrieveNewKey": (error: Error | null) => void

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

  let chatSenderKey = (await storageHandler.getChat(chatId)).secretKey;

  //sign the userId so that the server can validate that 
  //the userId matches with the signature provided
  let signature = await ecdsa.sign(username, (await storageHandler.getKey(KeyType.IDENTITY_KEY_PAIR) as CryptoKeyPair).privateKey);

  return new ChatSocketHandler(chatId, username, signature, chatSenderKey, userMessageParsedCallbacks, serverMessageParsedCallbacks);
}

class ChatSocketHandler {
  private ws: WebSocket;
  private senderKey: CryptoKey;
  private userMessageCallbacks: UserMessageCompleteCallbacks;
  private serverMessageCallbacks: ServerMessageCompleteCallbacks;
  private chatId: number;
  private userId: string;

  constructor(
    chatId: number, 
    userId: string, 
    signatureBase64: string, 
    senderKey: CryptoKey,
    userMessageCallbacks: UserMessageCompleteCallbacks,
    serverMessageCallbacks: ServerMessageCompleteCallbacks
  ) {
    this.userMessageCallbacks = userMessageCallbacks;
    this.serverMessageCallbacks = serverMessageCallbacks;
    this.chatId = chatId;
    this.userId = userId;
    this.senderKey = senderKey;

    let protocol = window.isSecureContext ? "wss://" : "ws://";
    this.ws = new WebSocket(`${protocol}${window.location.host}?chatId=${chatId}&userId=${userId}&signatureBase64=${signatureBase64}`);
    this.ws.binaryType = "arraybuffer"; //use this instead of Blob

    this.ws.onopen = this.onOpen.bind(this);
    this.ws.onerror = this.onError.bind(this);
    this.ws.onclose = this.onClose.bind(this);
    this.ws.onmessage = this.onMessage.bind(this);
  }

  public async sendMessage(message: string) {
    if(this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open!");
    }

    let data = {
      type: "message",
      userId: this.userId,
      message: message 
    };

    let encData = await aes.encrypt(JSON.stringify(data), this.senderKey, "arraybuffer");

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
      this.handleEncryptedMessage(e.data);
    } 
    //string, so this is not an encrypted message from another
    //client. This is most likely a notification from the server
    else {
      this.handleServerMessage(e.data);
    }


  }

  protected async handleEncryptedMessage(data: ArrayBuffer) {
    let messageJSON = JSON.parse(await aes.decrypt(data, this.senderKey));

    switch(messageJSON.type) {
      case "message":
        this.userMessageCallbacks["message"](messageJSON.userId, messageJSON.message);
        break;
    }
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
    }
  }

  


}