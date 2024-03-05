import * as aes from "../encryption/AES.js";
import { UserMessageCompleteCallbacks } from "../websocket/ChatSocketProtocol.js";

export class EncryptedMessageDecoder {
  private userMessageCallbacks;

  constructor(userMessageCallbacks: UserMessageCompleteCallbacks) {
    this.userMessageCallbacks = userMessageCallbacks;
  }

  async decodeMessage(dataEnc: string | ArrayBuffer, key: CryptoKey) {
    let val = JSON.parse(await aes.decrypt(dataEnc, key));
    //@ts-ignore
    if(!this.userMessageCallbacks[val.type as string]) {
      throw new Error("Message Type is Unknown!");
    }
    //@ts-ignore
    this.userMessageCallbacks[val.type](val);
  }
}