import { getWebSocketHandler } from "../../websocket/SocketHandler.js";
import { ClientPage } from "../router/ClientPage.js";
import { ROUTER } from "../router/router.js";
import { Database, LOCAL_STORAGE_HANDLER, getDatabase } from "../../storage/StorageHandler.js";
import { getDefaultMessageReceivedHandlerUI } from "../components/Notification.js";
import { displayError } from "../../util/ClientError.js";
import { KnownUserEntry } from "../../storage/ObjectStore.js";
import { EncryptedPayloadBase, EncryptedRegularMessageData } from "../..//message-handler/MessageType.js";


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

    const messageContainer = document.getElementById('messages') as HTMLElement;
    const messageInput = document.getElementById('message-input') as HTMLInputElement;
    const sendMessageButton = document.getElementById('send-message-button') as HTMLButtonElement;

    const homeLink = document.getElementById('home-link') as HTMLElement;
    homeLink.onclick = (e) => {
      ROUTER.goTo('/home');
    };

    this.loadAsync(searchParams, messageContainer, messageInput, sendMessageButton);

  }

  private async loadAsync(searchParams: URLSearchParams, messageContainer: HTMLElement, messageInput: HTMLInputElement, sendMessageButton: HTMLButtonElement) {
    const db = await getDatabase();

    const user = await db.knownUserStore.get(searchParams.get('user')!);
    if(!user) {
      return ROUTER.goTo('/home');
    }

    await this.renderPrevMessages(db, user, messageContainer);


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

    sendMessageButton.onclick = (e) => {
      messageSender.sendRegularMessage(messageInput.value).catch(e => {console.error(e)});
    }
  }

  private async renderPrevMessages(db: Database, user: KnownUserEntry, messageContainer: HTMLElement) {
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
  private renderMessage(user: string, message: string, messageContainer: HTMLElement) {
    let messageBox = document.createElement('p');
    messageBox.textContent = `${user} said: ${message}`;
    messageContainer.appendChild(messageBox);
  }
}