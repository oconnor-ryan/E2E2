import postgres from 'postgres';
import { ErrorCode } from '../../client/shared/Constants.js';
import { hashPassword } from './password-hash.js';
import { verifyKey } from './webcrypto/ecdsa.js';

const db = postgres({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PSWD,
  transform: undefined
});

export interface AccountDetailsForExchange {
  username: string,
  identityKeyPublic: string,
  exchangeIdKeyPublic: string,
  exchangePrekeyPublic: string,
  exchangeOneTimePrekeyPublic: string,
  exchangeIdKeySignature: string,
  exchangePrekeySignature: string,
}

export interface AccountIdentity {
  username: string,
  identityKeyPublic: string,
  exchangeIdKeyPublic: string
}

export interface LocalMessage {
  id: string,
  receiverMailboxId: string,
  senderIdentityKeyPublic: string,
  encryptedPayload: string
}

export interface RemoteIncomingMessage {
  id: string,
  encryptedPayload: string,
  receiverMailboxId: string,
  senderIdentityKeyPublic: string,
  senderServer: string //server should perform DNS lookup from HTTP client IP address to fill in this value
}

export interface RemoteOutgoingMessage {
  id: string,
  encryptedPayload: string,
  senderIdentityKeyPublic: string,
  receiverMailboxId: string,
  receiverServer: string //this is filled in by client
}

export interface LocalMessageInvite {
  receiverUsername: string,
  senderUsername: string,
  encryptedPayload: string,
}

export interface RemoteIncomingMessageInvite {
  receiverUsername: string,
  senderUsername: string,
  senderServer: string,
  encryptedPayload: string,
}

export interface RemoteOutgoingMessageInvite {
  receiverUsername: string,
  senderUsername: string,
  receiverServer: string,
  encryptedPayload: string,
}

export interface FileAccessObject {
  fileUUID: string,
  accessToken: string
}


export async function createAccount(
  //use params so that this can take in a req.body object from a http request
  params: {
    username: string,
    password: string,
    mailboxId: string,
    identityKeyPublic: string,
    exchangeIdKeyPublic: string,
    exchangePrekeyPublic: string,
    exchangeOneTimePrekeysPublic: string[],
    exchangeIdKeySignature: string,
    exchangePrekeySignature: string,
  }
) : Promise<void> {

  //dont allow empty strings, maybe enforce this in database via CHECK
  params.username = params.username.trim();
  if(params.username === "" || params.username.includes(":")) {
    throw new Error(ErrorCode.INVALID_USERNAME_FOR_ACCOUNT);
  }

  const {hash, salt} = await hashPassword(params.password);

  if (
    !(await verifyKey(params.exchangeIdKeyPublic, params.exchangeIdKeySignature, params.identityKeyPublic)) ||
    !(await verifyKey(params.exchangePrekeyPublic, params.exchangePrekeySignature, params.identityKeyPublic))
  ) {
    throw new Error(ErrorCode.INVALID_SIGNATURE);
  }

  try {
    await db.begin(async db => {
      //insert account into database
      //note that postgres package automatically escapes all variables used in template string to 
      //prevent SQL injection
      await db`insert into account ${db([
        {
          username: params.username,
          identity_key_public: params.identityKeyPublic,
          password_hash: hash,
          password_salt: salt,
          mailbox_id: params.mailboxId,
          exchange_id_key_public: params.exchangeIdKeyPublic,
          exchange_id_key_signature: params.exchangeIdKeySignature,
          exchange_prekey_public: params.exchangePrekeyPublic,
          exchange_prekey_signature: params.exchangePrekeySignature
        }
      ])}`;
  
      await db`insert into one_time_prekey ${db(params.exchangeOneTimePrekeysPublic.map(
        key => {
          return {
            account_id_key: params.identityKeyPublic,
            prekey_public: key
          }
        }
      ))}`
    });
  } catch(e) {
    console.error(e);
    throw new Error(ErrorCode.ACCOUNT_CREATION_FAILED);
  }
  

}

export async function getNumPrekeys(identityKeyPublic: string) {
  let res = await db`select COUNT(*) as num_prekeys from one_time_prekey where account_id_key=${identityKeyPublic}`;
  return res[0].num_prekeys;
}

export async function addPrekeys(identityKeyPublic: string, morePrekeys: string[]) {
  await db`insert into one_time_prekey ${db(morePrekeys.map(
    key => {
      return {
        account_id_key: identityKeyPublic,
        prekey_public: key
      }
    }
  ))}`;
}

export async function getPasswordHashAndSalt(username: string) : Promise<{hash: string, salt: string} | null> {
  let res = await db`select password_hash, password_salt from account where username=${username}`;
  return res[0] ? {
    hash: res[0].password_hash,
    salt: res[0].password_salt,
  } : null;
}

export async function getUserIdentity(username: string) : Promise<AccountIdentity | null> {
  let res = await db`select identity_key_public, exchange_id_key_public from account where username=${username}`;
  return res[0] ? {
    username: username,
    identityKeyPublic: res[0].identity_key_public,
    exchangeIdKeyPublic: res[0].exchange_id_key_public,
  } : null
  
}

export async function searchForUsers(searchString: string, limit: number, ...excludeUsers: string[]) : Promise<AccountIdentity[]> {
  //if any username starts with searchString, retrieve it
  let pattern = `${searchString}%`

  let res = await db`select username, identity_key_public, exchange_id_key_public from account where username ilike ${pattern} and id not in ${db(excludeUsers)} ORDER BY username LIMIT ${limit}`;

  return res.map(row => {
    return {
      username: row.username,
      identityKeyPublic: row.identity_key_public,
      exchangeIdKeyPublic: row.exchange_id_key_public
    }
  })
}

export async function getAccountInfoForExchange(usernameOrIdentityKey: string) : Promise<AccountDetailsForExchange | null> {
  let res = await db`select 
    A.username,
    A.identity_key_public,
    A.exchange_id_key_public,
    A.exchange_id_key_signature,
    A.exchange_prekey_public,
    A.exchange_prekey_signature,
    (select prekey_public from one_time_prekey where account_id_key=A.identity_key_public LIMIT 1) as one_time_prekey
  from account as A where A.username=${usernameOrIdentityKey} OR A.identity_key_public=${usernameOrIdentityKey}`;

  let acc = res[0];

  //delete used prekey from server. Note that if the prekey fails to be deleted (due to network issue),
  //it is not the end of the world and we can let the transaction finish successfully.
  db`delete from one_time_prekey where account_id_key=${acc.identity_key_public} AND prekey_public=${acc.one_time_prekey}`.catch(e => {
    console.warn("Failed to delete one-time-prekey! " + e);
  });


  //if row 0 is undefined
  if(!acc) {
    return null;
  }

  
  return {
    username: acc.username,
    identityKeyPublic: acc.identity_key_public,
    exchangeIdKeyPublic: acc.exchange_id_key_public,
    exchangePrekeyPublic: acc.exchange_prekey_public,
    exchangeIdKeySignature: acc.exchange_id_key_signature,
    exchangePrekeySignature: acc.exchange_prekey_signature,
    exchangeOneTimePrekeyPublic: acc.one_time_prekey
  }
}

export async function saveLocalMessage(
  params: {
    id: string,
    receiverMailboxId: string,
    senderIdentityPublicKey: string,
    encryptedPayload: string,
  }
) : Promise<void> {

  await db`insert into message_local ${db([{
    id: params.id,
    sender_identity_public_key: params.senderIdentityPublicKey,
    receiver_mailbox_id: params.receiverMailboxId,
    encrypted_payload: params.encryptedPayload
  }])}`
}

export async function getLocalMessages(
  mailboxId: string,
  lastUUIDRead: string,
) : Promise<LocalMessage[]> {

  let latestMessagesOnlyQuery = lastUUIDRead ? db`insert_id > COALESCE((SELECT insert_id FROM message_local WHERE id=${lastUUIDRead}), -1)` : db``;

  let res = await db`select id, encrypted_payload, sender_identity_key_public from message_remote_incoming where receiver_mailbox_id=${mailboxId} AND ${latestMessagesOnlyQuery} ORDER BY insert_id ASC`;

  return res.map(row => {
    return {
      receiverMailboxId: mailboxId,
      senderIdentityKeyPublic: row.sender_identity_key_public,
      id: row.id,
      encryptedPayload: row.encrypted_payload
    }
  })
}

export async function saveRemoteIncomingMessage(
  params: RemoteIncomingMessage
) {

  await db`insert into message_remote_incoming ${db([{
    id: params.id,
    sender_identity_public_key: params.senderIdentityKeyPublic,
    sender_server: params.senderServer,
    receiver_mailbox_id: params.receiverMailboxId,
    encrypted_payload: params.encryptedPayload
  }])}`
}

export async function getRemoteIncomingMessages(
  mailboxId: string,
  lastUUIDRead: string,
) : Promise<RemoteIncomingMessage[]> {

  let latestMessagesOnlyQuery = lastUUIDRead ? db`insert_id > COALESCE((SELECT insert_id FROM message_remote_incoming WHERE id=${lastUUIDRead}), -1)` : db``;

  let res = await db`select id, encrypted_payload, sender_identity_key_public, sender_server from message_remote_incoming where receiver_mailbox_id=${mailboxId} AND ${latestMessagesOnlyQuery} ORDER BY insert_id ASC`;

  return res.map(row => {
    return {
      senderIdentityKeyPublic: row.sender_identity_key_public,
      senderServer: row.sender_server,
      id: row.id,
      encryptedPayload: row.encrypted_payload,
      receiverMailboxId: mailboxId
    }
  })
}

export async function saveRemoteOutgoingMessage(
  params: RemoteOutgoingMessage
) {
  
  await db`insert into message_remote_outgoing ${db([{
    id: params.id,
    receiver_server: params.receiverServer,
    receiver_mailbox_id: params.receiverMailboxId,
    encrypted_payload: params.encryptedPayload
  }])}`
}

export async function getRemoteOutgoingMessages(
  remoteServer: string,
  lastUUIDRead: string,
) : Promise<RemoteOutgoingMessage[]> {

  let latestMessagesOnlyQuery = lastUUIDRead ? db`insert_id > COALESCE((SELECT insert_id FROM message_remote_outgoing WHERE id=${lastUUIDRead}), -1)` : db``;

  let res = await db`select id, encrypted_payload, date_sent, receiver_mailbox_id from message_remote_outgoing where receiver_server=${remoteServer} AND ${latestMessagesOnlyQuery} ORDER BY insert_id ASC`;

  return res.map(row => {
    return {
      senderIdentityKeyPublic: row.sender_identity_key_public,
      id: row.id,
      receiverMailboxId: row.receiver_mailbox_id,
      receiverServer: remoteServer,
      encryptedPayload: row.encrypted_payload
    }
  })
}

export async function saveLocalInvite(
  params: LocalMessageInvite
) {

  await db`insert into message_invite_local ${db([{
    receiver_username: params.receiverUsername,
    sender_username: params.senderUsername,
    encrypted_payload: params.encryptedPayload
  }])}`;
}

export async function getLocalInvites(receiverUsername: string,) : Promise<LocalMessageInvite[]> {
  let res = await db`select sender_username, encrypted_payload from message_invite_local where receiver_username=${receiverUsername}`;

  return res.map(row => {
    return {
      senderUsername: row.sender_username,
      receiverUsername: receiverUsername,
      encryptedPayload: row.encrypted_payload
    }
  });
  
}

export async function saveRemoteIncomingInvite(params: RemoteIncomingMessageInvite) {

  await db`insert into message_invite_remote_incoming ${db([{
    receiver_username: params.receiverUsername,
    sender_server: params.senderServer,
    sender_username: params.senderUsername,
    encrypted_payload: params.encryptedPayload
  }])}`;
}

export async function getRemoteIncomingInvite(receiverUsername: string) : Promise<RemoteIncomingMessageInvite[]>{
  let res = await db`select sender_server, sender_username, encrypted_payload from message_invite_remote_incoming where receiver_username=${receiverUsername}`;
  return res.map(row => {
    return {
      senderServer: row.sender_server,
      senderUsername: row.sender_username,
      receiverUsername: receiverUsername,
      encryptedPayload: row.encrypted_payload
    }
  });
}

export async function saveRemoteOutgoingInvite(params: RemoteOutgoingMessageInvite) {

  await db`insert into message_invite_remote_outgoing ${db([{
    recipient_username: params.receiverUsername,
    recipient_server: params.receiverServer,
    sender_username: params.senderUsername,
    encrypted_payload: params.encryptedPayload
  }])}`;
}

export async function getRemoteOutgoingInvite(remoteServer: string) : Promise<RemoteOutgoingMessageInvite[]>{
  let res = await db`select receiver_username, sender_username, encrypted_payload from message_invite_remote_incoming where receiver_server=${remoteServer}`;
  return res.map(row => {
    return {
      receiverServer: remoteServer,
      senderUsername: row.sender_username,
      receiverUsername: row.receiver_username,
      encryptedPayload: row.encrypted_payload
    }
  })
}

export async function saveFile(params: FileAccessObject) {
  await db`insert into file ${db([{file_uuid: params.fileUUID, access_token: params.accessToken}])}`
}

//before retrieving a file, the user must provide the correct access token along with their uuid of the file.
//because UUIDs are not guaranteed to be generated by secure random number generators, they alone should not be used to hide data.
//the access token should be generated from a secure random number generator to solve this issue
export async function verifyAccessToFile(params: FileAccessObject) {
  let res = await db`select COUNT(*)!=0 as can_view_file from file where file_uuid=${params.fileUUID} and access_token=${params.accessToken}`;
  return !!res[0].can_view_file;
}

//no need to get file since the 