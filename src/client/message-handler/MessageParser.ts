import { parse } from "dotenv";
import { AesGcmKey, ECDSAPrivateKey } from "../encryption/encryption.js";
import { Database, LOCAL_STORAGE_HANDLER } from "../storage/StorageHandler.js";
import { EncryptedMessageData, EncryptedPayloadBase, ErrorMessage, Message, MessageInvite, QueuedMessagesAndInvitesObj, StoredMessageBase } from "./MessageType.js";

export class MessageReceivedEventHandler {
  public onmessage: (message: StoredMessageBase, payload: EncryptedMessageData | null, messageSaved: boolean, error: Error | null) => void = () => {};
  public onmessageinvite: (invite: MessageInvite, inviteSaved: boolean, error: Error | null) => void = () => {};
  public onerror: (error: ErrorMessage) => void = () => {}
  public onbatchedmessageerror: (numMessagesMissed: number, numInvitesMissed: number) => void = () => {}
}


export function messageParseError(type: "not-json" | 'invalid-type' | 'wrong-type-format') {
  console.error(type);
}

export function convertMessageForStorage(message: Message, isVerified: boolean, decryptedPayload?: EncryptedMessageData) : StoredMessageBase{
  return {
    id: message.id,
    senderIdentityKeyPublic: message.senderIdentityKeyPublic,
    isVerified: isVerified,
    
    messageDecrypted: decryptedPayload !== undefined,
    payload: decryptedPayload
  }
}


export async function parseMessage(data: Message, db: Database, emitter: MessageReceivedEventHandler | null, updateLastMessageRead: boolean = true) : Promise<boolean> {
  let storedMessageData: StoredMessageBase;
  let decryptedMessageData: EncryptedMessageData;
  try {
    let sender = await db.knownUserStore.get(data.senderIdentityKeyPublic);
    if(!sender) {
      throw new Error("Unknown User sent this message!");
    }

    let decryptedData = await sender.currentEncryptionKey.decrypt(data.encryptedPayload);

    let json = JSON.parse(decryptedData) as EncryptedPayloadBase;

    //if signature is valud or not
    let isVerified = await sender.identityKeyPublic.verify(json.signature, JSON.stringify(json.signed_data))

    decryptedMessageData = json.signed_data as EncryptedMessageData;

    storedMessageData = convertMessageForStorage(data, isVerified, decryptedMessageData);

  } catch(e) {
    //the error can only be thrown if the message failed to be decrypted or its
    //payload is not a properly formatted JSON
    emitter?.onmessage(convertMessageForStorage(data, false), null, false, e as Error);
    return false;
  }

  

  switch(decryptedMessageData.type) {
    //voip related calls should never be stored on database
    case 'call-request':
    case 'call-accept':
    case 'call-signaling':
      emitter?.onmessage(convertMessageForStorage(data, false), decryptedMessageData, true, null);
      return true;
    default:
  }

  try {
    //if data with a duplicate uuid is put in here, an error will be thrown
    //which is good in case the last read update fails to update
    await db.messageStore.add(storedMessageData);
  } catch(e) {
    //if this is not duplicate entry error, throw an error
    if((e as Error).name !== "ConstraintError") {
      emitter?.onmessage(convertMessageForStorage(data, false), decryptedMessageData, false, e as Error);
      return false;
    }
  }

  try {
    if(updateLastMessageRead) {
      await db.accountStore.setLastReadMessage(LOCAL_STORAGE_HANDLER.getUsername()!, data.id);
    }
  } catch(e) {
    //do nothing since database will never store messages with duplicate keys
  }
  
  //emit that a message was received even if it has not been stored yet
  emitter?.onmessage(storedMessageData, decryptedMessageData, true, null);

  return true;

}

export async function parseMessageInvite(data: MessageInvite, db: Database, emitter: MessageReceivedEventHandler | null, updateLastMessageRead: boolean = true) : Promise<boolean> {
  try {
    await db.messageRequestStore.add(data);
  } catch(e) {
    //if this is not duplicate entry error, throw an error
    if((e as Error).name !== "ConstraintError") {
      emitter?.onmessageinvite(data, false, e as Error);
      return false;
    }
  }

  try {
    if(updateLastMessageRead) {
      await db.accountStore.setLastReadMessageInvite(LOCAL_STORAGE_HANDLER.getUsername()!, data.id);
    }
  } catch(e) {
    //no need to do anything
  }
  emitter?.onmessageinvite(data, true, null);
  return true;
}


export function parseQueuedMessagesAndInvites(data: QueuedMessagesAndInvitesObj, db: Database, emitter: MessageReceivedEventHandler) {
  let lastMessageId = data.messages[data.messages.length-1].id;
  let lastMessageInviteId = data.invites[data.invites.length-1].id;

  db.accountStore.setLastReadMessage(LOCAL_STORAGE_HANDLER.getUsername()!, lastMessageId)
        .catch(e => console.error("Unable to save last read message", e));

  db.accountStore.setLastReadMessageInvite(LOCAL_STORAGE_HANDLER.getUsername()!, lastMessageInviteId)
    .catch(e => console.error("Unable to save last read invite", e));


  Promise.all([Promise.all(data.messages.map(m => parseMessage(m, db, null, false))), Promise.all(data.invites.map(i => parseMessageInvite(i, db, null, false)))])
   .then(result => {
      let numMessagesFailedToSave = 0;
      let numInvitesFailedToSave = 0;
      for(let messageWasSaved of result[0]) {
        if(!messageWasSaved) {
          numMessagesFailedToSave++;
        }
      }

      for(let messageWasSaved of result[1]) {
        if(!messageWasSaved) {
          numInvitesFailedToSave++;
        }
      }
      emitter.onbatchedmessageerror(numMessagesFailedToSave, numInvitesFailedToSave);
   })
   .catch(e => {
    console.error(e);
   });
}

export function parseError(error: ErrorMessage, emitter: MessageReceivedEventHandler) {
  emitter.onerror(error);
}

