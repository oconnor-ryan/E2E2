import { WebSocket } from "ws";
import http from 'http';

import { verifyKey } from "src/server/util/webcrypto/ecdsa.js";
import { Room } from "./Room.js";
import { getIdentityKey, userInChat } from "src/server/util/database.js";

let rooms: Room[] = [];

export async function onConnection(ws: WebSocket, req: http.IncomingMessage, reqParams: URLSearchParams) {

  console.log(reqParams);

  //note that if value in Number function is null, Number returns 0
  //if value is undefined, it returns NaN.
  let chatId = Number(reqParams.get("chatId") ?? NaN);
  let userId = reqParams.get("userId");
  let signatureBase64 = reqParams.get("signatureBase64");
  let keyExchangeId = reqParams.get("keyExchangeId");


  if(Number.isNaN(chatId)) {
    ws.close(undefined, "You must specify room_id in WebSocket connection URL!");
    return;
  }

  if(!userId) {
    ws.close(undefined, "You must specify a user that exists!");
    return;
  }

  if(!signatureBase64) {
    ws.close(undefined, "You must provide a signature matching the userId!");
    return;
  }

  if(!keyExchangeId) {
    ws.close(undefined, "You must know the key exchange id to decrypt messages correctly!");
    return;
  }

  let pubKeyBase64 = await getIdentityKey(userId);
  if(!pubKeyBase64) {
    ws.close(undefined, "Unable to retrieve public signing key for user!");
    return;
  }

  if(!(await verifyKey(userId, signatureBase64, pubKeyBase64))) {
    ws.close(undefined, "Unable to verify signature!");
    return;
  }

  if(!(await userInChat(chatId, userId))) {
    ws.close(undefined, "You are not part of this chat room!");
    return;
  }

  ws.send(JSON.stringify({type: "server", message: "Successfully Connected to WebSocket!"}));


  let room = rooms[chatId];
  if(!room) {
    rooms[chatId] = new Room(chatId);
    room = rooms[chatId];
  }


  ws.on('error', console.error);

  ws.on('close', (code, reason) => {
    console.log(`WebSocket was closed with code ${code} and reason: ${reason.toString('utf-8')}`);

    room.removeUser(ws);
  });

  ws.on('message', (data, isBinary) => {
    console.log(`recieved ${data}`);
    
    room.sendMessage(data as ArrayBuffer, ws);

  });
}