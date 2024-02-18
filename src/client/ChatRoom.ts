import * as fetcher from "./util/EasyFetch.js";
import { StorageHandler, getDatabase } from "./util/StorageHandler.js";

const chatHeader = document.getElementById('chatroom-name') as HTMLHeadingElement;

const inviteContainer = document.getElementById('invite-container') as HTMLDivElement;
const inviteButton = document.getElementById("invite-button") as HTMLButtonElement;
const userSearchInput = document.getElementById("user-search-input") as HTMLInputElement;
const userSearchDataList = document.getElementById("autocomplete-results") as HTMLDataListElement;

const memberListElement = document.getElementById('member-list') as HTMLUListElement;
const messageBox = document.getElementById('message-input') as HTMLInputElement;

const CHAT_ID = Number(new URLSearchParams(window.location.search).get("chatId") ?? "");
chatHeader.textContent = `Chat Room Id = ${CHAT_ID}`;

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
  
}

main();

