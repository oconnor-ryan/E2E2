import { AesGcmKey, ECDHKeyPairBuilder, ECDSAPublicKey } from "../encryption/encryption.js";
import { InviteSenderBuilder, MessageSenderBuilder, SocketInviteSender } from "../message-handler/MessageSender.js";
import { EncryptedKeyExchangeRequestPayload, EncryptedMessageGroupInvitePayload, StoredKeyExchangeRequest } from "../message-handler/MessageType.js";
import { x3dh_sender } from "../signal-protocol/X3DH.js";
import { GroupChatEntry, GroupChatStore, KnownUserEntry } from "../storage/ObjectStore.js";
import { Database, LOCAL_STORAGE_HANDLER } from "../storage/StorageHandler.js";
import { UserKeys, UserKeysForExchange, getUserKeys, getUserKeysForExchange } from "./ApiRepository.js";

export async function inviteUser(db: Database, receiverUsername: string, inviteSender: SocketInviteSender, type: 'one-to-one-invite' | 'group-key-exchange') {
  let theirAcc = await getUserKeysForExchange(receiverUsername);
  if(!theirAcc) {
    throw new Error("No user found!");
  }
  
  let acc = (await db.accountStore.get(LOCAL_STORAGE_HANDLER.getUsername()!))!;
  const ecdhBuilder = new ECDHKeyPairBuilder();
  const ephemKey = await ecdhBuilder.generateKeyPairWrapper();


  let {secretKey, salt} = await x3dh_sender(
    acc.exchangeIdKeyPair.privateKey,
    ephemKey.privateKey,
    theirAcc.exchangeIdKeyPublic,
    theirAcc.exchangePrekeyPublic
  );


  await db.knownUserStore.add({
    identityKeyPublic: theirAcc.identityKeyPublic,
    identityKeyPublicString: await theirAcc.identityKeyPublic.exportKey(),
    mailboxId: undefined, //we dont know this user's mailboxId yet
    remoteServer: window.location.host,
    exchangeIdKeyPublic: theirAcc.exchangeIdKeyPublic,
    exchangePreKeyPublic: theirAcc.exchangePrekeyPublic,
    currentEncryptionKey: secretKey,
    username: receiverUsername
  });

  let payload: EncryptedKeyExchangeRequestPayload = {
    mailboxId: acc.mailboxId,
    comment: "",
    type: type,
    groupId: undefined
  };


  await inviteSender.sendInvite(receiverUsername, window.location.host, payload, ephemKey.publicKey, salt, secretKey);


}

export async function acceptInvite(username: string, db: Database, messageSenderBuilder: MessageSenderBuilder) {
  let user: UserKeys;
  try {
    let u = await getUserKeys(username);
    if(!u) {
      throw new Error('User not found!');
    }
    user = u;
  } catch(e) {
    console.error(e);
    return false;
  }

  //find if a key exchange was performed with this user.
  let exchange: StoredKeyExchangeRequest;
  try {
    let e = await db.keyExchangeRequestStore.get([username, window.location.host]);
    if(!e) {
      throw new Error('No key exchange found for this user!');
    }
    exchange = e;
  } catch(e) {
    console.error(e);
    return false;
  }

  let idKeyString = await user.identityKeyPublic.exportKey('base64');
  //add this user to our list of KnownUsers
  try {
    await db.knownUserStore.add({
      username: username,
      identityKeyPublic: user.identityKeyPublic,
      identityKeyPublicString: idKeyString,
      exchangeIdKeyPublic: user.exchangeIdKeyPublic,
      exchangePreKeyPublic: user.exchangePrekeyPublic,
      currentEncryptionKey: exchange.derivedEncryptionKey,
      remoteServer: exchange.senderServer,
      mailboxId: exchange.payload.mailboxId
    });

    await db.keyExchangeRequestStore.delete([username, window.location.host]);
  } catch(e) {
    console.error(e);
    return false;
  }

  const myAcc = (await db.accountStore.get(LOCAL_STORAGE_HANDLER.getUsername()!))!;

  //send a accept-invite message
  try {
    await (await messageSenderBuilder.buildMessageSender(idKeyString, 'individual-key')).acceptInvite(myAcc.mailboxId);
  } catch(e) {
    console.error(e);
    return false;
  }
  return true;
}

export async function addGroup(sender: KnownUserEntry, groupInfo: EncryptedMessageGroupInvitePayload, db: Database, status: 'pending-approval' | 'joined-group' | 'denied') {
  //dont forget to add the original sender of the invite to the group member list
  groupInfo.data.members.push({
    identityKeyPublicString: sender.identityKeyPublicString,
    username: sender.username,
    server: sender.remoteServer,
  });

  //also remove yourself from the member list to avoid sending messages to yourself
  //when sending group messages
  groupInfo.data.members = groupInfo.data.members.filter(m => m.username !== LOCAL_STORAGE_HANDLER.getUsername());

  await db.groupChatStore.add({
    groupId: groupInfo.groupId,
    status: status,
    members: groupInfo.data.members.map(m => {
      return {
        identityKeyPublicString: m.identityKeyPublicString,
        remoteServer: m.server,
        username: m.username,
        //this will be set to true once this member receives a join-group message or group-key-exchange message
        //note that the sender of a message is garanteed to have accepted an invite
        //since they made the group
        acceptedInvite: m.identityKeyPublicString === sender.identityKeyPublicString
      }
    })
  })
}

export async function inviteToGroup(db: Database, senderBuilder: MessageSenderBuilder, usernames: string[], groupId?: string) {
  console.log("HERE");
  console.log(usernames);
  let users = await Promise.all(usernames.map(u => db.knownUserStore.getUserWithUsername(u, window.location.host)));
  console.log(users);
  if(!groupId) {
    groupId = window.crypto.randomUUID();
  }


  //remove possible null entries
  let filteredUsers = users.filter(u => u !== null) as KnownUserEntry[];

  let groupChatEntry: GroupChatEntry = {
    groupId: groupId,
    status: 'joined-group',
    members: filteredUsers.map(u => {
      return {
        identityKeyPublicString: u.identityKeyPublicString,
        username: u.username,
        remoteServer: u.remoteServer,
        acceptedInvite: false //will be true once a join-group message is received or a group-key-exchange invite is received
      }
    }
  )};


  await db.groupChatStore.update(groupChatEntry);

  //only already known users can be invited to a group
  let messageSender = await senderBuilder.buildMessageSenderForKnownGroupMembers(groupId, ...filteredUsers.map(u => u.identityKeyPublicString));
  await messageSender.inviteToGroup(groupChatEntry);
}

export async function acceptGroupInvite(groupId: string, db: Database, senderBuilder: MessageSenderBuilder, inviteSenderBuilder: InviteSenderBuilder) {
  let group = await db.groupChatStore.get(groupId);
  if(!group || group.status === 'joined-group') {
    return;
  }

  //update group status to joined-group
  group.status = 'joined-group';

  
  await db.groupChatStore.update(group);

  //accept all pending group members who performed a key exchange
  let members = (await db.knownUserStore.getAll()).filter(u => u.waitingGroupMember === true);
  for(let member of members) {
    member.waitingGroupMember = undefined;
    await db.knownUserStore.update(member);
  }



  let notFriends: {
    identityKeyPublicString: string,
    username: string,
    remoteServer: string
  }[] = [];

  for(let member of group.members) {
    if(!(await isFriend(member.identityKeyPublicString, db))) {
      notFriends.push(member);
    }
  }

  let friends = group.members.filter(member => {
    //dont include nonFriends in friend list
    // !! converts truthy/falsey value to boolean, and the third ! negates the resulting boolean
    return !(!!notFriends.find(u => u.username === member.username));
  })

  for(let member of notFriends) {
    //send key exchange to each unknown member of group
    await inviteUser(db, member.username, await inviteSenderBuilder.buildInviteSender(), 'group-key-exchange');
  }

  //send joined-group message to each KNOWN group member
  let messageSender = await senderBuilder.buildMessageSenderForKnownGroupMembers(groupId, ...friends.map(f => f.identityKeyPublicString));
  await messageSender.joinGroup();
}
export async function addFriend(theirAcc: UserKeysForExchange, db: Database, derivedEncryptionKey: AesGcmKey, derivedMailboxId: string) {
  await db.knownUserStore.add({
    identityKeyPublicString: await theirAcc.identityKeyPublic.exportKey('base64'),
    identityKeyPublic: theirAcc.identityKeyPublic,
    username: theirAcc.username,
    exchangeIdKeyPublic: theirAcc.exchangeIdKeyPublic,
    exchangePreKeyPublic: theirAcc.exchangePrekeyPublic,
    currentEncryptionKey: derivedEncryptionKey,
    remoteServer: window.location.host,
    mailboxId: derivedMailboxId
  })
}

export async function denyGroupInvite(groupId: string, db: Database) {
  await db.groupChatStore.delete(groupId);
}

export async function isFriend(identityKey: string, db: Database) {
  let u = await db.knownUserStore.get(identityKey);
  console.log(u);
  if(!u) {
    return false;
  }

  console.log(u.mailboxId);

  return !!u.mailboxId;
}

export async function addPendingGroupMember(theirAcc: UserKeysForExchange, db: Database, derivedEncryptionKey: AesGcmKey, derivedMailboxId: string) {
  await db.knownUserStore.add({
    identityKeyPublicString: await theirAcc.identityKeyPublic.exportKey('base64'),
    identityKeyPublic: theirAcc.identityKeyPublic,
    username: theirAcc.username,
    exchangeIdKeyPublic: theirAcc.exchangeIdKeyPublic,
    exchangePreKeyPublic: theirAcc.exchangePrekeyPublic,
    currentEncryptionKey: derivedEncryptionKey,
    remoteServer: window.location.host,
    waitingGroupMember: true,
    mailboxId: derivedMailboxId
  })
}