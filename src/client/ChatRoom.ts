import * as fetcher from "./util/ApiRepository.js";
import { StorageHandler, getDatabase } from "./util/storage/StorageHandler.js";

import { EncryptedMessageDecoder, decryptPrevMessages, formatAndSaveMessage, formatMessage, saveLastReadMessageUUID } from "./util/MessageHandler.js";
import { ChatSocketHandler, chatSocketBuilder } from "./websocket/ChatSocketProtocol.js";
import { encryptFile } from "./util/FileUpload.js";
import { KeyType } from "./shared/Constants.js";

const chatHeader = document.getElementById('chatroom-name') as HTMLHeadingElement;

const inviteContainer = document.getElementById('invite-container') as HTMLDivElement;
const inviteButton = document.getElementById("invite-button") as HTMLButtonElement;
const userSearchInput = document.getElementById("user-search-input") as HTMLInputElement;
const userSearchDataList = document.getElementById("autocomplete-results") as HTMLDataListElement;

const memberListElement = document.getElementById('member-list') as HTMLUListElement;
const messageBox = document.getElementById('message-input') as HTMLInputElement;
const messageButton = document.getElementById('send-message-button') as HTMLButtonElement;

const messagesContainer = document.getElementById('messages');

const fileUploadForm = document.getElementById('attach-file-form') as HTMLFormElement;
const inputFileAttachment = document.getElementById('file-to-attach') as HTMLInputElement;


let fileBeingUploaded: File | null = null;

const messageReceiveCallbacks = {
  "message": (data: {senderId: string, message: string}) => {
    renderMessage(data.senderId, data.message)
  },
  "file": (data: {senderId: string, message: string, filename: string, fileuuid: string}) => {
    renderMessageWithFile(data.senderId, data.message, data.filename, data.fileuuid);
  }
};

const serverMessageReceiveCallbacks = {
  "userOnline": (user: string) => {},
  "userOffline": (user: string) => {},
  "retrieveNewKey": (error: Error | null) => {},
  "messageConfirm": (chatId: number, uuid: string) => {
    saveLastReadMessageUUID(chatId, uuid);
  }
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

inputFileAttachment.onchange = (e) => {
  const fileList = inputFileAttachment.files;
  if(!fileList) {
    fileBeingUploaded = null;
    return;
  }

  if(!fileList[0]) {
    fileBeingUploaded = null;
    return;
  }

  fileBeingUploaded = fileList[0];
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

function renderMessageWithFile(userId: string, message: string, filename: string, fileuuid: string) {
  let messageBox = document.createElement('p');
  let button = document.createElement('button');
  button.textContent = 'Download ' + filename;
  button.onclick = (ev) => fetcher.getFile(fileuuid, CHAT_ID, filename);

  messageBox.textContent = `${userId} said: ${message}`;
  messageBox.appendChild(button);
  messagesContainer?.appendChild(messageBox);
}

async function sendMessage(chatSocket: ChatSocketHandler, storageHandler: StorageHandler) {
  let messageType : "message" | "file" = "message";
  let fileSig = undefined;
  let filename = undefined;

  let fileUUID = undefined;
  if(fileBeingUploaded) {
    messageType = "file";

    //encrypt file
    let encKey = (await storageHandler.getChat(CHAT_ID)).secretKey!;
    let sigKey = (await storageHandler.getKey(KeyType.IDENTITY_KEY_PAIR))!.privateKey;

    let {encFile, signatureBase64} = await encryptFile(fileBeingUploaded, encKey, sigKey);

    fileSig = signatureBase64;
    filename = fileBeingUploaded.name; //use original name, not name set on encrypted file.


    
    fileUUID = await fetcher.uploadFile(encFile, CHAT_ID);
  }


  fileBeingUploaded = null; //no longer needed
  
  let result = await formatAndSaveMessage(CHAT_ID, messageType, messageBox.value, filename, fileSig, fileUUID);
    
  chatSocket.sendMessage(result.formattedMessage)
    .then(() => {
      //@ts-ignore
      messageReceiveCallbacks[result.formattedMessage.type](result.formattedMessage);
    })
    .catch(e => {
      console.error(e);
      renderMessage("ERROR: FAILED TO SEND FOLLOWING MESSAGE", result.formattedMessage.message);
    });

  messageBox.value = '';
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
    console.log("Number of old messages", oldMessages.length);
    for(let message of oldMessages) {
      //@ts-ignore
      messageReceiveCallbacks[message.data.type](message.data);
    }

    console.log("Old messages rendered!");
  } catch(e) {
    console.error(e);
  }

  let chatSocket: ChatSocketHandler;

  //retrieve new messages, decrypt them, and render them!
  try {
    await decryptPrevMessages(CHAT_ID, DECODER);

    

    chatSocket = await chatSocketBuilder(
      CHAT_ID, 
      messageReceiveCallbacks,
      serverMessageReceiveCallbacks
    );

  } catch(e) {
    console.error(e);
    return;
  }

  messageBox.onkeyup = (ev) => {
    if(ev.key.toLowerCase() == "enter") {
      sendMessage(chatSocket, storageHandler);
    }
  }
  messageButton.onclick = (e) => {
    sendMessage(chatSocket, storageHandler);
  }
  
}

main();

