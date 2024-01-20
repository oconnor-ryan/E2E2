"use strict"

import { arrayBufferToBase64, base64ToArrayBuffer } from "./encryption/Base64.js"
import { getKeyPair, encrypt, decrypt, exportPublicKey, importPublicKey } from "./encryption/PublicKey.js"


const messageInput = document.getElementById('message-input') as HTMLInputElement;
const messageButton = document.getElementById('send-message-button') as HTMLButtonElement;
const messagesContainer = document.getElementById('messages') as HTMLDivElement;

interface UserPublicKey {
  [user: string]: CryptoKey
};

enum EncryptionType {
  PUBLIC_KEY,
  SHARED_KEY
};

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

async function receiveServerMessage(serverName: string, data: string) {
  renderOtherMessageToScreen({user: serverName, data: data});
}


//classes
abstract class EncryptTest {
  protected readonly ws: WebSocket;
  protected readonly username: string;

  constructor(username: string, webSocketUrlParams: string = '') {
    this.ws = new WebSocket("ws://localhost:3000" + webSocketUrlParams);

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

  public abstract sendEncryptedMessage(message: string): Promise<void>;

  protected abstract webSocketOpen(ev: Event): Promise<void>;
  protected abstract webSocketError(ev: Event): void;

  //when receiving messages from server
  protected abstract webSocketMessage(ev: MessageEvent<any>): void;

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
    let exportedKey = await exportPublicKey(this.MY_KEYS.publicKey);
    this.ws.send(JSON.stringify({type: "new-user", newUser: this.username, pubKey: exportedKey}));
  }

  protected webSocketError(ev: Event): void {
    console.error("Failed to connect");
    console.error(ev);
  }
  protected webSocketMessage(ev: MessageEvent<any>): void {
    let message = JSON.parse(ev.data);
    this.parseMessage(message);
  }
  protected webSocketClose(ev: CloseEvent): void {
    window.alert("WebSocket connection closed! No messages will be sent!");

  }

  private async parseMessage(data: any) {
    switch(data.type) {
      case "update-users":
        await this.updateUserList(data.allUsers);
        break;
      case "message":
        await this.receiveMessage(data.fromUser, data.data);
        break;
      case "server":
        receiveServerMessage(data.user, data.data);
        break;
    }
  }
  
  private async updateUserList(userList: {user: string, pubKey: string}[]) {
    for(let userData of userList) {
      //if user is not already in list of users
      if(!this.otherKeys[userData.user] && userData.user !== this.username) {
        this.otherKeys[userData.user] = await importPublicKey(userData.pubKey);
      }
    }
  }
  
  private async receiveMessage(fromUser: string, data: string) {
    let decrypted = await decrypt(base64ToArrayBuffer(data), this.MY_KEYS.privateKey);
  
    renderOtherMessageToScreen({user: fromUser, data: decrypted});
  }
  
  async sendEncryptedMessage(message: string) {
    let users = Object.keys(this.otherKeys);
    for(let user of users) {
      let enc = arrayBufferToBase64(await encrypt(message, this.otherKeys[user]));
      this.ws.send(JSON.stringify({type: "message", toUser: user, fromUser: this.username, data: enc}));
  
    }
  } 

}

class SharedKeyTest extends EncryptTest {
  protected webSocketOpen(ev: Event): Promise<void> {
    throw new Error("Method not implemented.");
  }
  protected webSocketError(ev: Event): void {
    throw new Error("Method not implemented.");
  }
  protected webSocketMessage(ev: MessageEvent<any>): void {
    throw new Error("Method not implemented.");
  }
  protected webSocketClose(ev: CloseEvent): void {
    throw new Error("Method not implemented.");
  }

  sendEncryptedMessage(message: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  
}

async function buildTest(user: string, encryptionType: EncryptionType) : Promise<EncryptTest> {

  switch (encryptionType) {
    case EncryptionType.PUBLIC_KEY:
      let keys = await getKeyPair();
      return new PublicKeyTest(user, keys);
    case EncryptionType.SHARED_KEY:
      return new SharedKeyTest(user);
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
  