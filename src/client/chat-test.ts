"use strict"

import { arrayBufferToBase64, base64ToArrayBuffer } from "./encryption/Base64.js"
import { getKeyPair, encrypt, decrypt, exportPublicKey, importPublicKey } from "./encryption/PublicKey.js"


interface UserPublicKey {
  [user: string]: CryptoKey
};

const USER = window.prompt("Enter your username") ?? "Default";
let otherKeys: UserPublicKey = {};

const MY_KEYS = await getKeyPair();

const messageInput = document.getElementById('message-input') as HTMLInputElement;
const messageButton = document.getElementById('send-message-button') as HTMLButtonElement;
const messagesContainer = document.getElementById('messages') as HTMLDivElement;

const ws = new WebSocket("ws://localhost:3000");

//websocket event handlers

ws.onopen = async (ev) => {
  //export public key to serer
  let exportedKey = await exportPublicKey(MY_KEYS.publicKey);
  ws.send(JSON.stringify({type: "new-user", newUser: USER, pubKey: exportedKey}));
};

ws.onerror = (ev) => {
  console.error("Failed to connect");
  console.error(ev);
};

//when receiving messages from server
ws.onmessage = async (ev) => {
  let message = JSON.parse(ev.data);
  parseMessage(message);
};

//if the WebSocket connection is lost or closed
ws.onclose = (ev) => {
  window.alert("WebSocket connection closed! No messages will be sent!");
};

//event listeners for UI elements

//send message when hitting enter while message input element is focused
messageInput.onkeyup = (ev) => {
  if(ev.key.toLowerCase() == "enter") {
    sendMessage();
  }
}

//send message when pressing the Send button
messageButton.onclick = (ev) => {
  sendMessage();
};


//functions



async function parseMessage(data: any) {
  switch(data.type) {
    case "update-users":
      await updateUserList(data.allUsers);
      break;
    case "message":
      await receiveMessage(data.fromUser, data.data);
      break;
    case "server":
      receiveServerMessage(data.user, data.data);
      break;
  }
}

async function updateUserList(userList: {user: string, pubKey: string}[]) {
  for(let userData of userList) {
    //if user is not already in list of users
    if(!otherKeys[userData.user] && userData.user !== USER) {
      otherKeys[userData.user] = await importPublicKey(userData.pubKey);
    }
  }
}

async function receiveMessage(fromUser: string, data: string) {
  let decrypted = await decrypt(base64ToArrayBuffer(data), MY_KEYS.privateKey);

  renderOtherMessageToScreen({user: fromUser, data: decrypted});
}

async function receiveServerMessage(serverName: string, data: string) {
  renderOtherMessageToScreen({user: serverName, data: data});
}

async function sendEncryptedMessage(message: string) {
  let users = Object.keys(otherKeys);
  for(let user of users) {
    let enc = arrayBufferToBase64(await encrypt(message, otherKeys[user]));
    ws.send(JSON.stringify({type: "message", toUser: user, fromUser: USER, data: enc}));

  }
} 

function sendMessage() {
  let message = messageInput.value;
  if(!message.trim()) {
    return;
  }

  renderMyMessageToScreen({user: USER, data: message}); //render user's message to screen
  messageInput.value = ''; //clear input

  sendEncryptedMessage(message).catch(e => console.error(e));
}


//renders the current user's messages to their chat box.
function renderMyMessageToScreen(message: {user: string, data: string}) {
  let container = document.createElement('div');
  container.style.backgroundColor = 'cyan';
  container.style.color = 'black';
  container.style.width = '40%';
  container.style.marginBottom = '5px';
  container.innerHTML = message.user + " said: " + message.data;

  messagesContainer.appendChild(container);
}

//renders messages from the server from other people to the chat box.
function renderOtherMessageToScreen(message: {user: string, data: string}) {
  let container = document.createElement('div');
  container.style.backgroundColor = 'orange';
  container.style.color = 'black';
  container.style.width = '40%';
  container.style.marginBottom = '5px';

  container.style.marginLeft = '60%';
  container.innerHTML = message.user + " said: " + message.data;

  messagesContainer.appendChild(container);
}
