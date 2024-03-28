import postgres from 'postgres';
import { verifyKey } from './webcrypto/ecdsa.js';
import { ErrorCode, UserInfo } from '../../client/shared/Constants.js';

const db = postgres({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PSWD,
  transform: postgres.fromCamel
});


export async function createAccount(
  username: string, 
  hash: string,
  salt: string,
  id_pubkey_base64: string,
  exchange_pubkey_base64: string,
  exchange_pubkey_sig_base64: string,
  exchange_prekey_pubkey_base64: string,
  exchange_prekey_pubkey_sig_base64: string
): Promise<boolean> {

  //dont allow empty strings, maybe enforce this in database via CHECK
  if(username === "") {
    return false;
  }

  try {

    if (
      !(await verifyKey(exchange_pubkey_base64, exchange_pubkey_sig_base64, id_pubkey_base64)) ||
      !(await verifyKey(exchange_prekey_pubkey_base64, exchange_prekey_pubkey_sig_base64, id_pubkey_base64))
    ) {
      throw new Error(ErrorCode.INVALID_SIGNATURE);
    }

    //insert account into database
    //note that postgres package automatically escapes all variables used in template string to 
    //prevent SQL injection
    await db`insert into account (
      id, 
      identity_key_base64, 
      exchange_key_base64, 
      exchange_key_signature_base64, 
      exchange_prekey_base64, 
      exchange_prekey_signature_base64,
      pwd_hash_base64,
      pwd_salt_base64
    ) VALUES (
      ${username}, 
      ${id_pubkey_base64}, 
      ${exchange_pubkey_base64}, 
      ${exchange_pubkey_sig_base64},
      ${exchange_prekey_pubkey_base64},
      ${exchange_prekey_pubkey_sig_base64},
      ${hash},
      ${salt}
    )`;
    return true;
  } catch(e) {
    console.error(e);
    return false;
  }
} 

export async function getIdentityKey(username: string) : Promise<string | null> {
  try {
    let res = await db`select identity_key_base64 from account where id=${username}`;
    return res[0].identity_key_base64 as string;
  } catch(e) {
    console.error(e);
    return null;
  }
}

export async function getUserPasswordHashAndSalt(userId: string) {
  try {
    let res = await db`select pwd_hash_base64, pwd_salt_base64 from account where id=${userId}`;
    if(!res[0]) {
      return null;
    }
    return {hashBase64: res[0].pwd_hash_base64, saltBase64: res[0].pwd_salt_base64};
  } catch(e) {
    console.error(e);
    return null;
  }
}

export async function searchUsers(searchString: string, limit: number = 10, ...excludeUsers: string[]) : Promise<string[]> {
  //if any username starts with searchString, retrieve it
  let pattern = `${searchString}%`
  try {
    let res = await db`select id from account where id ILIKE ${pattern} AND id NOT IN ${db(excludeUsers)} ORDER BY id LIMIT ${limit}`;
    return res.map(e => e.id);

  } catch(e) {
    return [];
  }
}

export async function createChat(owner: string, ...invitees: string[]) {
  try {
    let chatId = await db.begin(async db => {
      //if either function throws an error, the transaction is rolled back

      let chatId = (await db`insert into chat values (default, default) returning id`)[0].id;
      
      await db`
        insert into chat_member (acct_id, nick_name, chat_id, is_admin, can_invite)
        values (${owner}, ${owner}, ${chatId}, true, true)
      `;

      for(let member of invitees) {
        if(!(await inviteUserToChat(owner, member, chatId))) {
          throw new Error(`Unable to invite this user: ${member}`);
        }
        
      }

      return chatId;
    });

    return chatId as number;

  } catch(e) {
    console.error(e);
    return undefined;
  }
}

export async function getChatsOfUser(user: string) {
  try {
    let res = await db`
      select chat_id, acct_id from chat_member
      where chat_id IN (select chat_id from chat_member where acct_id=${user})
    `;

    let rtn: {[chat: number]: string[]} = {};
    for(let row of res) {
      if(!rtn.hasOwnProperty(row.chat_id)) {
        rtn[row.chat_id] = [];
      }

      rtn[row.chat_id].push(row.acct_id);
    }
    
    return rtn;
    
  } catch(e) {
    console.error(e);
    return null;
  }
}

export async function userInChat(chatId: number, userId: string) {
  try {
    let res = await db`select acct_id from chat_member where chat_id=${chatId} and acct_id=${userId}`;
    return res.length > 0;
  } catch(e) {
    console.error(e);
    throw new Error("Cannot Access Database!");
  }
}

export async function getChatInfo(chatId: number) {
  try {
    let res = await db`
      select acct_id, is_admin, can_invite from chat_member
      where chat_id=${chatId}
    `;

    let rtn: {members: {id: string, canInvite: boolean, isAdmin: boolean}[]} = {members: []};
    for(let row of res) {
      rtn.members.push({id: row.acct_id, canInvite: row.can_invite, isAdmin: row.is_admin});
    }
    
    return rtn;
    
  } catch(e) {
    console.error(e);
    return null;
  }
}

export async function getLatestMessages(chatId: number, lastReadMessageUUID?: string, receiversCurrentKeyExchange? : number, count?: number) : Promise<
  Array<{
    id: number,
    data_enc_base64: string,
    chat_id: number,
    key_exchange_id: number,
    message_uuid: string
  }> 
  | 
  null
> {
  let limitQuery = count ? db`limit ${count}` : db``;
  let getMessagesAfterExchangeQuery = receiversCurrentKeyExchange ? db`AND key_exchange_id >= ${receiversCurrentKeyExchange}` : db``;
  let latestMessageOnlyQuery = lastReadMessageUUID ? db`AND id > COALESCE((SELECT id FROM message WHERE message_uuid=${lastReadMessageUUID}), -1)` : db``;

  try {
    let result = await db`select * from message where chat_id=${chatId} ${latestMessageOnlyQuery} ${getMessagesAfterExchangeQuery} order by id desc ${limitQuery}`;
    return result.map(row => {
      return {
        id: row.id,
        data_enc_base64: row.data_enc_base64,
        chat_id: row.chat_id,
        key_exchange_id: row.key_exchange_id,
        message_uuid: row.message_uuid
      }
    });
  } catch(e) {
    console.error(e);
    return null;
  }
  
  
}

export async function storeMessage(
  dataEncBase64: string,
  chatId: number,
  keyExchangeId: number,
  uuid: string
) {

  try {
    await db`
      insert into message (
        data_enc_base64, 
        chat_id, 
        key_exchange_id,
        message_uuid
      )
      values (
        ${dataEncBase64},
        ${chatId},
        ${keyExchangeId},
        ${uuid}
      )
    `;
    return true;
  } catch(e) {
    console.error(e);
    return false;
  }
}

export async function inviteUserToChat(sender: string, receiver: string, chatId: number) {
  try {
    await db`
      insert into pending_chat_invite (invitor_acct_id, invited_acct_id, chat_id)
      values (${sender}, ${receiver}, ${chatId})
    `;
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function getInvitesForUser(receiver: string) : Promise<{sender: string, chat_id: number}[]>{
  try {
    let invites = await db`
      select invitor_acct_id, chat_id from pending_chat_invite 
      where invited_acct_id=${receiver}
    `;
    return invites.map(r => {return {sender: r.invitor_acct_id, chat_id: r.chat_id}});
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function checkIfAlreadyInvitedUser(receiver: string) : Promise<{sender: string, chat_id: number}[]>{
  try {
    let invites = await db`
      select invitor_acct_id, chat_id from pending_chat_invite 
      where invited_acct_id=${receiver}
    `;
    return invites.map(r => {return {sender: r.invitor_acct_id, chat_id: r.chat_id}});
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function acceptInvite(receiver: string, chatId: number, permissions?: {isAdmin?: boolean, canInvite?: boolean}) {
  if(!permissions) {
    permissions = {canInvite: false, isAdmin: false};
  }

  try {
    await db.begin(async (db) => {

      let res = await db`delete from pending_chat_invite WHERE chat_id=${chatId} AND invited_acct_id=${receiver}`;

      //if no rows were deleted, that means that there was never any invite sent to this user
      if(res.count === 0) {
        throw new Error("You were not invited to this chat room!");
      }

      await db`
        insert into chat_member (acct_id, nick_name, chat_id, is_admin, can_invite)
        values (${receiver}, ${receiver}, ${chatId}, ${permissions?.isAdmin ?? false}, ${permissions?.canInvite ?? false})
      `;
    });
    return true;
  } catch(e) {
    console.error(e);
    return false;
  }   
}

export async function getUserKeys(chatId: number) : Promise<UserInfo | null> {
  try {
    let res = await db`
    select
      id, 
      identity_key_base64, 
      exchange_key_base64, 
      exchange_key_signature_base64, 
      exchange_prekey_base64, 
      exchange_prekey_signature_base64
    from account
    where id IN (select user_id from chat_member where chat_id=${chatId})
    `;
    let row = res[0];
    return {
      id: row.id, 
      identity_key_base64: row.identity_key_base64,
      exchange_key_base64: row.exchange_key_base64,
      exchange_key_sig_base64: row.exchange_key_signature_base64,
      exchange_prekey_base64: row.exchange_prekey_base64,
      exchange_prekey_sig_base64: row.exchange_prekey_signature_base64,
    };
  } catch(e) {
    console.error(e);
    return null;
  }
}

export async function getUserKeysForChat(chatId: number) : Promise<UserInfo[] | null> {
  try {
    let res = await db`
    select
      id, 
      identity_key_base64, 
      exchange_key_base64, 
      exchange_key_signature_base64, 
      exchange_prekey_base64, 
      exchange_prekey_signature_base64
    from account
    where id IN 
      (select acct_id from chat_member where chat_id=${chatId})
    `;
    return res.map(row => {
      return {
        id: row.id, 
        identity_key_base64: row.identity_key_base64,
        exchange_key_base64: row.exchange_key_base64,
        exchange_key_sig_base64: row.exchange_key_signature_base64,
        exchange_prekey_base64: row.exchange_prekey_base64,
        exchange_prekey_sig_base64: row.exchange_prekey_signature_base64,
      };
    });
  } catch(e) {
    console.error(e);
    return null;
  }
}

export async function addKeyExchange(senderId: string, chatId: number, members: {id: string, senderKeyEncBase64: string, saltBase64: string, ephemeralKeyBase64: string}[]) : Promise<number | null> {
  try {
    let exchangeId = await db.begin(async (db) => {
      //create key exchange row to start appending keys to it
      let result1 = await db`
        insert into pending_key_exchange(
          sender_id,
          chat_id
        )
        values(
          ${senderId},
          ${chatId}
        )
        returning id
      `;

      if(!result1[0].id) {
        throw new Error("Failed to add new key exchange!");
      }

      let exchangeId = result1[0].id;

      console.log(exchangeId);

      //append all keys from key exchange for each member
      await db`
        insert into pending_key_exchange_keys 
        ${db(
          members.map((member) => {
            return {
              receiverId: member.id,
              ephemeralKeyBase64: member.ephemeralKeyBase64,
              senderKeyEncBase64: member.senderKeyEncBase64,
              saltBase64: member.saltBase64,
              exchangeId: exchangeId
            }
          })
        )}
      `;

      //db() will automatically convert array of JSON into a valid INSERT statement


      return exchangeId;
    });

    return exchangeId;
  } catch(e) {
    console.error(e);
    return null;
  }
}

export async function saveFileToDatabase(filename: string, chatId: number) : Promise<boolean>{
  try {
    await db`insert into encrypted_file(filename, chat_id) VALUES (${filename}, ${chatId})`;
    return true;
  } catch(e) {
    console.error(e);
    return false;
  }
}

export async function fileInChat(filename: string, chatId: number) : Promise<boolean> {
  try {
    let result = await db`select count(*) as does_belong from encrypted_file WHERE filename=${filename} AND chat_id=${chatId}`;
    return result.count > 0 && result[0].does_belong > 0;
  } catch(e) {
    console.error(e);
    return false;
  }
}

/**
 * Returns list of all key exchanges for a specific member of a chat
 * from oldest to newest
 * @param receiverId 
 * @param chatId 
 * @returns 
 */
export async function getKeyExchanges(receiverId: string, chatId: number, receiversCurrentKeyExchange? : number) : 
  Promise<
    {
      ephemeralKeyBase64: string,
      senderKeyEncBase64: string,
      saltBase64: string,
      exchangeId: number,
      exchangeKeyBase64: string,
      identityKeyBase64: string,
    } []
  | null
  > {

  try {
    let res = await db`
      select
        KEYS.ephemeral_key_base64,
        KEYS.sender_key_enc_base64,
        KEYS.salt_base64,
        EXCHANGE.id,
        ACCOUNT.identity_key_base64,
        ACCOUNT.exchange_key_base64

      from  
        pending_key_exchange_keys as KEYS,
        pending_key_exchange as EXCHANGE,
        account as ACCOUNT

      where
        KEYS.exchange_id = EXCHANGE.id
        AND
        ACCOUNT.id = EXCHANGE.sender_id
        AND EXCHANGE.chat_id=${chatId}
        AND KEYS.receiver_id=${receiverId}
        ${receiversCurrentKeyExchange ? db`AND EXCHANGE.id > ${receiversCurrentKeyExchange}` : db``}
      
      order by EXCHANGE.id ASC

    `;

    return res.map((row) => {
      return {
        ephemeralKeyBase64: row.ephemeral_key_base64,
        senderKeyEncBase64: row.sender_key_enc_base64,
        saltBase64: row.salt_base64,
        exchangeId: row.id,
        exchangeKeyBase64: row.exchange_key_base64,
        identityKeyBase64: row.identity_key_base64,
      }
    });
  } catch(e) {
    console.error(e);
    return null;
  }
}


/**
 * This function checks to find all chat rooms where all members in the 
 * parameter are included in the member list of a chat.
 * 
 * @param members - the account IDs for the group of users we want to check
 * @returns the chat room IDs that contain every user in the members array 
 */
export async function getChatRoomsWithTheseMembers(...members: string[]) {
  try {
    //1. Get the list of tuples that contains the chat_id and the acct_id
    //2. Group by chat_id
    //3. Only include groups where the number of members in the current
    //    group is equal to the number of members specified in the parameter
    let res = await db`
      select chat_id from (
        select chat_id, acct_id
        from chat_member 
        where acct_id IN ${db(members)}
      )
      group by chat_id
      HAVING COUNT(acct_id)=${members.length}

    `;
    return res.map(e => e.chat_id);

  } catch(e) {
    console.error(e);
    return [];
  }
}


/**
 * This function is similar to {@link getChatRoomsWithTheseMembers}, except this 
 * searches for chat rooms whose member list matches exactly with the ones 
 * specified in members parameter.
 * 
 * @param members - the account IDs for the group of users we want to check
 * @returns the IDs of the chat who's member list matches with members.
 */
export async function getChatRoomsWithTheseMembersOnly(...members: string[]) {
  try {
    //1. Get the list of tuples that contains the chat_id and the acct_id
    //2. Group by chat_id
    //3. Only include groups where the number of members in the current
    //    group is equal to the number of members specified in the parameter
    //4. Only include groups where the number of members in the ENTIRE chat is 
    //    equal to the number of members in the parameter
    let res = await db`
      select SELECT_CM.chat_id from (
        select chat_id, acct_id
        from chat_member 
        where acct_id IN ${db(members)}
      ) as SELECT_CM
      group by SELECT_CM.chat_id
      HAVING COUNT(acct_id)=${members.length}
      AND ${members.length}=(
        select count(*) from chat_member as CM 
        where CM.chat_id=SELECT_CM.chat_id
      )
    `;

    return res.map(e => e.chat_id as string);

  } catch(e) {
    console.error(e);
    return [];
  }
}

