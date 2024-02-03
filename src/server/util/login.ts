import { getUserAuthKey } from "./database.js";
import { verifyKey } from "./webcrypto/ecdsa.js";


export async function login(username: string, signatureBase64: string) {
  let keyBase64 = await getUserAuthKey(username);
  if(!keyBase64) {
    return false;
  }

  return await verifyKey(signatureBase64, keyBase64);
}