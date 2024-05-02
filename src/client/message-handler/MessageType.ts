import { AesGcmKey } from "../encryption/encryption.js"


export interface StoredMessageBase {
  isVerified: boolean //was the message signed with the correct public key
  id: string,
  senderIdentityKeyPublic: string,
  messageDecrypted: boolean,
  groupId: string | undefined,
  oneToOneChatId: string | undefined,
  payload: EncryptedMessageData 
}

export interface StoredMessageCallBase extends StoredMessageBase {
  bePolite: boolean
}

export interface BaseMessage {
  type: 'message' | 'call' | 'key-exchange-request' | 'queued-offline-messages' | 'get-call-info-of-users' | 'error'
}

export interface ErrorMessage extends BaseMessage {
  type: 'error',
  error: string
}

export interface CalleeInfoRequest extends BaseMessage {
  type: 'get-call-info-of-users',
  users: string[]
}

export interface CalleeInfoResponse extends BaseMessage {
  type: 'get-call-info-of-users',
  users: {
    username: string;
    identityKeyPublicString: string;
    bePolite: boolean;
  }[]
}

export interface Message extends BaseMessage {
  type: 'message' | 'call',
  id: string,
  dontSave?: boolean,
  receiverMailboxId: string,
  senderIdentityKeyPublic: string,
  encryptedPayload: string,
  receiverServer: string
}

export interface CallMessage extends Message {
  type: 'call',
  bePolite: boolean
}

export interface StoredKeyExchangeRequest {
  id: string
  senderUsername: string,
  senderServer: string,
  derivedEncryptionKey: AesGcmKey,
  payload: EncryptedKeyExchangeRequestPayload
}

export interface StoredKeyExchangeRequestRaw {
  id: string
  senderUsername: string,
  senderServer: string,
  derivedEncryptionKey: CryptoKey,
  payload: EncryptedKeyExchangeRequestPayload
}

export interface KeyExchangeRequest extends BaseMessage{
  type: 'key-exchange-request',
  id: string
  receiverUsername: string,
  receiverServer: string 
  senderUsername: string,
  senderServer: string,
  encryptedPayload: string,
  ephemeralKeyPublic: string,
  ephemeralSalt: string

}

export interface QueuedOfflineMessagesRequest extends BaseMessage {
  type: 'queued-offline-messages',
  lastReadMessageUUID: string | undefined,
  lastReadExchangeUUID: string | undefined
}

export interface EncryptedPayloadBase {
  signed_data: EncryptedMessageData | EncryptedKeyExchangeRequestPayload
  signature: string
}

export interface EncryptedKeyExchangeRequestPayload {
  type: 'one-to-one-invite' | 'group-key-exchange',
  mailboxId: string,
  comment: string,
  groupId: string | undefined
}


export interface QueuedMessagesAndInvitesObj extends BaseMessage {
  type: 'queued-offline-messages',
  messages: Message[],
  exchanges: KeyExchangeRequest[]
}


export interface EncryptedMessageData {
  type: 'text-message' 
    | 'file-link' 
    | 'call-request' 
    | 'call-accept' 
    | 'call-signaling'
    | 'accept-invite'
    | 'group-invite'
    | 'join-group'
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

//for group invites, the group owner can only invite KnownUsers. This is similar
//to Discord where you can only invite friends in group DMs 
export interface EncryptedMessageGroupInvitePayload extends EncryptedMessageData {
  type: 'group-invite';
  groupId: string,
  data: {
    members: {
      identityKeyPublicString: string,
      server: string,
      username: string,
    }[]
  }
}

export interface EncryptedMessageJoinGroupPayload extends EncryptedMessageData {
  type: 'join-group';
  groupId: string
  data: {
    mailboxId: string
  }
}

export interface EncryptedLeaveGroupMessageData extends EncryptedMessageData {
  type: 'leave-group',
  groupId: string
  data: undefined
}

export interface EncryptedNewMailboxIdMessageData extends EncryptedMessageData {
  type: 'change-mailbox-id',
  data: {
    mailboxId: string
  }
}

