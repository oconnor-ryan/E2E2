import {RawData, WebSocket} from 'ws';
import {IncomingMessage} from 'http';
import { AccountIdentityWebSocket, BaseMessage, getIncomingMessages, getIncomingInvites, MessageInviteIncoming, Message, saveMessage, saveInvite } from '../util/database-handler.js';

interface AuthenticatedSocket {
  ws: WebSocket,
  acc: AccountIdentityWebSocket
}

class WebSocketConnectionList {
  private clients: AuthenticatedSocket[];

  constructor() {
    this.clients = [];
  }

  addSocket(authSocket: AuthenticatedSocket) {
    this.clients.push(authSocket);
  }

  //called when a websocket is closed
  removeSocket(ws: WebSocket) {
    let authSocketIndex = this.clients.findIndex((val) => {ws === val.ws});
    if(authSocketIndex === -1) {
      return;
    }
    this.clients.splice(authSocketIndex, 1);
  }

  getSocketByMailboxId(mailboxId: string) {
    return this.clients.find((val) => {mailboxId === val.acc.mailboxId});
  }

  getSocketByUsername(username: string) {
    return this.clients.find((val) => {username === val.acc.username});
  }

  getSocketByIdentityKey(identityKey: string) {
    return this.clients.find((val) => {identityKey === val.acc.identityKeyPublic});
  }
}

const authClientList = new WebSocketConnectionList();

//at this point, the user has already been authenticated
export function onConnection(ws: WebSocket, req: IncomingMessage, client: AccountIdentityWebSocket) {

  authClientList.addSocket({ws: ws, acc: client});

  let searchParams = new URL(req.url!, req.headers.host).searchParams;
  let lastReadUUID = searchParams.get('lastReadUUID') ?? undefined;

  //get pending messages and invites and send them to user
  Promise.all([getIncomingInvites(client.username), getIncomingMessages(client.mailboxId, lastReadUUID)])
   .then(result => {
    const [invites, messages] : [MessageInviteIncoming[], Message[]] = result;
    let response = {
      type: 'queued-invites-and-messages',
      invites: invites,
      messages: messages
    };

    ws.send(JSON.stringify(response));
   })
   .catch(e => {
    console.error(e);
    ws.send(JSON.stringify({
      type: 'error',
      error: "CannotGetQueuedMessagesAndInvites"
    }));
   });


  ws.on('close', (code, reason) => {
    authClientList.removeSocket(ws);
  });

  ws.on('error', (err) => {
    console.error(err);
    authClientList.removeSocket(ws);
  });

  ws.on('message', (data, isBinary) => {
    let json: BaseMessage;
    try {
      json = JSON.parse(data.toString('utf-8'));
    } catch(e) {
      return ws.send(JSON.stringify({
        type: 'error',
        error: 'UnknownJsonType'
      }));
    }

    //TODO: For message and message type, if they contain a receiverServer property, 
    //they should be relayed to the desired server or saved in the outgoing message table
    switch(json.type) {
      case 'message': {
        handleMessage(ws, json as Message, data);
        break;
      }
        
      case 'message-invite': {
        handleMessageInvite(ws, json as MessageInviteIncoming, data);
        break;
      }

      default:
        ws.send(JSON.stringify({
          type: 'error',
          error: 'UnknownJsonType'
        }));

    }
  });
  

}

function handleMessage(ws: WebSocket, json: Message, data: RawData) {
  let receiverSocket = authClientList.getSocketByMailboxId((json).receiverMailboxId);

  //if receiver of message is not online
  if(!receiverSocket) {
    //save message in the database for the receiver to grab when he goes online
    saveMessage(json).catch(e => {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'MessageSendError'
      }));
    });
    return;
  }

  //relay data back to client
  receiverSocket.ws.send(data);
}

function handleMessageInvite(ws: WebSocket, json: MessageInviteIncoming, data: RawData) {
  let receiverSocket = authClientList.getSocketByUsername((json).receiverUsername);
  if(!receiverSocket) {
    saveInvite(json).catch(e => {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'MessageInviteSendError'
      }));
    });
    return;
  }

  receiverSocket.ws.send(data);
}