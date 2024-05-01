import { getWebSocketHandler } from "../../websocket/SocketHandler.js";
import { ClientPage } from "../router/ClientPage.js";
import { ROUTER } from "../router/router.js";
import { Database, LOCAL_STORAGE_HANDLER, getDatabase } from "../../storage/StorageHandler.js";
import { getDefaultMessageReceivedHandlerUI } from "../components/Notification.js";
import { displayError } from "../../util/ClientError.js";
import { KnownUserEntry } from "../../storage/ObjectStore.js";
import { EncryptedPayloadBase, EncryptedRegularMessageData } from "../..//message-handler/MessageType.js";
import { SocketMessageSender } from "src/client/message-handler/MessageSender.js";


export class ChatPage extends ClientPage {
  load(rootElement: HTMLElement): void {
    let searchParams = new URLSearchParams(window.location.search);

    rootElement.innerHTML = `
      <style>
      body {
        min-height: 100vh;
      }
      #messages {
        margin-bottom: 20%;
      }
      #chat-info-box {
        min-height: 100px;
      }
      #message-input-container {
        position: fixed;
        bottom: 0;
        left: 5%;

        box-sizing: border-box;

        margin: 10px auto;
      
        width: 90%;  
        height: 30px;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
      }

      #attach-file-form {
        box-sizing: border-box; /*Border box needed so that border is counted in width and height*/

        flex: 10%;
        height: inherit;
        display: inline-block;
        border: 1px solid black;
      }

      .attach-file-button {
        box-sizing: border-box; /*Border box needed so that border is counted in width and height*/

        width: 100%;
        height: 100%;
        padding: 1px;
        text-align: center;
        display: inline-block;
        cursor: pointer;
      }

      #message-input {
        flex: 80%;
      }

      #send-message-button {
        flex: 10%;
      }
      </style>

      <h1 id="chatroom-name"></h1>
      <p id="home-link">Back to Home</p>

      <h2>Members</h2>
      <ul id="member-list"></ul>


      <h2>Messages</h2>
      <div id="messages"></div>

      <div id="message-input-container">
        <form id="attach-file-form" enctype="multipart/form-data">
          <label class="attach-file-button" for="file-to-attach">Add File</label>
          <input id="file-to-attach" style="display: none" type="file"/>
        </form>
        <input type="text" id="message-input"/>
        <button id="send-message-button">Send</button>
      </div>
    `;


    const homeLink = document.getElementById('home-link') as HTMLElement;
    homeLink.onclick = (e) => {
      ROUTER.goTo('/home');
    };

    this.loadAsync(searchParams);

  }

  private async loadAsync(searchParams: URLSearchParams) {
    const db = await getDatabase();

    let userIdKey = searchParams.get('user');
    let groupId = searchParams.get('groupId');

    if(userIdKey) {
      await this.loadOneToOneChat(db, userIdKey);
    } else if(groupId) {
      await this.loadGroupChat(db, groupId);
    } else {
      const messageContainer = document.getElementById('messages') as HTMLElement;
      messageContainer.innerHTML = "No user or groupId specified in URL.";
    }


    
  }

  private async loadOneToOneChat(db: Database, userIdKey: string) {
    const sendMessageButton = document.getElementById('send-message-button') as HTMLButtonElement;
    const messageContainer = document.getElementById('messages') as HTMLElement;
    const messageInput = document.getElementById('message-input') as HTMLInputElement;

    const user = await db.knownUserStore.get(userIdKey);
    
    if(!user) {
      messageContainer.innerHTML = "No user found with the identity key specified!";
      return;
    }

    await this.renderPrevMessagesOneToOne(db, user, messageContainer);


    let messageReceiver = getDefaultMessageReceivedHandlerUI();
    let websocket = getWebSocketHandler(db, messageReceiver);

    messageReceiver.onmessage = async (request, messageSaved, error) => {
      if(error) {
        return displayError(error);
      }

      let username = user.identityKeyPublicString === request.senderIdentityKeyPublic ? user.username : LOCAL_STORAGE_HANDLER.getUsername()!;
      if(request.payload?.type === 'text-message') {
        this.renderMessage(username, (request.payload as EncryptedRegularMessageData).data.message, messageContainer);
      }
    };
      
    let messageSender = await websocket.messageSenderBuilder.buildMessageSender(user.identityKeyPublicString, 'individual-key');
    this.setupMessageSender(messageSender);
    
  }

  private async loadGroupChat(db: Database, groupId: string) {
    const messageContainer = document.getElementById('messages') as HTMLElement;

    let group = await db.groupChatStore.get(groupId);
    if(!group) {
      messageContainer.innerHTML = "No group found with ID specified";
      return;
    }

    let messageReceiver = getDefaultMessageReceivedHandlerUI();
    let members = await Promise.all(group.members.map(m => db.knownUserStore.get(m.identityKeyPublicString))) as KnownUserEntry[];

    messageReceiver.onmessage = async (request, messageSaved, error) => {
      if(error) {
        return displayError(error);
      }

      if(request.payload.type === 'text-message') {
        let username = "";
        let sender = members.find(u => request.senderIdentityKeyPublic === u.identityKeyPublicString);
        if(!sender) {
          username = "::::I AM NOT A MEMBER::::"; 
        } else {
          username = sender.username;
        }
        
        this.renderMessage(username, (request.payload as EncryptedRegularMessageData).data.message, messageContainer);
      }
    };

    const websocketHandler = getWebSocketHandler(db, messageReceiver);

    //note that using await will cause a message that is sent around this time to not render on screen.
    let messageSender = await websocketHandler.messageSenderBuilder.buildMessageSender(groupId, 'groupId');

    this.setupMessageSender(messageSender);
  }

  private async renderPrevMessagesOneToOne(db: Database, user: KnownUserEntry, messageContainer: HTMLElement) {
    const messages = await db.messageStore.getMessages(user.identityKeyPublicString, 'individual');
    for(let message of messages) {
      //make sure to store user info for each member of chat to avoid grabbing each member
      //through a database for each message
      let username = user.identityKeyPublicString === message.senderIdentityKeyPublic ? user.username : LOCAL_STORAGE_HANDLER.getUsername()!;
      if(message.payload?.type === 'text-message') {
        let data = message.payload?.data as EncryptedRegularMessageData;
        this.renderMessage(username, data.data.message, messageContainer);

      }
    } 
  }

  private async renderPrevMessagesGroup(db: Database, groupId: string, otherMembers: KnownUserEntry[], messageContainer: HTMLElement) {
    const messages = await db.messageStore.getMessages(groupId, 'group');
    let myIdKey = await (await db.accountStore.get(LOCAL_STORAGE_HANDLER.getUsername()!))!.identityKeyPair.publicKey.exportKey();

    for(let message of messages) {
      //make sure to store user info for each member of chat to avoid grabbing each member
      //through a database for each message

      let username = "";
      let sender = otherMembers.find(u => u.identityKeyPublicString === message.senderIdentityKeyPublic);
      if(!sender) {
        username = myIdKey === message.senderIdentityKeyPublic ? LOCAL_STORAGE_HANDLER.getUsername()! : "::::I AM NOT A MEMBER::::";
      }

      if(message.payload?.type === 'text-message') {
        let data = message.payload?.data as EncryptedRegularMessageData;
        this.renderMessage(username, data.data.message, messageContainer);

      }
    } 
  }

  private setupMessageSender(messageSender: SocketMessageSender) {
    const sendMessageButton = document.getElementById('send-message-button') as HTMLButtonElement;
    const messageInput = document.getElementById('message-input') as HTMLInputElement;
    const messageContainer = document.getElementById('messages') as HTMLElement;


    const send = async () => {
      try {
        await messageSender.sendRegularMessage(messageInput.value);
        this.renderMessage(LOCAL_STORAGE_HANDLER.getUsername()!, messageInput.value, messageContainer);
        messageInput.value = "";

      } catch(e) {
        displayError(e as Error);
      }
    }
    
    sendMessageButton.onclick = send;
    messageInput.onkeyup = (ev) => {
      if(ev.key.toLowerCase() === 'enter') {
        send();
      }
    }
  }
  private renderMessage(user: string, message: string, messageContainer: HTMLElement) {
    let messageBox = document.createElement('p');
    messageBox.textContent = `${user} said: ${message}`;
    messageContainer.appendChild(messageBox);
  }
}