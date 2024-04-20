import postgres from 'postgres';
import { ErrorCode, UserInfo } from '../../client/shared/Constants.js';
import { combineSaltAndHash, hashPassword } from './password-hash.js';
import { verifyKey } from './webcrypto/ecdsa.js';

const db = postgres({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PSWD,
  transform: undefined
});

export async function createAccount(
  username: string,
  password: string,
  mailboxId: string,
  identityKeyPublic: string,
  exchangeIdKeyPublic: string,
  exchangePrekeyPublic: string,
  exchangeOneTimePrekeysPublic: string[],
  exchangeIdKeySignature: string,
  exchangePrekeySignature: string,

) {

  //dont allow empty strings, maybe enforce this in database via CHECK
  if(username === "") {
    return false;
  }

  const {hash, salt} = await hashPassword(password);
  const passwordHashAndSalt = combineSaltAndHash(hash, salt);

  try {

    if (
      !(await verifyKey(exchangeIdKeyPublic, exchangeIdKeySignature, identityKeyPublic)) ||
      !(await verifyKey(exchangePrekeyPublic, exchangePrekeySignature, identityKeyPublic))
    ) {
      throw new Error(ErrorCode.INVALID_SIGNATURE);
    }

    await db.begin(async db => {
      //insert account into database
      //note that postgres package automatically escapes all variables used in template string to 
      //prevent SQL injection
      await db`insert into account ${db([
        {
          username: username,
          identity_key_public: identityKeyPublic,
          password_hash_and_salt: passwordHashAndSalt,
          mailbox_id: mailboxId,
          exchange_id_key_public: exchangeIdKeyPublic,
          exchange_id_key_signature: exchangeIdKeySignature,
          exchange_prekey_public: exchangePrekeyPublic,
          exchange_prekey_signature: exchangePrekeySignature
        }
      ])}`;

      await db`insert into one_time_prekey ${db(exchangeOneTimePrekeysPublic.map(
        key => {
          return {
            account_id_key: identityKeyPublic,
            prekey_public: key
          }
        }
      ))}`
    });

    return true;
  } catch(e) {
    console.error(e);
    return false;
  }

}

export async function getAccountInfo(usernameOrIdentityKey: string) {
  let res = await db.begin(async db => {
    let accountInfo = await db`select 
      A.username,
      A.identity_key_public,
      A.exchange_id_key_public,
      A.exchange_id_key_signature,
      A.exchange_prekey_public,
      A.exchange_prekey_signature,
      (select prekey_public from one_time_prekey where account_id_key=A.identity_key_public LIMIT 1) as one_time_prekey
    from account as A where A.username=${usernameOrIdentityKey} OR A.identity_key_public=${usernameOrIdentityKey}`;

    //delete used prekey from server
    await db`delete from one_time_prekey where account_id_key=${accountInfo[0].identity_key_public} AND prekey_public=${accountInfo[0].one_time_prekey}`;

    return accountInfo;
  });

  return res[0];

}

export async function saveIncomingMessage(
  id: string,
  receiverMailboxId: string,
  encryptedPayload: string,
) {

  await db`insert into message_incoming ${db([{
    id: id,
    receiver_mailbox_id: receiverMailboxId,
    encrypted_payload: encryptedPayload
  }])}`
}

export async function getIncomingMessages(
  mailboxId: string,
  lastUUIDRead: string,
) {

  let latestMessagesOnlyQuery = lastUUIDRead ? db`insert_id > COALESCE((SELECT insert_id FROM message_incoming WHERE id=${lastUUIDRead}), -1)` : db``;

  return await db`select id, encrypted_payload from message_incoming where receiver_mailbox_id=${mailboxId} AND ${latestMessagesOnlyQuery} ORDER BY insert_id ASC`;
}

export async function saveOutgoingMessage(
  id: string,
  receiverMailboxId: string,
  receiverServer: string,
  encryptedPayload: string,
) {
  
  await db`insert into message_outgoing ${db([{
    id: id,
    receiver_server: receiverServer,
    receiver_mailbox_id: receiverMailboxId,
    encrypted_payload: encryptedPayload
  }])}`
}

export async function getOutgoingMessages(
  remoteServer: string,
  lastUUIDRead: string,
) {

  let latestMessagesOnlyQuery = lastUUIDRead ? db`insert_id > COALESCE((SELECT insert_id FROM message_incoming WHERE id=${lastUUIDRead}), -1)` : db``;

  return await db`select id, encrypted_payload, date_sent, receiver_mailbox_id from message_incoming where receiver_server=${remoteServer} AND ${latestMessagesOnlyQuery} ORDER BY insert_id ASC`;
}

export async function saveLocalInvite(
  recipientUsername: string,
  senderUsername: string,
  encryptedPayload: string
) {

  await db`insert into message_invite_local ${db([{
    recipient_username: recipientUsername,
    sender_username: senderUsername,
    encrypted_payload: encryptedPayload
  }])}`;
}

export async function getLocalInvites(
  receipientUsername: string,
) {
  return await db`select sender_username, encrypted_payload from message_invite_local where recipient_username=${receipientUsername}`;
  
}

export async function saveIncomingInvite(
  recipientUsername: string,
  senderUsername: string,
  senderServer: string,
  encryptedPayload: string
) {

  await db`insert into message_invite_remote_incoming ${db([{
    recipient_username: recipientUsername,
    sender_server: senderServer,
    sender_username: senderUsername,
    encrypted_payload: encryptedPayload
  }])}`;
}

export async function saveOutgoingInvite(
  recipientUsername: string,
  recipientServer: string,
  senderUsername: string,
  encryptedPayload: string
) {

  await db`insert into message_invite_remote_outgoing ${db([{
    recipient_username: recipientUsername,
    recipient_server: recipientServer,
    sender_username: senderUsername,
    encrypted_payload: encryptedPayload
  }])}`;
}