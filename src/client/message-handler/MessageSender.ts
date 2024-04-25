import { AesGcmKey, ECDSAKeyPair, ECDSAPrivateKey } from "../encryption/encryption.js";
import { Database } from "../storage/Database.js";
import { KnownUserEntry } from "../storage/ObjectStore.js";
import { LOCAL_STORAGE_HANDLER } from "../storage/StorageHandler.js";
import { EncryptedAcceptInviteMessageData, EncryptedCallAcceptMessageData, EncryptedCallRequestMessageData, EncryptedCallSignalingMessageData, EncryptedFileMessageData, EncryptedLeaveGroupMessageData, EncryptedMessageInvitePayload, EncryptedNewMailboxIdMessageData, EncryptedRegularMessageData, Message, MessageInvite } from "./MessageType.js";

export async function signAndEncryptData(data: any, encKey: AesGcmKey, signKey: ECDSAPrivateKey) {
  let dataAsString = JSON.stringify(data);

  let signature = signKey.sign(dataAsString, 'base64');
  let payload = {
    signature: signature,
    signed_data: data
  }

  return await encKey.encrypt(JSON.stringify(payload), 'base64');
}

export class SocketMessageSender {
  private ws: WebSocket;
  private receivers: KnownUserEntry[];
  private myIdentityKeyPair: ECDSAKeyPair;
  private groupId: string | undefined;

  constructor(ws: WebSocket, receivers: KnownUserEntry[], myIdentityKeyPair: ECDSAKeyPair, groupId?: string) {
    this.ws = ws;
    this.receivers = receivers;
    this.myIdentityKeyPair = myIdentityKeyPair;
    this.groupId = groupId;
  }

  private async sendMessage(data: any, dontSaveIfOffline: boolean = false) {
    for(let receiver of this.receivers) {

      const outgoingData: Message = {
        id: window.crypto.randomUUID(),
        senderIdentityKeyPublic: await this.myIdentityKeyPair.publicKey.exportKey('base64'),
        receiverMailboxId: receiver.mailboxId ?? "", //if sending empty string, this request WILL fail
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

export class SocketInviteSender {
  private ws: WebSocket;
  private myIdentityKeyPair: ECDSAKeyPair
  private myUsername: string;
;
  constructor(ws: WebSocket, myIdentityKeyPair: ECDSAKeyPair, myUsername: string) {
    this.ws = ws;
    this.myUsername = myUsername;
    this.myIdentityKeyPair = myIdentityKeyPair;
  }

  async sendInvite(receiverUsername: string, receiverServer: string = "", invitePayload: EncryptedMessageInvitePayload, encKey: AesGcmKey) {
    let encryptedPayload = await signAndEncryptData(invitePayload, encKey, this.myIdentityKeyPair.privateKey)
    let data: MessageInvite = {
      receiverUsername: receiverUsername,
      receiverServer: receiverServer,
      senderUsername: this.myUsername,
      senderServer: window.location.host,
      encryptedPayload: encryptedPayload,
      id: window.crypto.randomUUID(),
      type: 'message-invite'
    };

    this.ws.send(JSON.stringify(data));
  }

  async sendGroupInvite(receivers: {receiverUsername: string, receiverServer: string, encKey: AesGcmKey}[], invitePayload: EncryptedMessageInvitePayload) {
    return Promise.all(receivers.map(r => this.sendInvite(r.receiverUsername, r.receiverServer, invitePayload, r.encKey)))
  }
}



export async function socketInviteSenderBuilder(ws: WebSocket, db: Database) {

  let myIdKey = (await db.accountStore.get(LOCAL_STORAGE_HANDLER.getUsername()!)).identityKeyPair;

  return new SocketInviteSender(ws, myIdKey, LOCAL_STORAGE_HANDLER.getUsername()!);
}