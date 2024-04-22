import postgres from 'postgres';
import { ErrorCode } from '../../client/shared/Constants.js';
import { hashPassword, passwordCorrect } from './password-hash.js';
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

export interface AccountIdentityWebSocket extends AccountIdentity {
  mailboxId: string
}


export interface BaseMessage {
  type: 'message' | 'message-invite'
}

//GET RID OF MESSAGE LOCAL since it has the same columns as MESSAGE INCOMING
export interface Message extends BaseMessage {
  type: 'message',
  id: string,
  receiverMailboxId: string,
  senderIdentityKeyPublic: string,
  encryptedPayload: string,
  receiverServer: string | undefined //string=outgoing message, undefined=incoming message
}

interface MessageInvite extends BaseMessage{
  type: 'message-invite'
  receiverUsername: string,
  senderUsername: string,
  encryptedPayload: string,
}

export interface MessageInviteIncoming extends MessageInvite {
  senderServer: string | undefined 
}

export interface MessageInviteOutgoing extends MessageInvite {
  receiverServer: string 
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

export async function checkIfUserPasswordCorrect(username: string, password: string) : Promise<boolean> {
  let res = await db`select password_hash, password_salt from account where username=${username}`;

  if(!res[0]) {
    return false;
  }

  return passwordCorrect(password, res[0].password_hash, res[0].password_salt);
}

export async function getUserIdentity(username: string) : Promise<AccountIdentity | null> {
  let res = await db`select identity_key_public, exchange_id_key_public from account where username=${username}`;
  return res[0] ? {
    username: username,
    identityKeyPublic: res[0].identity_key_public,
    exchangeIdKeyPublic: res[0].exchange_id_key_public,
  } : null
  
}

export async function getUserIdentityForWebSocket(username: string) : Promise<AccountIdentityWebSocket | null> {
  let res = await db`select identity_key_public, exchange_id_key_public, mailbox_id from account where username=${username}`;
  return res[0] ? {
    username: username,
    identityKeyPublic: res[0].identity_key_public,
    exchangeIdKeyPublic: res[0].exchange_id_key_public,
    mailboxId: res[0].mailbox_id
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

export async function saveMessage(params: Message) : Promise<void> {
  if(params.receiverServer) {
    await db`insert into message_incoming ${db([{
      id: params.id,
      sender_identity_public_key: params.senderIdentityKeyPublic,
      receiver_mailbox_id: params.receiverMailboxId,
      encrypted_payload: params.encryptedPayload
    }])}`
  } else  {
    await db`insert into message_outgoing ${db([{
      id: params.id,
      sender_identity_public_key: params.senderIdentityKeyPublic,
      receiver_mailbox_id: params.receiverMailboxId,
      encrypted_payload: params.encryptedPayload,
      receiver_server: params.receiverServer!
    }])}`
  }
}

export async function getIncomingMessages(mailboxId: string, lastUUIDRead: string | undefined) : Promise<Message[]> {

  let latestMessagesOnlyQuery = lastUUIDRead ? db`insert_id > COALESCE((SELECT insert_id FROM message_incoming WHERE id=${lastUUIDRead}), -1)` : db``;

  let res = await db`select id, encrypted_payload, sender_identity_key_public from message_incoming where receiver_mailbox_id=${mailboxId} AND ${latestMessagesOnlyQuery} ORDER BY insert_id ASC`;

  return res.map(row => {
    return {
      type: 'message',
      receiverMailboxId: mailboxId,
      senderIdentityKeyPublic: row.sender_identity_key_public,
      id: row.id,
      encryptedPayload: row.encrypted_payload,
      receiverServer: undefined
    }
  })
}

export async function getOutgoingMessages(remoteServer: string, lastUUIDRead: string | undefined) : Promise<Message[]> {

  let latestMessagesOnlyQuery = lastUUIDRead ? db`insert_id > COALESCE((SELECT insert_id FROM message_outgoing WHERE id=${lastUUIDRead}), -1)` : db``;

  let res = await db`select id, encrypted_payload, date_sent, receiver_mailbox_id from message_outgoing where receiver_server=${remoteServer} AND ${latestMessagesOnlyQuery} ORDER BY insert_id ASC`;

  return res.map(row => {
    return {
      type: 'message',
      senderIdentityKeyPublic: row.sender_identity_key_public,
      id: row.id,
      receiverMailboxId: row.receiver_mailbox_id,
      receiverServer: remoteServer,
      encryptedPayload: row.encrypted_payload
    }
  })
}

export async function saveInvite(params: MessageInviteIncoming | MessageInviteOutgoing) {

  //if this is an outgoing invite
  if((params as MessageInviteOutgoing).receiverServer) {
    params = params as MessageInviteOutgoing;
    await db`insert into message_invite_incoming ${db([{
      receiver_username: params.receiverUsername,
      sender_username: params.senderUsername,
      sender_server: params.receiverServer,
      encrypted_payload: params.encryptedPayload
    }])}`;
  } else {
    params = params as MessageInviteIncoming;

    await db`insert into message_invite_incoming ${db([{
      receiver_username: params.receiverUsername,
      sender_username: params.senderUsername,
      sender_server: params.senderServer,
      encrypted_payload: params.encryptedPayload
    }])}`;
  }
  
}

export async function getIncomingInvites(receiverUsername: string) : Promise<MessageInviteIncoming[]> {
  let res = await db`select sender_username, encrypted_payload, sender_server from message_invite_incoming where receiver_username=${receiverUsername}`;

  return res.map(row => {
    return {
      senderUsername: row.sender_username,
      receiverUsername: receiverUsername,
      encryptedPayload: row.encrypted_payload,
      senderServer: row.sender_server,
      type: 'message-invite'
    }
  });
  
}


export async function getOutgoingInvites(remoteServer: string) : Promise<MessageInviteOutgoing[]>{
  let res = await db`select receiver_username, sender_username, encrypted_payload from message_invite_remote_incoming where receiver_server=${remoteServer}`;
  return res.map(row => {
    return {
      receiverServer: remoteServer,
      senderUsername: row.sender_username,
      receiverUsername: row.receiver_username,
      encryptedPayload: row.encrypted_payload,
      type: 'message-invite'
    }
  });
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

