import { ECDHPublicKey } from "../encryption/ECDH.js";
import { x3dh_receiver } from "../signal-protocol/X3DH.js";
import { Database, LOCAL_STORAGE_HANDLER } from "../storage/StorageHandler.js";
import { EncryptedMessageData, EncryptedPayloadBase, ErrorMessage, Message, KeyExchangeRequest, QueuedMessagesAndInvitesObj, StoredMessageBase, EncryptedKeyExchangeRequestPayload, EncryptedMessageGroupInvitePayload } from "./MessageType.js";
import { UserKeysForExchange, getUserKeysForExchange } from "../util/ApiRepository.js";
import { addFriend, addGroup, addPendingGroupMember } from "../util/Actions.js";
import { AesGcmKey } from "../encryption/encryption.js";

export class MessageReceivedEventHandler {
  public onmessage: (message: StoredMessageBase, payload: EncryptedMessageData | null, messageSaved: boolean, error: Error | null) => void = () => {};
  public onkeyexchangerequest: (request: KeyExchangeRequest, requestSaved: boolean, error: Error | null) => void = () => {};
  public onerror: (error: ErrorMessage) => void = () => {}
  public onbatchedmessageerror: (numMessagesReceived: number, numInvitesReceived: number) => void = () => {}
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
  const updateLastReadUUID = async () => {
    try {
      if(updateLastMessageRead) {
        await db.accountStore.setLastReadMessage(LOCAL_STORAGE_HANDLER.getUsername()!, data.id);
      }
    } catch(e) {
      //do nothing since database will never store messages with duplicate keys
    }
  };

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
    await updateLastReadUUID();
    emitter?.onmessage(convertMessageForStorage(data, false), null, false, e as Error);
    return false;
  }

  

  switch(decryptedMessageData.type) {
    //voip related calls should never be stored on database
    case 'call-request':
    case 'call-accept':
    case 'call-signaling':
      emitter?.onmessage(convertMessageForStorage(data, false), decryptedMessageData, true, null);
      await updateLastReadUUID();
      return true;
    case 'group-invite':
      await addGroup(decryptedMessageData as EncryptedMessageGroupInvitePayload, db, 'pending-approval');
      await updateLastReadUUID();
      return true;
    default:
  }
  

  await updateLastReadUUID();
  //emit that a message was received even if it has not been stored yet
  emitter?.onmessage(storedMessageData, decryptedMessageData, true, null);

  return true;

}

export async function parseKeyExchangeRequest(data: KeyExchangeRequest, db: Database, emitter: MessageReceivedEventHandler | null, updateLastMessageRead: boolean = true) : Promise<boolean> {
  let theirAcc: UserKeysForExchange;
  let secretKey: AesGcmKey;
  let mailboxId: string;

  const saveLastReadUUID = async () => {
    try {
      if(updateLastMessageRead) {
        await db.accountStore.setLastReadKeyExchangeRequest(LOCAL_STORAGE_HANDLER.getUsername()!, data.id);
      }
    } catch(e) {
      //no need to do anything
    }
  };

  try {
    let acc = await getUserKeysForExchange(data.senderUsername);
    //if no user found, ignore this request
    if(!acc) {
      await saveLastReadUUID();
      return true;
    }
    theirAcc = acc;
  } catch(e) {
    console.error(e);
    //if an error occurred due to some networking issue,
    //do not save the last read uuid so that this can be processed later
    return false;  
  }

  let decryptedMessageData: EncryptedKeyExchangeRequestPayload;

  try {
    let myAcc = await db.accountStore.get(LOCAL_STORAGE_HANDLER.getUsername()!);
    if(!myAcc) {
      throw new Error("Account not found!")
    }

    console.log("HI THERE")
    //perform X3DH
    let ephemKey = await ECDHPublicKey.importKey(data.ephemeralKeyPublic);
    console.log("Ephem KEy")
    secretKey = (await x3dh_receiver(myAcc.exchangeIdKeyPair.privateKey, myAcc.exchangeIdPreKeyPair.privateKey, theirAcc.exchangeIdKeyPublic, ephemKey, data.ephemeralSalt)).secretKey;

    console.log("X3DH")

    let decryptedPayload = JSON.parse(await secretKey.decrypt(data.encryptedPayload, 'string')) as EncryptedPayloadBase;

    //check signature
    
    //
    decryptedMessageData = decryptedPayload.signed_data as EncryptedKeyExchangeRequestPayload;
    console.log("PAYLOAD")
    
  } catch(e) {
    console.error(e);
    await saveLastReadUUID();
    emitter?.onkeyexchangerequest(data, false, e as Error);
    return false;
  }

  mailboxId = decryptedMessageData.mailboxId;

  console.log(decryptedMessageData);

  if(decryptedMessageData.type === 'one-to-one-invite') {
    try {
      await db.messageInviteStore.add(data);
    } catch(e) {
      //if this is not duplicate entry error, throw an error
      if((e as Error).name !== "ConstraintError") {
        await saveLastReadUUID();
        emitter?.onkeyexchangerequest(data, false, e as Error);
        return false;
      }
    }
  } else {
    //check to see if you have already accepted a group chat request.
    let groupInfo = await db.groupChatStore.get(decryptedMessageData.groupId!);

    //ignore this request
    if(!groupInfo || groupInfo.status === 'denied') {
      
    }
    //keep this user request as a pending group member who can be deleted if the 
    //group invite is later denied
    else if(groupInfo.status === 'pending-approval') {
      await addPendingGroupMember(theirAcc, db, secretKey, mailboxId);
    }
    //if you accepted the group chat request, automatically add this user as a normal friend in the KnownUser object store
    else if(groupInfo.status === 'joined-group') {
      await addFriend(theirAcc, db, secretKey, mailboxId);
    }
    await saveLastReadUUID();
    return true;
  }

  await saveLastReadUUID();
  
  emitter?.onkeyexchangerequest(data, true, null);
  return true;
}


export async function parseQueuedMessagesAndInvites(data: QueuedMessagesAndInvitesObj, db: Database, emitter: MessageReceivedEventHandler) {
  if(data.messages.length > 0) {
    let lastMessageId = data.messages[data.messages.length-1].id;
    db.accountStore.setLastReadMessage(LOCAL_STORAGE_HANDLER.getUsername()!, lastMessageId)
      .catch(e => console.error("Unable to save last read message", e));
  }

  if(data.exchanges.length > 0) {
    let lastKeyExchangeRequestId = data.exchanges[data.exchanges.length-1].id;

    db.accountStore.setLastReadKeyExchangeRequest(LOCAL_STORAGE_HANDLER.getUsername()!, lastKeyExchangeRequestId)
      .catch(e => console.error("Unable to save last read key exchange request", e));
  }
  


  try {
    //parse all messages FIRST so that group invites sent via a Message can be processed before viewing group member key exchange requests
    let messagesProcessedList = await Promise.all(data.messages.map(m => parseMessage(m, db, null, false)));
    let keyExchangeRequestsProcessedList = await Promise.all(data.exchanges.map(i => parseKeyExchangeRequest(i, db, null, false)));

    let numMessagesSaved = 0;
    let numInvitesSaved = 0;
    for(let messageWasSaved of messagesProcessedList) {
      if(messageWasSaved) {
        numMessagesSaved++;
      }
    }

    for(let inviteWasSaved of keyExchangeRequestsProcessedList) {
      if(inviteWasSaved) {
        numInvitesSaved++;
      }
    }
    emitter.onbatchedmessageerror(numMessagesSaved, numInvitesSaved);
  } catch(e) {
    console.error(e);
    emitter.onerror({type: 'error', 'error': 'Failed to process batched messages and exchanges!'});
  }
  

}

export function parseError(error: ErrorMessage, emitter: MessageReceivedEventHandler) {
  emitter.onerror(error);
}

