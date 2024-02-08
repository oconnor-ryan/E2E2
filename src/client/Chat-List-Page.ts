import { ezFetch } from "./util/EasyFetch.js";


const chatlistContainer = document.getElementById("chat-list") as HTMLDivElement;
const invitationContainer = document.getElementById("invitations") as HTMLDivElement;

async function main() {
  let res = await ezFetch('/api/getinvites');
  if(res.error) {
    throw new Error(res.error);
  }
  invitationContainer.innerHTML = "";
  for(let invite of res.invites) {
    invitationContainer.innerHTML += `<p>Sender: ${invite.sender}, ChatId=${invite.chat_id} <button>Accept?</button></p>`;
  }

  let chatListResult = await ezFetch("/api/getchats");
  if(chatListResult.error) {
    throw new Error(chatListResult.error);
  }

  //dont use innerHTML due to protential XSS attacks that can be performed,
  //especially if values come from user input
  let chatListElement = document.createElement('ul');
  for(let chatId of Object.keys(chatListResult.chats)) {
    let linkItem = document.createElement('a');
    linkItem.href = `/test/chatroom?chatId=${chatId}`;
    linkItem.textContent = `ChatRoom Id = ${chatId}`;

    let listItem = document.createElement('li');
    listItem.appendChild(linkItem);

    chatListElement.appendChild(listItem);
  }
  chatlistContainer.appendChild(chatListElement);


}
main();