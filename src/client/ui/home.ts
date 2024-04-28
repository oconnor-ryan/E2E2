import { MessageSenderBuilder, SocketMessageSender } from "../message-handler/MessageSender.js";
import { Database, getDatabase } from "../storage/StorageHandler.js";
import { acceptInvite, inviteUser } from "../util/Actions.js";
import { startWebSocketConnection } from "../websocket/SocketHandler.js";
import { UserSearchElement } from "./components/AutoComplete.js";
import { getDefaultMessageReceivedHandlerUI } from "./components/Notification.js";

const oneToOneChatListElement = document.getElementById('one-to-one-chat-list') as HTMLDivElement;
const groupChatListElement = document.getElementById('group-chat-list') as HTMLDivElement;
const addGroupChatButtonElement = document.getElementById('add-group-button') as HTMLButtonElement;
const invitationList = document.getElementById('invitation-list') as HTMLDivElement;




async function renderOneToOneChats(db: Database) {
  oneToOneChatListElement.innerHTML = "";
  let users = await db.knownUserStore.getAllFriends();

  let unorderedList = document.createElement('ul') as HTMLUListElement;
  unorderedList.append(...users.map((u) => {
    let listElement = document.createElement('li') as HTMLLIElement;
    listElement.textContent = u.username + " from " + (u.remoteServer !== '' ? u.remoteServer : "this server");
    return listElement;
  }));

  oneToOneChatListElement.appendChild(unorderedList);
}

async function renderGroupChats(db: Database) {
  groupChatListElement.innerHTML = "";
  let groups = await db.groupChatStore.getAll();

  let unorderedList = document.createElement('ul') as HTMLUListElement;
  unorderedList.append(...groups.map((group) => {
    let listElement = document.createElement('li') as HTMLLIElement;

    listElement.textContent = "Id: " + group.groupId + " with members " + group.members.map(m => m.username).toString();
    return listElement;
  }));

  groupChatListElement.appendChild(unorderedList);
}

async function renderInvites(db: Database, messageSenderBuilder: MessageSenderBuilder) {
  invitationList.innerHTML = "";
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

  invitationList.appendChild(unorderedList);

  
}

(async () => {
  const db = await getDatabase();

  

  let messageReceiver = getDefaultMessageReceivedHandlerUI();
  let oldKeyExchangeReceiver = messageReceiver.onkeyexchangerequest;
  let oldBatchedMessageReceiver = messageReceiver.onbatchedmessage;


  let {messageSenderBuilder, inviteSenderBuilder} = startWebSocketConnection(db, messageReceiver);

  messageReceiver.onkeyexchangerequest = async (request, error) => {
    oldKeyExchangeReceiver(request, error);
    if(error) {
      return;
    }
    await renderInvites(db, messageSenderBuilder);
  };

  messageReceiver.onbatchedmessage = async (numMessagedSave, numInvitesSaved) => {
    oldBatchedMessageReceiver(numMessagedSave, numInvitesSaved)
    await renderInvites(db, messageSenderBuilder);
  };

  const userSearch = new UserSearchElement(async (username: string) => {
    inviteUser(db, username, await inviteSenderBuilder.buildInviteSender()).catch(e => {
      console.error(e);
    });
  });
  userSearch.render(document.getElementById('user-search-root')!);

  await renderOneToOneChats(db);
  await renderGroupChats(db);
  await renderInvites(db, messageSenderBuilder);
  

})();