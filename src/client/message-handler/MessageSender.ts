import { AesGcmKey, ECDHPublicKey, ECDSAKeyPair, ECDSAPrivateKey } from "../encryption/encryption.js";
import { Database } from "../storage/Database.js";
import { GroupChatEntry, KnownUserEntry } from "../storage/ObjectStore.js";
import { LOCAL_STORAGE_HANDLER } from "../storage/StorageHandler.js";
import { arrayBufferToBase64 } from "../util/Base64.js";
import { EncryptedAcceptInviteMessageData, EncryptedCallAcceptMessageData, EncryptedCallRequestMessageData, EncryptedCallSignalingMessageData, EncryptedFileMessageData, EncryptedLeaveGroupMessageData, EncryptedMessageGroupInvitePayload, EncryptedKeyExchangeRequestPayload, EncryptedMessageJoinGroupPayload, EncryptedNewMailboxIdMessageData, EncryptedRegularMessageData, Message, KeyExchangeRequest, StoredMessageBase } from "./MessageType.js";

export async function signAndEncryptData(data: any, encKey: AesGcmKey, signKey: ECDSAPrivateKey) {
  let dataAsString = JSON.stringify(data);

  console.log(dataAsString);
  let signature = await signKey.sign(dataAsString, 'base64');
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
  private myMailboxId: string;
  private groupId: string | undefined;

  constructor(ws: WebSocket, receivers: KnownUserEntry[], myIdentityKeyPair: ECDSAKeyPair, myMailboxId: string, groupId?: string) {
    this.ws = ws;
    this.receivers = receivers;
    this.myMailboxId = myMailboxId;
    this.myIdentityKeyPair = myIdentityKeyPair;
    this.groupId = groupId;
  }

  public getReceivers() : Readonly<KnownUserEntry[]> {
    return this.receivers;
  }

  public addReceiver(receiver: KnownUserEntry) {
    this.receivers.push(receiver);
  }

  public removeReceiver(receiver: KnownUserEntry) {
    let index = this.receivers.findIndex(r => r.identityKeyPublicString === receiver.identityKeyPublicString);
    if(index === -1) {
      return;
    }
    this.receivers.splice(index, 1);
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

    let storedMessage: StoredMessageBase = {
      senderIdentityKeyPublic: await this.myIdentityKeyPair.publicKey.exportKey(),
      messageDecrypted: true,
      payload: data,
      id: window.crypto.randomUUID(),
      groupId: this.groupId,
      isVerified: true
    }

    return storedMessage;
  }


  async sendRegularMessage(message: string) {
    let data: EncryptedRegularMessageData = {
      type: 'text-message',
      groupId: this.groupId,
      data: {
        message: message
      }
    };

    return await this.sendMessage(data);
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

    return await this.sendMessage(data);


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

    return await this.sendMessage(data);
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
    return await this.sendMessage(data);


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

    return await this.sendMessage(data);


  }

  async acceptInvite(myMailboxId: string) {
    let data: EncryptedAcceptInviteMessageData = {
      type: 'accept-invite',
      groupId: this.groupId,
      data: {
        mailboxId: myMailboxId
      }
    }
    return await this.sendMessage(data);

  }

  async inviteToGroup(group: GroupChatEntry) {
    let data: EncryptedMessageGroupInvitePayload = {
      type: 'group-invite',
      groupId: group.groupId,
      data: {
        members: group.members.map(m => {
          return {
            identityKeyPublicString: m.identityKeyPublicString,
            username: m.username,
            server: m.remoteServer
          }
        })
      }
    }
    return await this.sendMessage(data);

  }

  async joinGroup() {
    let data: EncryptedMessageJoinGroupPayload = {
      type: 'join-group',
      groupId: this.groupId!,
      data: {
        mailboxId: this.myMailboxId
      }
    }
    return await this.sendMessage(data);

  }

  async leaveGroup() {
    let data: EncryptedLeaveGroupMessageData = {
      type: 'leave-group',
      groupId: this.groupId!,
      data: undefined
    };
    return await this.sendMessage(data);

  }

  async changeMailboxId(mailboxId: string) {
    this.myMailboxId = mailboxId;
    let data: EncryptedNewMailboxIdMessageData = {
      type: 'change-mailbox-id',
      groupId: this.groupId,
      data: {
        mailboxId: mailboxId,
      }
    }
    return await this.sendMessage(data);

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

  async sendInvite(receiverUsername: string, receiverServer: string, invitePayload: EncryptedKeyExchangeRequestPayload, ephemKey: ECDHPublicKey, ephemSalt: ArrayBuffer, encKey: AesGcmKey) {
    let encryptedPayload = await signAndEncryptData(invitePayload, encKey, this.myIdentityKeyPair.privateKey)
    let data: KeyExchangeRequest = {
      receiverUsername: receiverUsername,
      receiverServer: receiverServer,
      senderUsername: this.myUsername,
      senderServer: window.location.host,
      encryptedPayload: encryptedPayload,
      id: window.crypto.randomUUID(),
      ephemeralKeyPublic: await ephemKey.exportKey('base64'),
      ephemeralSalt: arrayBufferToBase64(ephemSalt),
      type: 'key-exchange-request'
    };

    this.ws.send(JSON.stringify(data));
  }

}


export class MessageSenderBuilder {
  private ws: WebSocket;
  private db: Database;

  constructor(ws: WebSocket, db: Database) {
    this.ws = ws;
    this.db = db;
  }
  
  async buildMessageSender(id: string, type: 'individual-key' | 'groupId'): Promise<SocketMessageSender> {
    //get all known users I will be speaking to
    let receivers: KnownUserEntry[];
    if(type === 'individual-key') {
      receivers = [(await this.db.knownUserStore.get(id))!];
    } else {
      //dont forget to exclude yourself from receiver list
      let members = (await this.db.groupChatStore.get(id))!.members
        .filter(m => m.acceptedInvite === true)
      console.log(members);
      receivers = await Promise.all(members.map(m => this.db.knownUserStore.get(m.identityKeyPublicString))) as KnownUserEntry[];
    }

    let myAcc = (await this.db.accountStore.get(LOCAL_STORAGE_HANDLER.getUsername()!))!

    return new SocketMessageSender(this.ws, receivers, myAcc.identityKeyPair, myAcc.mailboxId, type === 'groupId' ? id : undefined);
  }

  /**
   * This should only be used when accepting a group invite from a KnownUser
   * Because not all group members will know each other and have not performed a key
   * exchange, this method is needed 
   * @param groupId 
   * @param idKeys 
   * @returns 
   */
  async buildMessageSenderForKnownGroupMembers(groupId: string, ...idKeys: string[]) {
    let receivers: KnownUserEntry[];
    
    receivers = await Promise.all(idKeys.map(idKey => this.db.knownUserStore.get(idKey))) as KnownUserEntry[];

    //filter out null values (if any)
    receivers = receivers.filter(user => user !== null);

    let myAcc = (await this.db.accountStore.get(LOCAL_STORAGE_HANDLER.getUsername()!))!

    return new SocketMessageSender(this.ws, receivers, myAcc.identityKeyPair, myAcc.mailboxId, groupId);

  }
}

export class InviteSenderBuilder {
  private ws: WebSocket;
  private db: Database;

  constructor(ws: WebSocket, db: Database) {
    this.ws = ws;
    this.db = db;
  }

  async buildInviteSender() {
    let myIdKey = (await this.db.accountStore.get(LOCAL_STORAGE_HANDLER.getUsername()!))!.identityKeyPair;

    return new SocketInviteSender(this.ws, myIdKey, LOCAL_STORAGE_HANDLER.getUsername()!);
  }
  
}