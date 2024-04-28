import {RawData, WebSocket} from 'ws';
import {IncomingMessage} from 'http';
import { AccountIdentityWebSocket, BaseMessage, getIncomingMessages, getIncomingKeyExchangeRequests, KeyExchangeRequestIncoming, Message, saveMessage, saveKeyExchangeRequest, checkIfUserPasswordCorrect, getUserIdentityForWebSocket } from '../util/database-handler.js';
import { getUsernameAndPasswordFromWebSocketQuery } from '../util/auth-parser.js';

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
    if(this.clients.find(a => a.acc.username === authSocket.acc.username)) {
      return;
    }
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
    return this.clients.find((val) => username === val.acc.username);
  }

  getSocketByIdentityKey(identityKey: string) {
    return this.clients.find((val) => {identityKey === val.acc.identityKeyPublic});
  }

  toString() {
    return this.clients.map(c => c.acc.username).toString();
  }
}

const authClientList = new WebSocketConnectionList();

export function getAuthSocketList() : Readonly<WebSocketConnectionList> {
  return authClientList;
}

//at this point, the user has already been authenticated
export async function onConnection(ws: WebSocket, req: IncomingMessage) {
  let searchParams = new URL(req.url!, 'ws://' + req.headers.host).searchParams;

  let {username, password} = getUsernameAndPasswordFromWebSocketQuery(searchParams.get('credential') as string);

  let isCorrect = await checkIfUserPasswordCorrect(username, password);
  if(!isCorrect) {
    ws.close();
  }

  let client = (await getUserIdentityForWebSocket(username))!;

  authClientList.addSocket({ws: ws, acc: client});

  let lastReadMessageUUID = searchParams.get('lastReadMessageUUID') ?? undefined;
  let lastReadKeyExchangeUUID = searchParams.get('lastReadKeyExchangeUUID') ?? undefined;


  //get pending messages and invites and send them to user
  Promise.all([getIncomingKeyExchangeRequests(client.username), getIncomingMessages(client.mailboxId, lastReadMessageUUID)])
   .then(result => {
    const [invites, messages] : [KeyExchangeRequestIncoming[], Message[]] = result;
    let response = {
      type: 'queued-exchanges-and-messages',
      exchanges: invites,
      messages: messages
    };

    ws.send(JSON.stringify(response));
   })
   .catch(e => {
    console.error(e);
    ws.send(JSON.stringify({
      type: 'error',
      error: "CannotGetQueuedMessagesAndExchanges"
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
    console.log('Message received!');
    console.log(authClientList.toString());
    let json: BaseMessage;
    try {
      json = JSON.parse(data.toString('utf-8'));
    } catch(e) {
      return ws.send(JSON.stringify({
        type: 'error',
        error: 'UnknownJsonType'
      }));
    }

    console.log(json);

    //TODO: For message and message type, if they contain a receiverServer property, 
    //they should be relayed to the desired server or saved in the outgoing message table
    switch(json.type) {
      case 'message': {
        handleMessage(ws, json as Message, data);
        break;
      }
        
      case 'key-exchange-request': {
        handleKeyExchangeRequest(ws, json as KeyExchangeRequestIncoming, data);
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

function handleKeyExchangeRequest(ws: WebSocket, json: KeyExchangeRequestIncoming, data: RawData) {
  let receiverSocket = authClientList.getSocketByUsername((json).receiverUsername);
  if(!receiverSocket) {
    saveKeyExchangeRequest(json).catch(e => {
      console.error(e);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'KeyExchangeRequestSendError'
      }));
    });
    return;
  }

  receiverSocket.ws.send(data);
}