import { ezFetch } from "./util/EasyFetch.js";
import { waitToOpenIndexedDB } from "./util/StorageHandler.js";

const inviteButton = document.getElementById("invite-button") as HTMLButtonElement;

const userSearchInput = document.getElementById("user-search-input") as HTMLInputElement;
const userSearchDataList = document.getElementById("autocomplete-results") as HTMLDataListElement;

const CHAT_ID = Number(new URLSearchParams(window.location.search).get("chatId") ?? "");


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

async function main() {
  if(Number.isNaN(CHAT_ID)) {
    window.location.replace("/test/chatlist");
    return;
  }

  await waitToOpenIndexedDB();



}

main();

