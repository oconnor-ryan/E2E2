import { WebSocket } from "ws";
import http from 'http';

import { verifyKey } from "../../util/webcrypto/ecdsa.js";
import { Room } from "./Room.js";
import { getIdentityKey, userInChat } from "../../util/database.js";

let rooms: Room[] = [];

export async function onConnection(ws: WebSocket, req: http.IncomingMessage, reqParams: URLSearchParams) {

  console.log(reqParams);

  //note that if value in Number function is null, Number returns 0
  //if value is undefined, it returns NaN.
  let chatId = Number(reqParams.get("chatId") ?? NaN);
  let userId = reqParams.get("userId");
  let signatureBase64URL = reqParams.get("signatureBase64URL");
  let keyExchangeId = reqParams.get("keyExchangeId");


  if(Number.isNaN(chatId)) {
    ws.close(undefined, "You must specify room_id in WebSocket connection URL!");
    return;
  }

  if(!userId) {
    ws.close(undefined, "You must specify a user that exists!");
    return;
  }

  if(!signatureBase64URL) {
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

  let sigBase64 = Buffer.from(signatureBase64URL, 'base64url').toString('base64');

  if(!(await verifyKey(userId, sigBase64, pubKeyBase64))) {
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

  room.addUser(userId, ws, Number(keyExchangeId));

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