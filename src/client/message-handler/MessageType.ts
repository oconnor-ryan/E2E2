

export interface StoredMessageBase {
  isVerified: boolean //was the message signed with the correct public key
  id: string,
  senderIdentityKeyPublic: string,
  messageDecrypted: boolean,
  payload: EncryptedMessageData | undefined //if the payload is encrypted, it will be a string
}

export interface BaseMessage {
  type: 'message' | 'message-invite' | 'queued-invites-and-messages' | 'error'
}

export interface ErrorMessage extends BaseMessage {
  type: 'error',
  error: string
}

export interface Message extends BaseMessage {
  type: 'message',
  id: string,
  dontSave?: boolean,
  receiverMailboxId: string,
  senderIdentityKeyPublic: string,
  encryptedPayload: string,
  receiverServer: string
}

export interface MessageInvite extends BaseMessage{
  type: 'message-invite',
  id: string
  receiverUsername: string,
  receiverServer: string 
  senderUsername: string,
  senderServer: string 
  encryptedPayload: string,

}

export interface EncryptedPayloadBase {
  signed_data: EncryptedMessageData | EncryptedMessageInvitePayload
  signature: string
}


export interface EncryptedMessageInvitePayload {
  mailboxId: string,
  comment: string,
  groupId: string | undefined
}

export interface QueuedMessagesAndInvitesObj extends BaseMessage {
  type: 'queued-invites-and-messages',
  messages: Message[],
  invites: MessageInvite[]
}


export interface EncryptedMessageData {
  type: 'text-message' 
    | 'file-link' 
    | 'call-request' 
    | 'call-accept' 
    | 'call-signaling'
    | 'accept-invite'
    | 'leave-group'
    | 'change-mailbox-id',
  
  groupId: string | undefined,
  data: any
}

export interface EncryptedRegularMessageData extends EncryptedMessageData {
  type: 'text-message',
  data: {
    message: string
  }
}

export interface EncryptedFileMessageData extends EncryptedMessageData {
  type: 'file-link',
  data: {
    message: string,
    fileUUID: string,
    accessToken: string,
    fileName: string,
    fileSignature: string,
    fileEncKey: string,
    remoteServerURL: string
  }
}

export interface EncryptedCallRequestMessageData extends EncryptedMessageData {
  type: 'call-request',
  data: undefined
}

export interface EncryptedCallAcceptMessageData extends EncryptedMessageData {
  type: 'call-accept',
  data: undefined
}

export interface EncryptedCallSignalingMessageData extends EncryptedMessageData {
  type: 'call-signaling',
  data: {
    sdp: RTCSessionDescription | undefined,
    ice: RTCIceCandidateInit | undefined,
  }
}

export interface EncryptedAcceptInviteMessageData extends EncryptedMessageData {
  type: 'accept-invite',
  data: {
    mailboxId: string,
  }
}

export interface EncryptedLeaveGroupMessageData extends EncryptedMessageData {
  type: 'leave-group',
  data: undefined
}

export interface EncryptedNewMailboxIdMessageData extends EncryptedMessageData {
  type: 'change-mailbox-id',
  data: {
    mailboxId: string
  }
}

