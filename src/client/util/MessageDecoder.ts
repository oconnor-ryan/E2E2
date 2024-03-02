import * as aes from "../encryption/AES.js";

export async function decodeMessage(dataEncBase64: string | ArrayBuffer, key: CryptoKey) {
  return JSON.parse(await aes.decrypt(dataEncBase64, key));
}