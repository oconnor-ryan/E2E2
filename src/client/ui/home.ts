import { Database, getDatabase } from "../storage/StorageHandler.js";
import { startWebSocketConnection } from "../websocket/SocketHandler.js";
import { UserSearchElement } from "./components/AutoComplete.js";
import { getDefaultMessageReceivedHandlerUI } from "./components/Notification.js";

const oneToOneChatListElement = document.getElementById('one-to-one-chat-list') as HTMLDivElement;
const groupChatListElement = document.getElementById('group-chat-list') as HTMLDivElement;
const addGroupChatButtonElement = document.getElementById('add-group-button') as HTMLButtonElement;
const invitationList = document.getElementById('invitation-list') as HTMLDivElement;

const userSearch = new UserSearchElement(() => {});
userSearch.render(document.getElementById('user-search-root')!);


async function renderOneToOneChats(db: Database) {
  oneToOneChatListElement.innerHTML = "";
  let users = await db.knownUserStore.getAllFriends();

  let unorderedList = document.createElement('ul') as HTMLUListElement;
  unorderedList.append(...users.map((u) => {
    let listElement = document.createElement('li') as HTMLLIElement;
    listElement.textContent = u.username + " from " + u.remoteServer !== '' ? u.remoteServer : "this server";
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

async function renderInvites(db: Database) {
  invitationList.innerHTML = "";
  let invites = await db.messageInviteStore.getAll();

  let unorderedList = document.createElement('ul') as HTMLUListElement;
  unorderedList.append(...invites.map((invite) => {
    let listElement = document.createElement('li') as HTMLLIElement;

    listElement.textContent = "Invite from " + invite.senderUsername;
    return listElement;
  }));

  invitationList.appendChild(unorderedList);
}

(async () => {
  const db = await getDatabase();
  let websocketInfo = await startWebSocketConnection(getDefaultMessageReceivedHandlerUI());
  await renderOneToOneChats(db);
  await renderGroupChats(db);
  await renderInvites(db);

})();