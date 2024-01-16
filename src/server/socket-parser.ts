import { WebSocketServer, WebSocket } from "ws";
import { UserList } from "./UserList.js";
import { EncryptedMessage } from "./types.js";


export function parseSocketMessage(data: any, ws: WebSocket, wss: WebSocketServer, isBinary: boolean, userList: UserList) {
  switch(data.type) {
    case "new-user": 
      addNewUser(data.newUser, ws, data.pubKey, wss, userList, isBinary);
      break;
    case "message":
      sendMessageToUser(data, isBinary, userList);
      break;

  }
}

function addNewUser(newUser: string, ws: WebSocket, pubKey: string, wss: WebSocketServer, userList: UserList, isBinary: boolean) {

  userList.addUser(newUser, ws, pubKey);
  //send message to all connected clients except original client
  //about new user
  wss.clients.forEach((client) => {
    if(client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({allUsers: userList.getAllUsers(client), type: "update-users"}), {binary: isBinary});
    }
  });
}

function sendMessageToUser(data: EncryptedMessage, isBinary: boolean, userList: UserList) {
  userList.sendMessageTo(data, isBinary);
}