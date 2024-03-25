"use strict"

import { arrayBufferToBase64, base64ToArrayBuffer } from "./util/Base64.js"
import * as rsa from "./encryption-old/PublicKey.js";
import * as aes from "./encryption-old/AES.js";



interface UserPublicKey {
  [user: string]: CryptoKey
};

enum EncryptionType {
  PUBLIC_KEY,
  SHARED_KEY
};

enum Public_ServerToClientMessageTypes {
  SERVER = "server",
  UPDATE_USERS = "update-users",
  MESSAGE = "message",
}

enum Public_ClientToServerMessageTypes {
  MESSAGE = "message",
  NEW_USER = "new-user"
}



const messageInput = document.getElementById('message-input') as HTMLInputElement;
const messageButton = document.getElementById('send-message-button') as HTMLButtonElement;
const messagesContainer = document.getElementById('messages') as HTMLDivElement;

const chatInfoContainer = document.getElementById('chat-info-box') as HTMLDivElement;


/**** Functions for Rendering ****/

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

function renderChatInfo(users: string[]) {
  chatInfoContainer.innerHTML = "<p>Connected users</p><ul>";
  for(let user of users) {
    chatInfoContainer.innerHTML += `<li>${user}</li>`;
  }
  chatInfoContainer.innerHTML += `</ul>`;
}

async function receiveServerMessage(serverName: string, data: string) {
  renderOtherMessageToScreen({user: serverName, data: data});
}




//classes
abstract class EncryptTest {
  protected readonly ws: WebSocket;
  protected readonly username: string;

  constructor(username: string, webSocketUrlParams: string = '') {
    let protocol = window.isSecureContext ? "wss://" : "ws://";
    this.ws = new WebSocket(`${protocol}${window.location.host}${webSocketUrlParams}`);

    //must bind listeners to WebSocket in same scope as 
    //WebSocket constructor, otherwise you
    //can miss the onOpen and onError events.

    //must call bind in order to use this object instance's methods
    this.ws.onopen = this.webSocketOpen.bind(this);
    this.ws.onerror = this.webSocketError.bind(this);
    this.ws.onmessage = this.webSocketMessage.bind(this);
    this.ws.onclose = this.webSocketClose.bind(this);

    this.username = username;
  }

  protected webSocketSendJSON(data: any) : void {
    this.ws.send(JSON.stringify(data));
  }


  //when sending data to server
  public abstract sendEncryptedMessage(message: string): Promise<void>;


  protected abstract webSocketOpen(ev: Event): Promise<void>;
  protected abstract webSocketError(ev: Event): void;

  protected abstract webSocketMessage(ev: MessageEvent<any>) : void | Promise<void>;

  //if the WebSocket connection is lost or closed
  protected abstract webSocketClose(ev: CloseEvent): void;



}

class PublicKeyTest extends EncryptTest {
  private otherKeys: UserPublicKey = {};
  private readonly MY_KEYS: CryptoKeyPair;

  constructor(username: string, keys: CryptoKeyPair) {
    super(username, "?enc_type=public");
    this.MY_KEYS = keys;
  } 


  protected async webSocketOpen(ev: Event): Promise<void> {
    //export public key to serer
    let exportedKey = await rsa.exportPublicKey(this.MY_KEYS.publicKey);
    this.webSocketSendJSON({
      type: Public_ClientToServerMessageTypes.NEW_USER, 
      newUser: this.username, 
      pubKey: exportedKey
    });
  }

  protected webSocketError(ev: Event): void {
    console.error("Failed to connect");
    console.error(ev);
  }
  protected async webSocketMessage(ev: MessageEvent<any>) {
    let jsonData = JSON.parse(ev.data);

    switch(jsonData.type) {
      case Public_ServerToClientMessageTypes.UPDATE_USERS:
        await this.updateUserList(jsonData.allUsers);
        break;
      case Public_ServerToClientMessageTypes.MESSAGE:
        await this.receiveMessage(jsonData.fromUser, jsonData.data);
        break;
      case Public_ServerToClientMessageTypes.SERVER:
        receiveServerMessage(jsonData.user, jsonData.data);
        break;
    }
  }
  protected webSocketClose(ev: CloseEvent): void {
    window.alert("WebSocket connection closed! No messages will be sent!");

  }

  
  private async updateUserList(userList: {user: string, pubKey: string}[]) {
    renderChatInfo(userList.map(u => u.user));

    for(let userData of userList) {
      //if user is not already in list of users
      if(!this.otherKeys[userData.user] && userData.user !== this.username) {
        this.otherKeys[userData.user] = await rsa.importPublicKey(userData.pubKey);
      }
    }
  }
  
  private async receiveMessage(fromUser: string, data: string) {
    let decrypted = await rsa.decrypt(base64ToArrayBuffer(data), this.MY_KEYS.privateKey);
  
    renderOtherMessageToScreen({user: fromUser, data: decrypted});
  }
  
  async sendEncryptedMessage(message: string) {
    let users = Object.keys(this.otherKeys);
    for(let user of users) {
      let enc = arrayBufferToBase64(await rsa.encrypt(message, this.otherKeys[user]));

      this.webSocketSendJSON({
        type: Public_ClientToServerMessageTypes.MESSAGE, 
        toUser: user, 
        fromUser: this.username, 
        data: enc
      });
  
    }
  } 
}

class SharedKeyTest extends EncryptTest {
  protected pubKeyPair: CryptoKeyPair;
  protected sharedKey: CryptoKey | undefined;

  constructor(username: string, keyPair: CryptoKeyPair, room: string | null) {
    //super(username, `?enc_type=shared&name=${username}&pubKey=${exportedPubKey}`);
    super(username, `?enc_type=shared&room_id=${room ?? "null"}`);
    this.pubKeyPair = keyPair;
  }
  
  protected async webSocketOpen(ev: Event): Promise<void> {
    console.log("Connected to WebSocket!");
    let exportedPubKey = await rsa.exportPublicKey(this.pubKeyPair.publicKey);
    this.ws.send(JSON.stringify({type: 'new-user', name: this.username, pubKey: exportedPubKey}));
  }

  protected webSocketError(ev: Event): void {
    console.error("Failed to connect");
    console.error(ev);
  }

  //parse messages received from web server
  protected async webSocketMessage(ev: MessageEvent<any>): Promise<void> {
    let data = JSON.parse(ev.data);

    console.log("Message Received: " + data);

    switch(data.type) {
      case "server":
        receiveServerMessage("Server", data.message);
        break;
      case "update-user-list":
        renderChatInfo(data.names);
        break;
      //remote user is asking for shared key
      case "share-key-request":
        await this.handleShareKeyRequest(data);
        break;

      case "share-key-response":
        await this.handleShareKeyResponse(data);
        break;

      //server is requesting you to generate shared key for chat
      case "share-key-generate":
        //generate shared key
        await this.handleGenerateKey(data);
        break;
      
      //message being received from a user.
      case "message":
        await this.handleMessage(data);
        break;
      default: 
        console.warn(`Message type ${data.type} not supported!`);
    }
  }
  protected webSocketClose(ev: CloseEvent): void {
    window.alert("WebSocket connection closed! No messages will be sent!");

  }

  async sendEncryptedMessage(message: string): Promise<void> {
    if(!this.sharedKey) {
      renderMyMessageToScreen({user: "Error", data: "You do not have a shared key to encrypt that message!"});
      console.error("You do not have a shared key to encrypt that message!");
      return;
    }
    //encrypt message using shared key
    let encBase64Message = await aes.encrypt(message, this.sharedKey);

    //send message to server
    this.webSocketSendJSON({type: "message", senderName: this.username, encMessage: encBase64Message});
  }
  

  protected async handleShareKeyRequest(data: any) {
    if(!this.sharedKey) {
      //send null key
      this.ws.send(JSON.stringify({type: "share-key-response", userId: data.userId, encSharedKey: null}));
      return;
    }
    //encrypt shared key with remote user's public key
    console.log("Pub Key", data.pubKey)
    let pubKey = await rsa.importPublicKey(data.pubKey);
    let exportedKey = await aes.exportKeyAsBase64(this.sharedKey);
    let encSharedKeyBase64 = arrayBufferToBase64(await rsa.encrypt(exportedKey, pubKey));

    //send encrypted key to user
    this.webSocketSendJSON({type: "share-key-response", userId: data.userId, encSharedKey: encSharedKeyBase64});
  }

  protected async handleShareKeyResponse(data: any) {
    let encSharedKey = data.encSharedKey;
    let senderId = data.userId;

    if(encSharedKey == null) {
      console.error("No encrypted shared key was given!");
      this.webSocketSendJSON({type: "share-key-received", gotKey: false, originalKeyOwner: senderId});
      return;
    }

    try {
      let base64SharedKey = await rsa.decrypt(base64ToArrayBuffer(encSharedKey), this.pubKeyPair.privateKey);
  
      console.log("AES key = ", base64SharedKey);

      this.sharedKey = await aes.importKey(base64SharedKey);
      console.log(this.sharedKey);
      this.webSocketSendJSON({type: "share-key-received", gotKey: true, originalKeyOwner: senderId});

    } catch(e) {
      this.webSocketSendJSON({type: "share-key-received", gotKey: false, originalKeyOwner: senderId});
    }

    
  }

  protected async handleGenerateKey(data: any) {
    this.sharedKey = await aes.generateAESKey(true);
    console.log("AES key = ", await aes.exportKeyAsBase64(this.sharedKey));
    let exportedPubKey = await rsa.exportPublicKey(this.pubKeyPair.publicKey);
    console.log("Generating key");
    this.webSocketSendJSON({type: "share-key-generate", name: this.username, pubKey: exportedPubKey});
  }

  protected async handleMessage(data: any) {
    let senderName = data.senderName;
    if(!this.sharedKey) {
      let errMessage = `You do not have a shared key to decrypt the message from ${senderName}!`;
      console.error(errMessage);
      renderOtherMessageToScreen({user: senderName, data: errMessage});
      return;
    }

    //get shared key, decrypt message, render message to screen
    let decrypted = await aes.decrypt(data.encMessage, this.sharedKey);

    renderOtherMessageToScreen({user: senderName, data: decrypted});
    
  }
}

//this class is used for malicious clients who modified
//their JS in order to lock clients out of chat,
//attack the server, etc
class EvilSharedKeyTest extends SharedKeyTest {

  //always send null shared key to other clients
  protected async handleShareKeyRequest(data: any) {
    let temp = this.sharedKey;
    this.sharedKey = undefined;
    await super.handleShareKeyRequest(data);
    this.sharedKey = temp;
  }
}

async function buildTest(user: string, encryptionType: EncryptionType) : Promise<EncryptTest> {

  switch (encryptionType) {
    case EncryptionType.PUBLIC_KEY:
      return new PublicKeyTest(user, await rsa.getKeyPair());

    case EncryptionType.SHARED_KEY:
      let keys = await rsa.getKeyPair();
      let room = window.prompt("What is the room number you want to join?");
      let evil = window.confirm("Are you evil? (Ok for yes, Cancel for no)");
      return evil ? new EvilSharedKeyTest(user, keys, room) : new SharedKeyTest(user, keys, room);
    default:
      throw new Error(`Encryption type ${encryptionType} is invalid!`);
  }

}



//immediately invoked main function
(async () => {
  const encryptionType = window.location.href.endsWith("?enc_type=shared") ? EncryptionType.SHARED_KEY : EncryptionType.PUBLIC_KEY;

  const user = window.prompt("Enter your username") ?? "Default";

  const test: EncryptTest = await buildTest(user, encryptionType);


  let sendMessage = () => {
    let message = messageInput.value;
    if(!message.trim()) {
      return;
    }
  
    renderMyMessageToScreen({user: user, data: message}); //render user's message to screen
    messageInput.value = ''; //clear input
  
    test.sendEncryptedMessage(message).catch(e => console.error(e));
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
})();
  