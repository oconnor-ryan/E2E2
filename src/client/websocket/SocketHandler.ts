import { Database, LOCAL_STORAGE_HANDLER, getDatabase } from "../storage/StorageHandler.js";
import {KnownUserEntry} from '../storage/ObjectStore.js';
import { BaseMessage, ErrorMessage, Message, KeyExchangeRequest, QueuedMessagesAndInvitesObj } from "../message-handler/MessageType.js";
import { InviteSenderBuilder, MessageSenderBuilder, SocketMessageSender } from "../message-handler/MessageSender.js";
import { MessageReceivedEventHandler, messageParseError, parseError, parseMessage, parseKeyExchangeRequest, parseQueuedMessagesAndInvites } from "../message-handler/MessageParser.js";


//make this syncronous so that messageReceiver events that need to be able to 
//send data to websocket can easily create callbacks to that websocket without missing 
//any websocket messages
export function startWebSocketConnection(db: Database, messageReceiver: MessageReceivedEventHandler) {
  let protocol = window.isSecureContext ? "wss://" : "ws://";
  const ws = new WebSocket(`${protocol}${window.location.host}?credential=${LOCAL_STORAGE_HANDLER.getWebSocketCred()}`);
  ws.binaryType = "arraybuffer"; //use this instead of Blob

  ws.onopen = (e) => {
    console.log("WebSocket connected!");
  };
  
  ws.onerror = (e) => {
    console.error("WebSocket got an error", e);
  };
  
  ws.onclose = (ev) => {
    console.log("WebSocket closed!");
  }
  
  ws.onmessage = (e) => {
    const rawData: string = e.data instanceof ArrayBuffer ? new TextDecoder().decode(e.data) : e.data;
  
    let data;
    try {
      data = JSON.parse(rawData) as BaseMessage;
    } catch(e) {
      return messageParseError('not-json');
    }
  
    switch(data.type) {
      case 'message': 
        parseMessage(data as Message, db, messageReceiver);
        break;
      case 'key-exchange-request':
        parseKeyExchangeRequest(data as KeyExchangeRequest, db, messageReceiver);
        break;
      case 'queued-exchanges-and-messages': 
        parseQueuedMessagesAndInvites(data as QueuedMessagesAndInvitesObj, db, messageReceiver);
        break;
      case 'error':
        parseError(data as ErrorMessage, messageReceiver);
        break;
      default:
        return messageParseError('invalid-type');
    }
  }

  return {
    messageSenderBuilder: new MessageSenderBuilder(ws, db),
    inviteSenderBuilder: new InviteSenderBuilder(ws, db)
  };


}







