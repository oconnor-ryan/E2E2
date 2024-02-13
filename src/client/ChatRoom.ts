import { ezFetch } from "./util/EasyFetch.js";
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

  let res = await ezFetch("/api/searchusers", {search: searchString});

  console.log(res);
  userSearchDataList.innerHTML = "";

  for(let user of res.users) {
    userSearchDataList.innerHTML += `<option value="${user}"></option>`;
  }
};

inviteButton.onclick = async (e) => {
  let invitedUser = userSearchInput.value;

  let res = await ezFetch("/api/invite", {user: invitedUser, chatId: CHAT_ID});

  if(res.error) {
    window.alert("Failed to invite user")
    throw new Error(res.error);
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

  let chatInfoResult = await ezFetch("/api/getchatinfo", {chatId: CHAT_ID});

  if(chatInfoResult.error) {
    throw new Error(chatInfoResult.error);
  }

  let chatInfo = chatInfoResult.chatInfo;

  renderMembers(storageHandler, chatInfo.members);
  


}

main();

