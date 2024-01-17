import { ActiveUserListServer, EncryptedMessage } from "./types.js";
import { WebSocket } from "ws";

export class UserList {
  private users: ActiveUserListServer;

  constructor() {
    this.users = {};
  }

  getAllUsers(excludeUser?: string | WebSocket) {
    let allUsers = Object.keys(this.users).map(user => {return {user: user, pubKey: this.users[user].pubKey}});
    if(!excludeUser) {
      return allUsers;
    }
  
    let exception: string;
    if(excludeUser instanceof WebSocket) {
      let socket = excludeUser as WebSocket;
      exception = Object.keys(this.users).find(user => socket === this.users[user].socket)!;
    } else {
      exception = excludeUser;
    }
  
    return allUsers.filter((val) => exception !== val.user);
  }

  addUser(newUser: string, socket: WebSocket, pubKey: string) {
    this.users[newUser] = {socket: socket, pubKey: pubKey};
  }

  sendMessageTo(data: EncryptedMessage, isBinary: boolean) {
    this.users[data.toUser].socket.send(JSON.stringify(data), {binary: isBinary});
  }
}