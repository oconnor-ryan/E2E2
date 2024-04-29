import { ClientPage } from "../router/ClientPage.js";
import { acceptInvite, inviteUser } from "../../util/Actions.js";
import { MessageSenderBuilder } from "../../message-handler/MessageSender.js";
import { getDatabase, Database } from "../../storage/StorageHandler.js";
import { getDefaultMessageReceivedHandlerUI } from "../components/Notification.js";
import { getWebSocketHandler } from "../../websocket/SocketHandler.js";
import { UserSearchElement } from "../components/AutoComplete.js";
import { ROUTER } from "../router/router.js";




export class HomePage extends ClientPage {
  load(rootElement: HTMLElement): void {

    rootElement.innerHTML = `
      <h2>One-to-One Chats</h2>
      <div id="one-to-one-chat-list"></div>

      <h2>Invite People</h2>
      <div id="user-search-root"></div>

      <h2>Your Group Chats</h2>
      <div id="group-chat-list"></div>
      <button id="add-group-button">Add Group</button>
    
      <h2>Invitations</h2>
      <div id="invitation-list"></div>

    `;

    //its probably better to use createElement and keep the elements as fields in
    //this class rather than defining innerHTML and
    //calling getElementById, but doing it the first way is annoying
    const oneToOneChatListElement = document.getElementById('one-to-one-chat-list') as HTMLDivElement;
    const groupChatListElement = document.getElementById('group-chat-list') as HTMLDivElement;
    const addGroupChatButtonElement = document.getElementById('add-group-button') as HTMLButtonElement;
    const invitationList = document.getElementById('invitation-list') as HTMLDivElement;

    this.loadData(oneToOneChatListElement, groupChatListElement, addGroupChatButtonElement, invitationList);
  }

  private async loadData(oneToOneChatElement: HTMLElement, groupChatListElement: HTMLElement, addGroupButton: HTMLButtonElement, invitationList: HTMLElement) {
    const db = await getDatabase();

    let messageReceiver = getDefaultMessageReceivedHandlerUI();
    let oldKeyExchangeReceiver = messageReceiver.onkeyexchangerequest;
    let oldBatchedMessageReceiver = messageReceiver.onbatchedmessage;


    let websocket = getWebSocketHandler(db, messageReceiver);

    messageReceiver.onkeyexchangerequest = async (request, error) => {
      oldKeyExchangeReceiver(request, error);
      if(error) {
        return;
      }
      await this.renderInvites(db, invitationList, websocket.messageSenderBuilder);
    };

    messageReceiver.onbatchedmessage = async (numMessagedSave, numInvitesSaved) => {
      oldBatchedMessageReceiver(numMessagedSave, numInvitesSaved)
      await this.renderInvites(db, invitationList, websocket.messageSenderBuilder);
    };

    const userSearch = new UserSearchElement(async (username: string) => {
      inviteUser(db, username, await websocket.inviteSenderBuilder.buildInviteSender()).catch(e => {
        console.error(e);
      });
    });
    userSearch.render(document.getElementById('user-search-root')!);

    await this.renderOneToOneChats(db, oneToOneChatElement);
    await this.renderGroupChats(db, groupChatListElement);
    await this.renderInvites(db, invitationList, websocket.messageSenderBuilder);
  }

  private async renderOneToOneChats(db: Database, element: HTMLElement) {
    element.innerHTML = "";
    let users = await db.knownUserStore.getAllFriends();
  
    let unorderedList = document.createElement('ul') as HTMLUListElement;
    unorderedList.append(...users.map((u) => {
      let listElement = document.createElement('li') as HTMLLIElement;
      listElement.textContent = u.username + " from " + (u.remoteServer !== '' ? u.remoteServer : "this server");
      listElement.onclick = (e) => {
        ROUTER.goTo('/chat', {user: u.username});
      }
      return listElement;
    }));
  
    element.appendChild(unorderedList);
  }
  
  private async renderGroupChats(db: Database, element: HTMLElement) {
    element.innerHTML = "";
    let groups = await db.groupChatStore.getAll();
  
    let unorderedList = document.createElement('ul') as HTMLUListElement;
    unorderedList.append(...groups.map((group) => {
      let listElement = document.createElement('li') as HTMLLIElement;
  
      listElement.textContent = "Id: " + group.groupId + " with members " + group.members.map(m => m.username).toString();
      return listElement;
    }));
  
    element.appendChild(unorderedList);
  }
  
  private async renderInvites(db: Database, element: HTMLElement, messageSenderBuilder: MessageSenderBuilder) {
    element.innerHTML = "";
    let invites = await db.keyExchangeRequestStore.getAll();
  
    let unorderedList = document.createElement('ul') as HTMLUListElement;
    unorderedList.append(...invites.map((invite) => {
      let listElement = document.createElement('li') as HTMLLIElement;
      listElement.textContent = "Invite from " + invite.senderUsername;
  
      let acceptButton = document.createElement('button');
      acceptButton.textContent = "Accept Invite";
      acceptButton.onclick = async (e) => {
        try {
          await acceptInvite(invite.senderUsername, db, messageSenderBuilder);
        } catch(e) {
          console.error(e);
        }
      }
  
      listElement.appendChild(acceptButton);
      return listElement;
    }));
  
    element.appendChild(unorderedList);
  
    
  }
}




