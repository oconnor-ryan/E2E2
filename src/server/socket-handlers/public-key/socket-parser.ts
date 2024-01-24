import { WebSocket } from "ws";
import { UserList } from "./UserList.js";
import { EncryptedMessage } from "./types.js";


export function parseSocketMessage(data: any, ws: WebSocket, isBinary: boolean, userList: UserList) {
  switch(data.type) {
    case "new-user": 
      addNewUser(data.newUser, ws, data.pubKey, userList, isBinary);
      break;
    case "message":
      sendMessageToUser(data, isBinary, userList);
      break;

  }
}

function addNewUser(newUser: string, ws: WebSocket, pubKey: string, userList: UserList, isBinary: boolean) {

  userList.addUser(newUser, ws, pubKey);
  
  //send message to all connected clients except original client
  //about new user
  for(let [otherUser, {socket, pubKey}] of Object.entries(userList.getAllUsersServer())) {
    if(socket !== ws && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({allUsers: userList.getAllUsersClientExcept(otherUser), type: "update-users"}), {binary: isBinary});
    }
  }
}

function sendMessageToUser(data: EncryptedMessage, isBinary: boolean, userList: UserList) {
  userList.sendMessageTo(data, isBinary);
}