import { ezFetch } from "./util/EasyFetch.js";


const chatlistContainer = document.getElementById("chat-list") as HTMLDivElement;
const invitationContainer = document.getElementById("invitations") as HTMLDivElement;
const yourInvitesContainer = document.getElementById("your-invitations") as HTMLDivElement;

const inviteButton = document.getElementById("invite-button") as HTMLButtonElement;

const userSearchInput = document.getElementById("user-search-input") as HTMLInputElement;
const userSearchDataList = document.getElementById("autocomplete-results") as HTMLDataListElement;

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

  let res = await ezFetch("/api/invite", {user: invitedUser});

  if(res.error) {
    window.alert("Failed to invite user")
    throw new Error(res.error);
  }

  window.alert("Successfully invited user!");
}

async function main() {
  let res = await ezFetch('/api/getinvites');
  if(res.error) {
    throw new Error(res.error);
  }
  invitationContainer.innerHTML = "";
  for(let invite of res.invites) {
    invitationContainer.innerHTML += `<p>Sender: ${invite.sender}, ChatId=${invite.chat_id} <button>Accept?</button></p>`;
  }
}
main();