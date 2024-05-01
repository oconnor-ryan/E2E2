import { ECDHPublicKey } from "../encryption/ECDH.js";
import { x3dh_receiver } from "../signal-protocol/X3DH.js";
import { Database, LOCAL_STORAGE_HANDLER } from "../storage/StorageHandler.js";
import { EncryptedMessageData, EncryptedPayloadBase, ErrorMessage, Message, KeyExchangeRequest, QueuedMessagesAndInvitesObj, StoredMessageBase, EncryptedKeyExchangeRequestPayload, EncryptedMessageGroupInvitePayload, StoredKeyExchangeRequest, EncryptedMessageJoinGroupPayload, EncryptedAcceptInviteMessageData } from "./MessageType.js";
import { UserKeysForExchange, getUserKeysForExchange } from "../util/ApiRepository.js";
import { acceptGroupInvite, addFriend, addGroup, addPendingGroupMember } from "../util/Actions.js";
import { AesGcmKey } from "../encryption/encryption.js";
import { InviteSenderBuilder, MessageSenderBuilder, SocketInviteSender } from "./MessageSender.js";
import { KnownUserEntry } from "../storage/ObjectStore.js";

export interface MessageSenderData {
  messageSenderBuilder: MessageSenderBuilder,
  messageInviteSender: SocketInviteSender
}
export class MessageReceivedEventHandler {

  public onmessage: (message: StoredMessageBase, messageSaved: boolean, error: Error | null) => void = () => {};
  public onkeyexchangerequest: (request: StoredKeyExchangeRequest, error: Error | null) => void = () => {};
  public onerror: (error: ErrorMessage) => void = () => {}
  public onbatchedmessage: (numMessagesReceived: number, numInvitesReceived: number) => void = () => {}
}


export function messageParseError(type: "not-json" | 'invalid-type' | 'wrong-type-format') {
  console.error(type);
}

export function convertMessageForStorage(message: Message, isVerified: boolean, decryptedPayload: EncryptedMessageData) : StoredMessageBase{
  return {
    id: message.id,
    senderIdentityKeyPublic: message.senderIdentityKeyPublic,
    isVerified: isVerified,
    groupId: decryptedPayload?.groupId,
    messageDecrypted: decryptedPayload !== undefined,
    payload: decryptedPayload
  }
}

export function convertExchangeForStorage(exchange: KeyExchangeRequest, decryptedPayload: EncryptedKeyExchangeRequestPayload, derivedEncryptionKey: AesGcmKey): StoredKeyExchangeRequest {
  return {
    id: exchange.id,
    senderServer: exchange.senderServer,
    senderUsername: exchange.senderUsername,
    payload: decryptedPayload,
    derivedEncryptionKey: derivedEncryptionKey
  }
}


export async function parseMessage(data: Message, db: Database, emitter: MessageReceivedEventHandler | null, updateLastMessageRead: boolean = true) : Promise<boolean> {
  console.log('Message Received');
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

  let sender: KnownUserEntry;

  try {
    let senderAcc = await db.knownUserStore.get(data.senderIdentityKeyPublic);
    if(!senderAcc) {
      throw new Error("Unknown User sent this message!");
    }
    sender = senderAcc;

    console.log(sender);

    let decryptedData = await sender.currentEncryptionKey.decrypt(data.encryptedPayload);

    console.log('decrypted data');
    let json = JSON.parse(decryptedData) as EncryptedPayloadBase;

    console.log('decrypted json');

    //if signature is valud or not
    console.log(JSON.stringify(json.signed_data));
    console.log(json.signature)
    let isVerified = await sender.identityKeyPublic.verify(json.signature, JSON.stringify(json.signed_data))

    console.log('decrypted verifed');

    decryptedMessageData = json.signed_data as EncryptedMessageData;

    storedMessageData = convertMessageForStorage(data, isVerified, decryptedMessageData);

  } catch(e) {
    console.error(e);
    //the error can only be thrown if the message failed to be decrypted or its
    //payload is not a properly formatted JSON
    await updateLastReadUUID();
    //silently ignore this message for now
    console.warn("Cannot decrypt message: ", e);
    //emitter?.onmessage(convertMessageForStorage(data, false), false, e as Error);
    return false;
  }

  console.log(storedMessageData);
  

  switch(decryptedMessageData.type) {
    //voip related calls should never be stored on database
    case 'call-request':
    case 'call-accept':
    case 'call-signaling':
      emitter?.onmessage(convertMessageForStorage(data, false, decryptedMessageData), true, null);
      await updateLastReadUUID();
      return true;
    case 'group-invite':
      await addGroup(sender, decryptedMessageData as EncryptedMessageGroupInvitePayload, db, 'pending-approval');
      await updateLastReadUUID();
      return true;
    case 'join-group': {
      let data = decryptedMessageData as EncryptedMessageJoinGroupPayload;
      let group = await db.groupChatStore.get(data.groupId);
      if(group === null) {
        break;
      }
      let memberIndex = group.members.findIndex(m => m.identityKeyPublicString === sender.identityKeyPublicString);
      if(memberIndex === -1) {
        break;
      }

      group.members[memberIndex].acceptedInvite = true;
      await db.groupChatStore.update(group);
      break;
    }
    case 'accept-invite':
      //accept the invite by retrieving the mailbox id
      sender.mailboxId = (decryptedMessageData as EncryptedAcceptInviteMessageData).data.mailboxId;
      await db.knownUserStore.update(sender);
      await updateLastReadUUID();
      return true;
    default:
  }
  

  await updateLastReadUUID();
  //emit that a message was received even if it has not been stored yet
  emitter?.onmessage(storedMessageData, true, null);

  return true;

}

export async function parseKeyExchangeRequest(data: KeyExchangeRequest, db: Database, emitter: MessageReceivedEventHandler | null, updateLastMessageRead: boolean = true) : Promise<boolean> {
  let theirAcc: UserKeysForExchange;
  let secretKey: AesGcmKey | undefined;

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
    //dont bother calling emitter, there is nothing that the user can do if they receive a bad key exchange
    //emitter?.onkeyexchangerequest(convertExchangeForStorage(data, undefined, secretKey), e as Error);
    return false;
  }

  const storedExchange: StoredKeyExchangeRequest = convertExchangeForStorage(data, decryptedMessageData, secretKey);


  if(storedExchange.payload!.type === 'one-to-one-invite') {
    try {
      await db.keyExchangeRequestStore.add(storedExchange);
    } catch(e) {
      //if this is not duplicate entry error, throw an error
      if((e as Error).name !== "ConstraintError") {
        await saveLastReadUUID();
        emitter?.onkeyexchangerequest(storedExchange, e as Error);
        return false;
      }
    }
  } else {
    //check to see if you have already accepted a group chat request.
    let groupInfo = await db.groupChatStore.get(storedExchange.payload!.groupId!);

    //ignore this request
    if(!groupInfo || groupInfo.status === 'denied') {
      
    }
    //keep this user request as a pending group member who can be deleted if the 
    //group invite is later denied
    else if(groupInfo.status === 'pending-approval') {
      await addPendingGroupMember(theirAcc, db, secretKey, storedExchange.payload!.mailboxId);
    }
    //if you accepted the group chat request, automatically add this user as a normal friend in the KnownUser object store
    else if(groupInfo.status === 'joined-group') {
      await addFriend(theirAcc, db, secretKey, storedExchange.payload!.mailboxId);
    }
    await saveLastReadUUID();
    return true;
  }

  await saveLastReadUUID();
  
  emitter?.onkeyexchangerequest(storedExchange, null);
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
    emitter.onbatchedmessage(numMessagesSaved, numInvitesSaved);
  } catch(e) {
    console.error(e);
    emitter.onerror({type: 'error', 'error': 'Failed to process batched messages and exchanges!'});
  }
  

}

export function parseError(error: ErrorMessage, emitter: MessageReceivedEventHandler) {
  emitter.onerror(error);
}

