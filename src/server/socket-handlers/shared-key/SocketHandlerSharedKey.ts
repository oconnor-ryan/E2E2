import { WebSocket } from "ws";
import http from 'http';

import {UserList} from './UserList.js';

const userList = new UserList();

export function onConnection(ws: WebSocket, req: http.IncomingMessage, reqParams: URLSearchParams) {
  ws.send(JSON.stringify({type: "server", message: "Successfully Connected to WebSocket!"}));

  console.log(reqParams);

  //tell client to generate a shared key
  if(userList.getNumUsers() == 0) {
    ws.send(JSON.stringify({type: "share-key-generate"}));
  } else {
   
  }


  ws.on('error', console.error);

  ws.on('close', (code, reason) => {
    console.log(`WebSocket was closed with code ${code} and reason: ${reason.toString('utf-8')}`);
    userList.removeUser(ws);
  });

  ws.on('message', (data, isBinary) => {
    console.log(`recieved ${data}`);
    let parsedData = JSON.parse(data.toString('utf-8'));
    parseSocketMessage(parsedData, ws, isBinary);

  });
}

function parseSocketMessage(parsedData: any, ws: WebSocket, isBinary: boolean) {
  if(!userList.sharedKeyGenerated()) {
    switch(parsedData.type) {
      case "share-key-generate":
        userList.sharedKeyHasBeenGenerated();
        newUserAdded(parsedData, ws, isBinary);
        break;
    }
    //prevent all other communication if shared key has not generated
    return;
  }

  switch(parsedData.type) {
    case "new-user":
      newUserAdded(parsedData, ws, isBinary);
      break;
    case "share-key-response":
      shareKey(parsedData, isBinary);
      break;
    case "message":
      sendMessage(parsedData, ws, isBinary);
      break;
    default:
      ws.send(JSON.stringify({type: "server", message: `Socket message of type ${parsedData.type} is not supported!`}));
    
  }
}

function newUserAdded(parsedData: {name: string, pubKey: string}, ws: WebSocket, isBinary: boolean) {

  let randomUserId = userList.getRandomUserId();
  let newUserId = userList.addUser(parsedData.name, ws, parsedData.pubKey);

  //request a shared key from a randomly selected user already in the chat
  if(userList.getNumUsers() > 1) {
    userList.sendMessageTo(randomUserId, {type: 'share-key-request', userId: newUserId, pubKey: parsedData.pubKey}, isBinary);
  }

}

function shareKey(parsedData: {userId: string, encSharedKey: string}, isBinary: boolean) {
  userList.sendMessageTo(parsedData.userId, {type: "share-key-response", encSharedKey: parsedData.encSharedKey}, isBinary);
}

function sendMessage(parsedData: {senderId: string, senderName: string, encMessage: string}, senderWS: WebSocket, isBinary: boolean) {
  let users = userList.getAllUsersServer();
  for(let [userId, {name, ws, pubKey}] of Object.entries(users)) {
    if(ws !== senderWS) {
      userList.sendMessageTo(userId, parsedData, isBinary);
    }
  }
}