import { AesGcmKey, ECDHPublicKey, ECDSAKeyPair, ECDSAPrivateKey, ECDSAPublicKey } from "../encryption/encryption.js";
import { Database, LOCAL_STORAGE_HANDLER, getDatabase } from "../util/storage/StorageHandler.js";
import * as ObjStore from '../util/storage/ObjectStore.js';


export interface BaseMessage {
  type: 'message' | 'message-invite' | 'queued-invites-and-messages' | 'error'
}

export interface Message extends BaseMessage {
  type: 'message',
  id: string,
  dontSave: boolean,
  receiverMailboxId: string,
  senderIdentityKeyPublic: string,
  encryptedPayload: string,
  receiverServer: string
}

interface MessageInvite extends BaseMessage{
  type: 'message-invite',
  id: string
  receiverUsername: string,
  senderUsername: string,
  encryptedPayload: string,
}

export interface MessageInviteIncoming extends MessageInvite {
  senderServer: string 
}

export interface MessageInviteOutgoing extends MessageInvite {
  receiverServer: string 
}

export interface QueuedMessagesAndInvitesObj extends BaseMessage {
  type: 'queued-invites-and-messages',
  messages: Message[],
  invites: MessageInviteIncoming[]
}


interface EncryptedMessageData {
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

interface EncryptedRegularMessageData extends EncryptedMessageData {
  type: 'text-message',
  data: {
    message: string
  }
}

interface EncryptedFileMessageData extends EncryptedMessageData {
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

interface EncryptedCallRequestMessageData extends EncryptedMessageData {
  type: 'call-request',
  data: undefined
}

interface EncryptedCallAcceptMessageData extends EncryptedMessageData {
  type: 'call-accept',
  data: undefined
}

interface EncryptedCallSignalingMessageData extends EncryptedMessageData {
  type: 'call-signaling',
  data: {
    sdp: RTCSessionDescription | undefined,
    ice: RTCIceCandidateInit | undefined,
  }
}

interface EncryptedAcceptInviteMessageData extends EncryptedMessageData {
  type: 'accept-invite',
  data: {
    mailboxId: string,
  }
}

interface EncryptedLeaveGroupMessageData extends EncryptedMessageData {
  type: 'leave-group',
  data: undefined
}

interface EncryptedNewMailboxIdMessageData extends EncryptedMessageData {
  type: 'change-mailbox-id',
  data: {
    mailboxId: string
  }
}

function messageParseError(type: "not-json" | 'invalid-type' | 'wrong-type-format') {
  console.error(type);
}



async function parseMessage(data: Message, db: Database, updateLastMessageRead: boolean = true) {
  try {
    let sender = await db.knownUserStore.get(data.senderIdentityKeyPublic);
    if(!sender) {
      throw new Error("Unknown User sent this message!");
    }

    let decryptedData = await sender.currentEncryptionKey.decrypt(data.encryptedPayload);

    let json = JSON.parse(decryptedData) as ObjStore.MessageDataForSocket;

    //if signature is valud or not
    let isVerified = await sender.identityKeyPublic.verify(json.signature, JSON.stringify(json.signed_data))

    let messageData = json.signed_data as EncryptedMessageData;

    switch(messageData.type) {
      //voip related calls should never be stored on database and need something else to happen
      //add some callbacks here
      case 'call-request':
        break;
      case 'call-accept':
        break;
      case 'call-signaling':
        break;
      default:
        break;
    }

    //save the message in the database
    let messageToSave: ObjStore.Message = {
      senderId: data.senderIdentityKeyPublic,
      uuid: data.id,
      groupId: messageData.groupId ?? null,
      isVerified: isVerified,
      data: json
    };

    await db.messageStore.add(messageToSave);
    if(updateLastMessageRead) {
      await db.accountStore.setLastReadMessage(LOCAL_STORAGE_HANDLER.getUsername()!, data.id);
    }

  } catch(e) {
    console.error(e);
  }
}

async function parseMessageInvite(data: ObjStore.MessageRequest, db: Database, updateLastMessageRead: boolean = true) {
  try {

    await db.messageRequestStore.add(data);
    if(updateLastMessageRead) {
      await db.accountStore.setLastReadMessageInvite(LOCAL_STORAGE_HANDLER.getUsername()!, data.id);
    }

  } catch(e) {
    console.error(e);
  }
}

async function signAndEncryptData(data: any, encKey: AesGcmKey, signKey: ECDSAPrivateKey) {
  let dataAsString = JSON.stringify(data);

  let signature = signKey.sign(dataAsString, 'base64');
  let payload = {
    signature: signature,
    signed_data: data
  }

  return await encKey.encrypt(JSON.stringify(payload), 'base64');
}

class SocketMessageSender {
  private ws: WebSocket;
  private receivers: ObjStore.KnownUserEntry[];
  private myIdentityKeyPair: ECDSAKeyPair;
  private groupId: string | undefined;

  constructor(ws: WebSocket, receivers: ObjStore.KnownUserEntry[], myIdentityKeyPair: ECDSAKeyPair, groupId?: string) {
    this.ws = ws;
    this.receivers = receivers;
    this.myIdentityKeyPair = myIdentityKeyPair;
  }

  private async sendMessage(data: any, dontSaveIfOffline: boolean = false) {
    for(let receiver of this.receivers) {

      const outgoingData: Message = {
        id: window.crypto.randomUUID(),
        senderIdentityKeyPublic: await this.myIdentityKeyPair.publicKey.exportKey('base64'),
        receiverMailboxId: receiver.mailboxId,
        encryptedPayload: await signAndEncryptData(data, receiver.currentEncryptionKey, this.myIdentityKeyPair.privateKey),
        receiverServer: receiver.remoteServer,
        dontSave: dontSaveIfOffline,
        type: 'message' //this is the server type
      }

      this.ws.send(JSON.stringify(outgoingData));
    }
  }


  async sendRegularMessage(message: string) {
    let data: EncryptedRegularMessageData = {
      type: 'text-message',
      groupId: this.groupId,
      data: {
        message: message
      }
    };

    this.sendMessage(data);
  }

  async sendFileMessage(fileUUID: string, accessToken: string, fileName: string, fileSig: string, fileEncKey: AesGcmKey, message: string) {
    let protocol = window.isSecureContext ? "https://" : "http://";
    let url = `${protocol}${window.location.host}`;

    let data: EncryptedFileMessageData = {
      type: 'file-link',
      groupId: this.groupId,
      data: {
        fileUUID: fileUUID,
        accessToken: accessToken,
        fileName: fileName,
        fileSignature: fileSig,
        fileEncKey: await fileEncKey.extractKey(),
        remoteServerURL: url,
        message: message
      }
    }

    this.sendMessage(data);
  }

  async requestCall() {
    if(this.receivers.length != 1) {
      throw new Error("No Support for Calls with more than 2 people!");
    }

    let data: EncryptedCallRequestMessageData = {
      type: 'call-request',
      groupId: undefined,
      data: undefined
    }

    this.sendMessage(data, true)

  }

  async acceptCall() {
    if(this.receivers.length != 1) {
      throw new Error("No Support for Calls with more than 2 people!");
    }

    let data: EncryptedCallAcceptMessageData = {
      type: 'call-accept',
      groupId: undefined,
      data: undefined
    }
    this.sendMessage(data, true)
  }

  async callSignalingMessage(signalingData: RTCSessionDescription | RTCIceCandidateInit, type: 'ice' | 'sdp') {
    if(this.receivers.length != 1) {
      throw new Error("No Support for Calls with more than 2 people!");
    }

    let data: EncryptedCallSignalingMessageData = {
      type: 'call-signaling',
      groupId: undefined,
      data: {
        sdp: type === 'sdp' ? signalingData as RTCSessionDescription : undefined,
        ice: type === 'ice' ? signalingData as RTCIceCandidateInit : undefined,
      }
    };

    this.sendMessage(data, true);
  }

  async acceptInvite(mailboxId: string) {
    let data: EncryptedAcceptInviteMessageData = {
      type: 'accept-invite',
      groupId: this.groupId,
      data: {
        mailboxId: mailboxId
      }
    }
    this.sendMessage(data)
  }

  async leaveGroup() {
    let data: EncryptedLeaveGroupMessageData = {
      type: 'leave-group',
      groupId: this.groupId,
      data: undefined
    };
    this.sendMessage(data);
  }

  async changeMailboxId(mailboxId: string) {
    let data: EncryptedNewMailboxIdMessageData = {
      type: 'change-mailbox-id',
      groupId: this.groupId,
      data: {
        mailboxId: mailboxId,
      }
    }
    this.sendMessage(data);
  }
}

class SocketInviteSender {
  private ws: WebSocket;
  private receivers: ObjStore.KnownUserEntry[];
  private myIdentityKey: ECDSAPublicKey
;
  constructor(ws: WebSocket, receivers: ObjStore.KnownUserEntry[], myIdentityKey: ECDSAPublicKey) {
    this.ws = ws;
    this.receivers = receivers;
    this.myIdentityKey = myIdentityKey;
  }


  
}

async function socketMessageSenderBuilder(ws: WebSocket, id: string, type: 'individual-key' | 'groupId') {
  const db = await getDatabase();

  //get all known users I will be speaking to
  let receivers: ObjStore.KnownUserEntry[];
  if(type === 'individual-key') {
    receivers = [await db.knownUserStore.get(id)];
  } else {
    let memberIdKeyStrings = (await db.groupChatStore.get(id)).members;
    receivers = await Promise.all(memberIdKeyStrings.map(idKey => db.knownUserStore.get(idKey)));
  }

  let myIdKey = (await db.accountStore.get(LOCAL_STORAGE_HANDLER.getUsername()!)).identityKeyPair;

  return new SocketMessageSender(ws, receivers, myIdKey, type === 'groupId' ? id : undefined);
  
}


(async () => {
  let protocol = window.isSecureContext ? "wss://" : "ws://";
  const ws = new WebSocket(`${protocol}${window.location.host}?credential=${LOCAL_STORAGE_HANDLER.getWebSocketCred()}`);
  ws.binaryType = "arraybuffer"; //use this instead of Blob

  const db = await getDatabase();
  ws.onopen = (e) => {
    console.log("WebSocket connected!");
  };
  
  ws.onerror = (e) => {
    console.error("WebSocket got an error", e);
  };
  
  ws.onclose = (ev) => {
    console.log("WebSocket closed!");
  }
  
  ws.onmessage = (e) => {
    const rawData: string = e.data instanceof ArrayBuffer ? new TextDecoder().decode(e.data) : e.data;
  
    let data;
    try {
      data = JSON.parse(rawData) as BaseMessage;
    } catch(e) {
      return messageParseError('not-json');
    }
  
    switch(data.type) {
      case 'message': 
        parseMessage(data as Message, db);
        break;
      case 'message-invite':
        parseMessageInvite(data as MessageInviteIncoming, db);
        break;
      case 'queued-invites-and-messages': 
        let messages = (data as QueuedMessagesAndInvitesObj).messages;

        for(let message of messages) {
          parseMessage(message, db, false)
        }

        db.accountStore.setLastReadMessage(LOCAL_STORAGE_HANDLER.getUsername()!, messages[messages.length-1].id)
          .catch(e => console.error("Unable to save last read message", e));

        let messageInvites = (data as QueuedMessagesAndInvitesObj).invites;

        for(let invite of messageInvites) {
          parseMessageInvite(invite, db, false)
        }

        db.accountStore.setLastReadMessageInvite(LOCAL_STORAGE_HANDLER.getUsername()!, messageInvites[messageInvites.length-1].id)
          .catch(e => console.error("Unable to save last read message", e));
        

        break;
      case 'error':
        break;
      default:
        return messageParseError('invalid-type');
    }
  }
});







