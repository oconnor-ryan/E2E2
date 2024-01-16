import { WebSocket } from "ws";

export interface ActiveUserListServer {
  [user: string] : {
    socket: WebSocket, 
    pubKey: string
  } 
};


export interface EncryptedMessage {
  fromUser: string,
  toUser: string,
  data: string, //base64 encoded encrypted string
  type: "message"
}

export interface UpdateUserMessage {
  allUsers: {user: string, pubKey: string}[],
  type: "update-users"
}

export interface NewUserMessage {
  newUser: string,
  pubKey: string, //base64 encoded string
  type: "new-user"
}

export interface ServerMessage {
  user: "Server",
  data: string,
  type: "server"
}