import { sendMessage } from "src/server/util/database.js";
import { WebSocket } from "ws";

export class Room {
  private chatId: number;
  private onlineMemberList: {id: string, ws: WebSocket, keyExchangeId: number}[];

  constructor(chatId: number) {
    this.chatId = chatId;
    this.onlineMemberList = [];
  }

  get onlineMembers() : Readonly<string[]>{
    return this.onlineMemberList.map((val) => val.id);
  };

  getUser(ws: WebSocket) {
    return this.onlineMemberList.find((val) => val.ws === ws);
  }

  addUser(id: string, ws: WebSocket, keyExchangeId: number) {
    this.onlineMemberList.push({id: id, ws: ws, keyExchangeId: keyExchangeId});
  }

  removeUser(userIdOrSocket: string | WebSocket) {
    let userIndex: number;
    if(userIdOrSocket instanceof WebSocket) {
      userIndex = this.onlineMemberList.findIndex((val) => val.ws === userIdOrSocket)
    } else {
      userIndex = this.onlineMemberList.findIndex((val) => val.id === userIdOrSocket)
    }
    this.onlineMemberList.splice(userIndex, 1);
  }

  sendMessage(data: ArrayBuffer, sender: WebSocket) {
    const senderData = this.getUser(sender);
    if(!senderData) {
      this.removeUser(sender);
      return;
    }

    let dataBase64 = Buffer.from(data).toString('base64');

    //store encrypted message in database for other users.
    //Make sure this does not block main thread by avoiding "await"
    sendMessage(senderData.id, dataBase64, this.chatId, senderData.keyExchangeId);

    //send encrypted message to all online users
    for(let member of this.onlineMemberList) {
      member.ws.send(data, {binary: true});
    }
    
  }
}