import { ActiveUserListServer, EncryptedMessage } from "./types.js";
import { WebSocket } from "ws";

export class UserList {
  private users: ActiveUserListServer;

  constructor() {
    this.users = {};
  }

  getAllUsersClientExcept(excludeUser?: string | WebSocket) {
    let allUsers = Object.keys(this.users).map(user => {return {user: user, pubKey: this.users[user].pubKey}});
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
  
    return allUsers.filter((val) => exception !== val.user);
  }

  getUserFromSocket(ws: WebSocket) : string | undefined{
    return Object.keys(this.users).find(user => ws === this.users[user].socket);
  }

  getAllUsersServer() {
    return this.users;
  }

  addUser(newUser: string, socket: WebSocket, pubKey: string) {
    this.users[newUser] = {socket: socket, pubKey: pubKey};
  }

  sendMessageTo(data: EncryptedMessage, isBinary: boolean) {
    this.users[data.toUser].socket.send(JSON.stringify(data), {binary: isBinary});
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
  }
}