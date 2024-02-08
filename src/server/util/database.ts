import postgres from 'postgres';
import { importSignKey } from './webcrypto/ecdsa.js';

const db = postgres({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PSWD,
});

export async function createAccount(username: string, auth_key_base64: string): Promise<boolean> {
  //dont allow empty strings, maybe enforce this in database via CHECK
  if(username === "") {
    return false;
  }

  try {
    //check to see if signing key provided is valid
    await importSignKey(auth_key_base64);

    //insert account into database
    //note that postgres package automatically escapes all variables used in template string to 
    //prevent SQL injection
    await db`insert into account (id, auth_key_base64) VALUES (${username}, ${auth_key_base64})`;
    return true;
  } catch(e) {
    console.error(e);
    return false;
  }
} 

export async function getUserAuthKey(username: string) : Promise<string | null> {
  try {
    let res = await db`select auth_key_base64 from account where id=${username}`;
    return res[0].auth_key_base64 as string;
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

export async function checkIfAlreadyInvitedUser(sender: string, receiver: string, chatId?: number) : Promise<{sender: string, chat_id: number}[]>{
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

      await db`delete from pending_chat_invite WHERE chat_id=${chatId} AND invited_acct_id=${receiver}`;
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

