import { Database, LOCAL_STORAGE_HANDLER, getDatabase } from "../storage/StorageHandler.js";
import { BaseMessage, ErrorMessage, Message, KeyExchangeRequest, QueuedMessagesAndInvitesObj, QueuedOfflineMessagesRequest, CalleeInfoResponse, CalleeInfoRequest } from "../message-handler/MessageType.js";
import { InviteSenderBuilder, MessageSenderBuilder, SocketMessageSender } from "../message-handler/MessageSender.js";
import { MessageReceivedEventHandler, messageParseError, parseError, parseMessage, parseKeyExchangeRequest, parseQueuedMessagesAndInvites } from "../message-handler/MessageParser.js";


class WebSocketHandler {
  public readonly  messageSenderBuilder: MessageSenderBuilder;
  public readonly inviteSenderBuilder: InviteSenderBuilder;
  private messageReceiver: MessageReceivedEventHandler;
  private ws: WebSocket;

  constructor(db: Database, messageReceiver: MessageReceivedEventHandler) {
    this.messageReceiver = messageReceiver;

    let protocol = window.isSecureContext ? "wss://" : "ws://";
    this.ws = new WebSocket(`${protocol}${window.location.host}?credential=${LOCAL_STORAGE_HANDLER.getWebSocketCred()}`);
    this.ws.binaryType = "arraybuffer"; //use this instead of Blob
    

    //this is used for the callback functions since the value of "this" is
    //different in the callback function than from the class 
    //https://stackoverflow.com/questions/16553347/accessing-a-class-property-in-a-callback-function
    var socketHandler = this;

    this.ws.onopen = (e) => {
      console.log("WebSocket connected!");
      this.getOfflineMessagesRequest(db).catch(e => {
        console.error(e);
      });
      messageReceiver.onsocketopen();
    };
    
    this.ws.onerror = (e) => {
      console.error("WebSocket got an error", e);
    };
    
    this.ws.onclose = (ev) => {
      console.log("WebSocket closed for reason:", ev.reason);
    }

    this.messageSenderBuilder = new MessageSenderBuilder(this.ws, db);
    this.inviteSenderBuilder = new InviteSenderBuilder(this.ws, db);
    
    this.ws.onmessage = (e) => {
      const rawData: string = e.data instanceof ArrayBuffer ? new TextDecoder().decode(e.data) : e.data;
    
      let data;
      try {
        data = JSON.parse(rawData) as BaseMessage;
      } catch(e) {
        return messageParseError('not-json');
      }
    
      switch(data.type) {
        case 'message': 
        case 'call':
          parseMessage(data as Message, db, socketHandler.messageReceiver);
          break;
        case 'key-exchange-request':
          parseKeyExchangeRequest(data as KeyExchangeRequest, db, socketHandler.messageReceiver);
          break;
        case 'queued-offline-messages': 
          parseQueuedMessagesAndInvites(data as QueuedMessagesAndInvitesObj, db, socketHandler.messageReceiver);
          break;
        case 'get-call-info-of-users':
          socketHandler.messageReceiver.oncallinforesponse(data as CalleeInfoResponse);
          break;
        case 'error':
          parseError(data as ErrorMessage, socketHandler.messageReceiver);
          break;
        default:
          return messageParseError('invalid-type');
      }
    }
    
  }

  async getOfflineMessagesRequest(db: Database) {
    let myAcc = (await db.accountStore.get(LOCAL_STORAGE_HANDLER.getUsername()!))!;

    let data: QueuedOfflineMessagesRequest = {
      type: 'queued-offline-messages',
      lastReadMessageUUID: myAcc.lastReadMessageUUID,
      lastReadExchangeUUID: myAcc.lastReadKeyExchangeRequestUUID
    };

    this.ws.send(JSON.stringify(data));
  }

  async sendCallInfoRequest(db: Database) {
    let knownUsers = await db.knownUserStore.getAll();

    let data: CalleeInfoRequest = {
      type: 'get-call-info-of-users',
      users: knownUsers.map(u => u.username)
    };

    console.log(data);

    this.ws.send(JSON.stringify(data));
  }

  setMessageReceiver(messageReceiver: MessageReceivedEventHandler) {
    this.messageReceiver = messageReceiver;
  }
}

export type {WebSocketHandler};
//make this syncronous so that messageReceiver events that need to be able to 
//send data to websocket can easily create callbacks to that websocket without missing 
//any websocket messages
export const getWebSocketHandler = (() => {

  //singleton pattern, we only want one persistant websocket connection
  let websocketHandler: WebSocketHandler | undefined = undefined;

  return (db: Database, messageReceiver: MessageReceivedEventHandler) => {
    if(websocketHandler) {
      websocketHandler.setMessageReceiver(messageReceiver);
      return websocketHandler;
    }

    websocketHandler = new WebSocketHandler(db, messageReceiver);
    return websocketHandler;

  }
})();


