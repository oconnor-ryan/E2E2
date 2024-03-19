import { storeMessage } from "../../util/database.js";
import { WebSocket } from "ws";

export class Room {
  private chatId: number;
  private onlineMemberList: {ws: WebSocket, keyExchangeId: number}[];

  constructor(chatId: number) {
    this.chatId = chatId;
    this.onlineMemberList = [];
  }

  getUser(ws: WebSocket) {
    return this.onlineMemberList.find((val) => val.ws === ws);
  }

  addUser(ws: WebSocket, keyExchangeId: number) {
    this.onlineMemberList.push({ws: ws, keyExchangeId: keyExchangeId});
  }

  removeUser(socket: WebSocket) {
    let userIndex = this.onlineMemberList.findIndex((val) => val.ws === socket);
    if(userIndex >= 0) {
      this.onlineMemberList.splice(userIndex, 1);
    }
  }

  sendMessage(data: ArrayBuffer, sender: WebSocket) {
    const senderData = this.getUser(sender);
    if(!senderData) {
      console.log("User not found!");
      this.removeUser(sender);
      return;
    }

    let dataBase64 = Buffer.from(data).toString('base64');

    //store encrypted message in database for other users.
    //Make sure this does not block main thread by avoiding "await"
    storeMessage(dataBase64, this.chatId, senderData.keyExchangeId).then((val) => {
      if(val) {
        console.log("Message saved!")
      } else {
        console.warn("Message failed to save!")
      }
    }).catch(e => {
      console.error(e);
    });

    for(let member of this.onlineMemberList) {
      if(sender !== member.ws) {
        member.ws.send(data, {binary: true});
      }
    }
    
  }
}