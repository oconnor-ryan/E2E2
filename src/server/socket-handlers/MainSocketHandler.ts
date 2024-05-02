import {RawData, WebSocket} from 'ws';
import {IncomingMessage} from 'http';
import { AccountIdentityWebSocket, BaseMessage, getIncomingMessages, getIncomingKeyExchangeRequests, KeyExchangeRequestIncoming, Message, saveMessage, saveKeyExchangeRequest, checkIfUserPasswordCorrect, getUserIdentityForWebSocket, KeyExchangeRequestOutgoing, MessageCall } from '../util/database-handler.js';
import { getUsernameAndPasswordFromWebSocketQuery } from '../util/auth-parser.js';

interface AuthenticatedSocket {
  ws: WebSocket,
  acc: AccountIdentityWebSocket
}

interface QueuedOfflineMessagesRequest extends BaseMessage{
  type: 'queued-offline-messages',
  lastReadMessageUUID: string | undefined,
  lastReadExchangeUUID: string | undefined
}

interface CallInfoRequest extends BaseMessage {
  type: 'get-call-info-of-users',
  users: string[]
}


class WebSocketConnectionList {
  private clients: AuthenticatedSocket[];

  constructor() {
    this.clients = [];
  }

  getCallInfoOfUsers(userMakingRequest: string, requestedCallees: string[]) {
    let requestorsIndex = this.clients.findIndex(u => u.acc.username === userMakingRequest);
    if(!requestorsIndex) {
      return [];
    }

    let requestedUsers = this.clients.filter(c => requestedCallees.includes(c.acc.username))

    let users = requestedUsers.map((c, index) => {
      return {
        username: c.acc.username,
        identityKeyPublicString: c.acc.identityKeyPublic,
        bePolite: requestorsIndex < index //the requestor must be polite if they connected to WebSocket before the callee
      }
    });

    return users;
  }

  getPolitenessOfCallee(caller: string, callee: string) {
    let callerIndex = this.clients.findIndex(u => u.acc.username === caller);
    let calleeIndex = this.clients.findIndex(u => u.acc.username === callee);

    return callerIndex > calleeIndex; //the callee must be polite if they connected to WebSocket before the caller


  }

  addSocket(authSocket: AuthenticatedSocket) : boolean {
    if(this.clients.find(a => a.acc.username === authSocket.acc.username)) {
      return false;
    }
    this.clients.push(authSocket);
    return true;
  }

  //called when a websocket is closed
  removeSocket(ws: WebSocket) {
    let authSocketIndex = this.clients.findIndex((val) => ws === val.ws);
    if(authSocketIndex === -1) {
      return;
    }
    console.log("socket removed");
    this.clients.splice(authSocketIndex, 1);
  }

  getSocketByMailboxId(mailboxId: string) {
    return this.clients.find((val) => mailboxId === val.acc.mailboxId);
  }

  getSocketByUsername(username: string) {
    return this.clients.find((val) => username === val.acc.username);
  }

  getSocketByIdentityKey(identityKey: string) {
    return this.clients.find((val) => identityKey === val.acc.identityKeyPublic);
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
  const SERVER_HOST = req.headers.host!;

  let searchParams = new URL(req.url!, 'ws://' + req.headers.host).searchParams;

  let {username, password} = getUsernameAndPasswordFromWebSocketQuery(searchParams.get('credential') as string);

  let isCorrect = await checkIfUserPasswordCorrect(username, password);
  if(!isCorrect) {
    return ws.close();
  }

  let client = (await getUserIdentityForWebSocket(username))!;

  //to avoid a clients browser from trying to insert duplicate data in IndexedDB
  //when multiple tabs are open, force only one WebSocket connection per account
  if(!authClientList.addSocket({ws: ws, acc: client})) {

    ws.send(JSON.stringify({type: 'error', error: "You cannot make multiple WebSocket connections with the same account!"}));

    return ws.close(undefined, 'You cannot establish multiple websocket connections per account!');
  }


  ws.on('close', (code, reason) => {
    console.log('close event');
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
        handleMessage(ws, json as Message, data, SERVER_HOST);
        break;
      }

      case 'call': 
        handleMessageCall(ws, client, json as Message);
        break;
      case 'key-exchange-request': {
        handleKeyExchangeRequest(ws, json as KeyExchangeRequestIncoming, data, SERVER_HOST);
        break;
      }

      case 'queued-offline-messages': 
        handleQueuedOfflineMessagesRequest(ws, json as QueuedOfflineMessagesRequest, client);
        break;

      case 'get-call-info-of-users':
        handleCallInfoRequest(ws, client.username, json as CallInfoRequest);
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          error: 'UnknownJsonType'
        }));

    }
  });
  

}

function handleMessage(ws: WebSocket, json: Message, data: RawData, senderHost: string) {
  let receiverSocket = authClientList.getSocketByMailboxId((json).receiverMailboxId);

  //if receiver of message is not online
  if(!receiverSocket) {
    //remove receiver server so that this message is sent to local user
    if(json.receiverServer === senderHost) {
      json.receiverServer = "";
    }
    //save message in the database for the receiver to grab when he goes online
    saveMessage(json).catch(e => {
      console.error(e);
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

function handleMessageCall(ws: WebSocket, client: AccountIdentityWebSocket, json: Message) {
  let receiverSocket = authClientList.getSocketByMailboxId((json).receiverMailboxId);

  //if receiver of message is not online
  if(!receiverSocket) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Callee Not Online'
    }));
    return;
  }

  let res: MessageCall = {
    senderIdentityKeyPublic: json.senderIdentityKeyPublic,
    receiverMailboxId: json.receiverMailboxId,
    receiverServer: json.receiverServer,
    encryptedPayload: json.encryptedPayload,
    bePolite: authClientList.getPolitenessOfCallee(client.username, receiverSocket.acc.username),
    id: json.id,
    type: 'call'

  };

  //relay data back to client
  receiverSocket.ws.send(JSON.stringify(res));
}

function handleKeyExchangeRequest(ws: WebSocket, json: KeyExchangeRequestIncoming | KeyExchangeRequestOutgoing, data: RawData, senderHost: string) {
  let receiverSocket = authClientList.getSocketByUsername((json).receiverUsername);
  if(!receiverSocket) {
    //remove receiver server so that this exchange is sent to local user
    if((json as KeyExchangeRequestOutgoing).receiverServer === senderHost) {
      (json as KeyExchangeRequestOutgoing).receiverServer = "";
    }
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

function handleQueuedOfflineMessagesRequest(ws: WebSocket, json: QueuedOfflineMessagesRequest, client: AccountIdentityWebSocket) {
  //get pending messages and invites and send them to user
  Promise.all([getIncomingKeyExchangeRequests(client.username, json.lastReadExchangeUUID), getIncomingMessages(client.mailboxId, json.lastReadMessageUUID)])
   .then(result => {
    const [invites, messages] : [KeyExchangeRequestIncoming[], Message[]] = result;
    let response = {
      type: 'queued-offline-messages',
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
}

function handleCallInfoRequest(ws: WebSocket, requestor: string, json: CallInfoRequest) {
  ws.send(JSON.stringify({
    type: 'get-call-info-of-users',
    users: authClientList.getCallInfoOfUsers(requestor, json.users)
  }));
}