import { Message } from "./database-handler.js"

//sent by a client of a server OR received by a server from another server
export interface MessageFromClient extends Message {
  dontSave: boolean | undefined,
}

//server is forwarding MessageIncoming message from their client to another server
export interface MessageToServer extends MessageFromClient {
  receiverServer: string //cast from string | undefined to string
}

export interface ClientMessageInvite {
  senderIdentityKey: string,
  receiverUsername: string,
  receiverServer: string | undefined,
  encrypted_data: string
}

