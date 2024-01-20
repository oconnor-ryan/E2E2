import { WebSocket } from "ws";
import http from 'http';

import { UserList } from "./UserList.js";
import { parseSocketMessage } from "./socket-parser.js";

const userList = new UserList();

export function onConnection(ws: WebSocket, req: http.IncomingMessage) {
  ws.send(JSON.stringify({type: "server", user: "Server", data: 'WebSocket Connection Successful!'}));

  //let newly connected user know about all users in chat
  //before their name is processed
  ws.send(JSON.stringify({type: "update-users", allUsers: userList.getAllUsersClientExcept()}));

  ws.on('error', console.error);

  ws.on('close', (code, reason) => {
    console.log(`WebSocket was closed with code ${code} and reason: ${reason.toString('utf-8')}`);
    userList.removeUser(ws);
  });

  ws.on('message', (data, isBinary) => {
    console.log(`recieved ${data}`);
    let parsedData = JSON.parse(data.toString('utf-8'));
    parseSocketMessage(parsedData, ws, isBinary, userList);

  });
}