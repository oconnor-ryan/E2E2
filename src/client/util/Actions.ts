import { AesGcmKey, ECDHKeyPairBuilder, ECDSAPublicKey } from "../encryption/encryption.js";
import { SocketInviteSender } from "../message-handler/MessageSender.js";
import { EncryptedKeyExchangeRequestPayload, EncryptedMessageGroupInvitePayload } from "../message-handler/MessageType.js";
import { x3dh_sender } from "../signal-protocol/X3DH.js";
import { Database, LOCAL_STORAGE_HANDLER } from "../storage/StorageHandler.js";
import { UserKeysForExchange, getUserKeysForExchange } from "./ApiRepository.js";

export async function inviteUser(db: Database, receiverUsername: string, inviteSender: SocketInviteSender) {
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
    remoteServer: "",
    exchangeIdKeyPublic: theirAcc.exchangeIdKeyPublic,
    exchangePreKeyPublic: theirAcc.exchangePrekeyPublic,
    exchangeOneTimePreKeyPublic: theirAcc.exchangeOneTimePrekeyPublic,
    currentEncryptionKey: secretKey,
    username: receiverUsername
  });

  let payload: EncryptedKeyExchangeRequestPayload = {
    mailboxId: acc.mailboxId,
    comment: "",
    type: 'one-to-one-invite',
    groupId: undefined
  };


  await inviteSender.sendInvite(receiverUsername, "", payload, ephemKey.publicKey, salt, secretKey);


}

export async function addGroup(groupInfo: EncryptedMessageGroupInvitePayload, db: Database, status: 'pending-approval' | 'joined-group' | 'denied') {
  await db.groupChatStore.add({
    groupId: groupInfo.groupId,
    status: status,
    members: groupInfo.data.members.map(m => {
      return {
        identityKeyPublicString: m.identityKeyPublic,
        remoteServer: m.server,
        username: "",
      }
    })
  })
}

export async function addFriend(theirAcc: UserKeysForExchange, db: Database, derivedEncryptionKey: AesGcmKey, derivedMailboxId: string) {
  await db.knownUserStore.add({
    identityKeyPublicString: await theirAcc.identityKeyPublic.exportKey('base64'),
    identityKeyPublic: theirAcc.identityKeyPublic,
    username: theirAcc.username,
    exchangeIdKeyPublic: theirAcc.exchangeIdKeyPublic,
    exchangePreKeyPublic: theirAcc.exchangePrekeyPublic,
    exchangeOneTimePreKeyPublic: theirAcc.exchangeOneTimePrekeyPublic,
    currentEncryptionKey: derivedEncryptionKey,
    remoteServer: "",
    mailboxId: derivedMailboxId
  })
}

export async function addPendingGroupMember(theirAcc: UserKeysForExchange, db: Database, derivedEncryptionKey: AesGcmKey, derivedMailboxId: string) {
  await db.knownUserStore.add({
    identityKeyPublicString: await theirAcc.identityKeyPublic.exportKey('base64'),
    identityKeyPublic: theirAcc.identityKeyPublic,
    username: theirAcc.username,
    exchangeIdKeyPublic: theirAcc.exchangeIdKeyPublic,
    exchangePreKeyPublic: theirAcc.exchangePrekeyPublic,
    exchangeOneTimePreKeyPublic: theirAcc.exchangeOneTimePrekeyPublic,
    currentEncryptionKey: derivedEncryptionKey,
    remoteServer: "",
    waitingGroupMember: true,
    mailboxId: derivedMailboxId
  })
}