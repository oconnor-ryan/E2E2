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

