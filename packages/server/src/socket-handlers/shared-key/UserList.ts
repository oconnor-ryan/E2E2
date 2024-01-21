import { WebSocket } from "ws";
import {randomUUID} from 'crypto';

export class UserList {
  private users: {[id: string]: {name: string, ws: WebSocket, pubKey: string}};
  private _sharedKeyGenerated = false;

  constructor() {
    this.users = {};
  }

  getRandomUserId() {
    let index = Math.round(Math.random() * (this.getNumUsers()-1));
    return Object.keys(this.users)[index];
  }

  getNumUsers() {
    return Object.keys(this.users).length;
  }

  sharedKeyHasBeenGenerated() {
    this._sharedKeyGenerated = true;
  }

  sharedKeyGenerated() {
    return this._sharedKeyGenerated;
  }

  getAllUsersClientExcept(excludeUser?: string | WebSocket) {
    let allUsers = Object.keys(this.users).map(id => {return {id: id, name: this.users[id].name, pubKey: this.users[id].pubKey}});
    if(!excludeUser) {
      return allUsers;
    }
  
    let exception: string;
    if(excludeUser instanceof WebSocket) {
      let socket = excludeUser as WebSocket;
      exception = this.getUserFromSocket(socket)!;
    } else {
      exception = excludeUser;
    }
  
    return allUsers.filter((val) => exception !== val.id);
  }

  getUserFromSocket(ws: WebSocket) : string | undefined{
    return Object.keys(this.users).find(id => ws === this.users[id].ws);
  }

  getAllUsersServer() {
    return this.users;
  }

  addUser(newUser: string, socket: WebSocket, pubKey: string){
    let id = randomUUID() as string;
    this.users[id] = {name: newUser, ws: socket, pubKey: pubKey};
    return id;
  }

  sendMessageTo(userId: string, data: any, isBinary: boolean) {
    this.users[userId].ws.send(JSON.stringify(data), {binary: isBinary});
  }

  removeUser(removedUser: string | WebSocket) {
    let user: string | undefined;
    if(removedUser instanceof WebSocket) {
      user = this.getUserFromSocket(removedUser);
    } else {
      user = removedUser;
    }

    if(!user) {
      return;
    }

    delete this.users[user];

    if(this.getNumUsers() == 0) {
      this._sharedKeyGenerated = false;
    }
  }
}