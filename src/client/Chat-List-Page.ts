import { ezFetch } from "./util/EasyFetch.js";


const chatlistContainer = document.getElementById("chat-list") as HTMLDivElement;
const invitationContainer = document.getElementById("invitations") as HTMLDivElement;
const yourInvitesContainer = document.getElementById("your-invitations") as HTMLDivElement;

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
}
