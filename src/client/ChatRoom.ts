import * as fetcher from "./util/EasyFetch.js";
import { StorageHandler, getDatabase } from "./util/StorageHandler.js";
import * as ecdh from "./encryption/ECDH.js";
import * as ecdsa from "./encryption/ECDSA.js";

import * as aes from "./encryption/AES.js";
import { x3dh_receiver } from "./util/X3DH.js";
import { KeyType } from "./shared/Constants.js";
import { decodeMessage } from "./util/MessageDecoder.js";
import { chatSocketBuilder } from "./websocket/ChatSocketProtocol.js";
import { importKey } from "./util/KeyExchange.js";

const chatHeader = document.getElementById('chatroom-name') as HTMLHeadingElement;

const inviteContainer = document.getElementById('invite-container') as HTMLDivElement;
const inviteButton = document.getElementById("invite-button") as HTMLButtonElement;
const userSearchInput = document.getElementById("user-search-input") as HTMLInputElement;
const userSearchDataList = document.getElementById("autocomplete-results") as HTMLDataListElement;

const memberListElement = document.getElementById('member-list') as HTMLUListElement;
const messageBox = document.getElementById('message-input') as HTMLInputElement;
const messageButton = document.getElementById('send-message-button') as HTMLButtonElement;

const messagesContainer = document.getElementById('messages');

const CHAT_ID = Number(new URLSearchParams(window.location.search).get("chatId") ?? "");
chatHeader.textContent = `Chat Room Id = ${CHAT_ID}`;

userSearchInput.oninput = async (e) => {
  //@ts-ignore
  let searchString = e.target.value;

  console.log(searchString);
  if(searchString.length < 1) {
    return;
  }

  let users = await fetcher.searchUsers(searchString);

  userSearchDataList.innerHTML = "";

  for(let user of users) {
    userSearchDataList.innerHTML += `<option value="${user}"></option>`;
  }
};

inviteButton.onclick = async (e) => {
  let invitedUser = userSearchInput.value;

  try {
    await fetcher.invite(invitedUser, CHAT_ID);
  } catch(e) {
    window.alert("Failed to invite user!");
  }

  window.alert("Successfully invited user!");
}

function renderMembers(storageHandler: StorageHandler, members: {id: string, canInvite: boolean, isAdmin: boolean}[]) {
  for(let member of members) {
    let listItem = document.createElement('li');
    listItem.textContent = member.id + " (Offline)";
    memberListElement.appendChild(listItem);

    if(member.id === storageHandler.getUsername() && !member.canInvite) {
      inviteContainer.remove(); //prevent this user from inviting other people
    }
  }
}

function renderMessage(userId: string, message: string) {
  let messageBox = document.createElement('p');
  messageBox.textContent = `${userId} said: ${message}`;
  messagesContainer?.appendChild(messageBox);
}

async function decryptPrevMessages(
  exchanges: {
    ephemeralKeyBase64: string;
    senderKeyEncBase64: string;
    saltBase64: string;
    exchangeId: number;
    exchangeKeyBase64: string;
    identityKeyBase64: string;
  }[],
  messages: {
    id: number;
    data_enc_base64: string;
    sender_id: string;
    chat_id: number;
    key_exchange_id: number;
  }[]
) {

  if(messages.length === 0) {
    return;
  }

  let storageHandler = await getDatabase();

  let myExchangeKeyPrivate = (await storageHandler.getKey(KeyType.EXCHANGE_ID_PAIR) as CryptoKeyPair).privateKey;
  let myExchangePreKeyPrivate = (await storageHandler.getKey(KeyType.EXCHANGE_PREKEY_PAIR) as CryptoKeyPair).privateKey;


  let exchangeWithImportedKeys: {
    [id: string] : {
      ephemeralKeyPublic: CryptoKey,
      senderKeyEncBase64: string;
      saltBase64: string;
      exchangeKeyPublic: CryptoKey;
      identityKeyPublic: CryptoKey;
    }
  } = {};

  for(let exchange of exchanges) {
    exchangeWithImportedKeys[String(exchange.exchangeId)] = {
      ephemeralKeyPublic: await ecdh.importPublicKey(exchange.ephemeralKeyBase64),
      exchangeKeyPublic: await ecdh.importPublicKey(exchange.exchangeKeyBase64),
      identityKeyPublic: await ecdsa.importPublicKey(exchange.identityKeyBase64),
      saltBase64: exchange.saltBase64,
      senderKeyEncBase64: exchange.senderKeyEncBase64
    }
  }

  if(exchanges.length === 0) {
    let senderKey = (await storageHandler.getChat(CHAT_ID)).secretKey!;
    for(let message of messages) {
      let messageJSON = await decodeMessage(message.data_enc_base64, senderKey);

      switch(messageJSON.type) {
        case "message":
          renderMessage(messageJSON.userId, messageJSON.message);
          break;
      }
    }
    return;
  }

  for(let message of messages) {
    let exchangeData = exchangeWithImportedKeys[message.key_exchange_id];

    let secretKey = (await x3dh_receiver(
      myExchangeKeyPrivate,
      myExchangePreKeyPrivate,
      exchangeData.exchangeKeyPublic,
      exchangeData.ephemeralKeyPublic,
      exchangeData.saltBase64
    )).secretKey;

    let senderKey = await aes.upwrapKey(exchangeData.senderKeyEncBase64, secretKey);

    let decryptedMessageJSON = await decodeMessage(message.data_enc_base64, senderKey);

    if(decryptedMessageJSON.type !== "message") {
      continue;
    }

    renderMessage(decryptedMessageJSON.userId, decryptedMessageJSON.message);
  }

}


async function main() {
  if(Number.isNaN(CHAT_ID)) {
    window.location.replace("/test/chatlist");
    return;
  }

  let storageHandler = await getDatabase();

  try {
    let chatInfo = await fetcher.getChatInfo(CHAT_ID);
    renderMembers(storageHandler, chatInfo.members);
  } catch(e) {
    console.error(e);
    window.location.replace("/test/chatlist");
  }

  try {
    let exchanges = await fetcher.getKeyExchanges(CHAT_ID);
    let messages = await fetcher.getLatestMessages(CHAT_ID);
    //in future, we will render messages differently to take advantage of having newest to oldest order.
    messages.reverse(); //for now, display messages in correct order.
    await decryptPrevMessages(exchanges, messages);

    console.log("HERE")
    //take the newest key exchange and import it into IndexedDB
    if(exchanges.length > 0) {
      let newestExchange = exchanges[exchanges.length-1];


      await importKey(CHAT_ID, {
        ephemeralKeyBase64: newestExchange.ephemeralKeyBase64,
        exchangeKeyBase64: newestExchange.exchangeKeyBase64,
        senderKeyEncBase64: newestExchange.senderKeyEncBase64,
        saltBase64: newestExchange.saltBase64,
        keyExchangeId: newestExchange.exchangeId,
        identityKeyBase64: newestExchange.identityKeyBase64
      });

      console.log("HERE1")

    }

    let messageReceiveCallbacks = {
      "message": renderMessage
    };

    let serverMessageReceiveCallbacks = {
      "userOnline": (user: string) => {},
      "userOffline": (user: string) => {},
      "retrieveNewKey": (error: Error | null) => {}
    };

    let chatSocket = await chatSocketBuilder(
      CHAT_ID, 
      messageReceiveCallbacks,
      serverMessageReceiveCallbacks
    );
    console.log("HERE2")


    messageBox.onkeyup = (ev) => {
      if(ev.key.toLowerCase() == "enter") {
        chatSocket.sendMessage(messageBox.value);
        messageBox.value = '';
      }
    }
    messageButton.onclick = (e) => {
      chatSocket.sendMessage(messageBox.value);
      messageBox.value = '';

    }

  } catch(e) {
    console.error(e);
  }
  
}

main();

