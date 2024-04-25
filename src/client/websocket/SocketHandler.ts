import { LOCAL_STORAGE_HANDLER, getDatabase } from "../storage/StorageHandler.js";
import {KnownUserEntry} from '../storage/ObjectStore.js';
import { BaseMessage, ErrorMessage, Message, MessageInvite, QueuedMessagesAndInvitesObj } from "../message-handler/MessageType.js";
import { SocketMessageSender, socketInviteSenderBuilder } from "../message-handler/MessageSender.js";
import { MessageReceivedEventHandler, messageParseError, parseError, parseMessage, parseMessageInvite, parseQueuedMessagesAndInvites } from "../message-handler/MessageParser.js";


export async function startWebSocketConnection() {
  let protocol = window.isSecureContext ? "wss://" : "ws://";
  const ws = new WebSocket(`${protocol}${window.location.host}?credential=${LOCAL_STORAGE_HANDLER.getWebSocketCred()}`);
  ws.binaryType = "arraybuffer"; //use this instead of Blob

  const db = await getDatabase();

  const inviteSender = await socketInviteSenderBuilder(ws, db);

  const messageSenderBuilder = async (ws: WebSocket, id: string, type: 'individual-key' | 'groupId') => {
    
    //get all known users I will be speaking to
    let receivers: KnownUserEntry[];
    if(type === 'individual-key') {
      receivers = [await db.knownUserStore.get(id)];
    } else {
      let memberIdKeyStrings = (await db.groupChatStore.get(id)).members;
      receivers = await Promise.all(memberIdKeyStrings.map(idKey => db.knownUserStore.get(idKey)));
    }
  
    let myIdKey = (await db.accountStore.get(LOCAL_STORAGE_HANDLER.getUsername()!)).identityKeyPair;
  
    return new SocketMessageSender(ws, receivers, myIdKey, type === 'groupId' ? id : undefined);
  };

  let messageReceiver = new MessageReceivedEventHandler();

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
      case 'message-invite':
        parseMessageInvite(data as MessageInvite, db, messageReceiver);
        break;
      case 'queued-invites-and-messages': 
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
    messageSenderBuilder: messageSenderBuilder,
    inviteSender: inviteSender,
    messageReceiver: messageReceiver
  }


}







