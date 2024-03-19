import * as fetcher from "./util/EasyFetch.js";
import { StorageHandler, getDatabase } from "./util/StorageHandler.js";

import { EncryptedMessageDecoder, decryptPrevMessages, formatMessage } from "./util/MessageHandler.js";
import { chatSocketBuilder } from "./websocket/ChatSocketProtocol.js";

const chatHeader = document.getElementById('chatroom-name') as HTMLHeadingElement;

const inviteContainer = document.getElementById('invite-container') as HTMLDivElement;
const inviteButton = document.getElementById("invite-button") as HTMLButtonElement;
const userSearchInput = document.getElementById("user-search-input") as HTMLInputElement;
const userSearchDataList = document.getElementById("autocomplete-results") as HTMLDataListElement;

const memberListElement = document.getElementById('member-list') as HTMLUListElement;
const messageBox = document.getElementById('message-input') as HTMLInputElement;
const messageButton = document.getElementById('send-message-button') as HTMLButtonElement;

const messagesContainer = document.getElementById('messages');


const messageReceiveCallbacks = {
  "message": (data: {senderId: string, message: string}) => {
    renderMessage(data.senderId, data.message)
  }
};

const serverMessageReceiveCallbacks = {
  "userOnline": (user: string) => {},
  "userOffline": (user: string) => {},
  "retrieveNewKey": (error: Error | null) => {}
};


const CHAT_ID = Number(new URLSearchParams(window.location.search).get("chatId") ?? "");
chatHeader.textContent = `Chat Room Id = ${CHAT_ID}`;

const DECODER = new EncryptedMessageDecoder(messageReceiveCallbacks, CHAT_ID);

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

  //render all old messages stored on client
  try {
    let oldMessages = await storageHandler.getMessages(CHAT_ID, undefined, false);
    for(let message of oldMessages) {
      if(message.data.type === "message") {
        renderMessage(message.data.senderId, message.data.message);
      }
    }

    console.log("Old messages rendered!");
  } catch(e) {
    console.error(e);
  }

  //retrieve new messages, decrypt them, and render them!
  try {
    await decryptPrevMessages(CHAT_ID, DECODER);

    

    let chatSocket = await chatSocketBuilder(
      CHAT_ID, 
      messageReceiveCallbacks,
      serverMessageReceiveCallbacks
    );

    let sendMessageCallback = async () => {
      let formattedData = await formatMessage(messageBox.value);
        
      chatSocket.sendMessage(formattedData)
        .then(() => renderMessage(storageHandler.getUsername() ?? "You", formattedData.message))
        .catch(e => {
          console.warn(e);
          renderMessage("WARNING: FAILED TO SAVE FOLLOWING MESSAGE", formattedData.message);
        });

      messageBox.value = '';
    };

    messageBox.onkeyup = (ev) => {
      if(ev.key.toLowerCase() == "enter") {
        sendMessageCallback();
      }
    }
    messageButton.onclick = (e) => {
      sendMessageCallback();
    }

  } catch(e) {
    console.error(e);
  }
  
}

main();

