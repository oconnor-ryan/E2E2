import { ezFetch } from "./util/EasyFetch.js";


const chatlistContainer = document.getElementById("chat-list") as HTMLUListElement;
const invitationContainer = document.getElementById("invitations") as HTMLDivElement;

async function fetchAndRenderInvites() {
  let res = await ezFetch('/api/getinvites');
  if(res.error) {
    throw new Error(res.error);
  }

  for(let invite of res.invites) {
    let li = document.createElement('li');
    li.textContent = `Sender=${invite.sender}, ChatId=${invite.chat_id} `;

    let button = document.createElement('button');
    button.textContent = "Accept?";
    button.onclick = async (e) => {
      let acceptedResult = await ezFetch("/api/acceptinvite", {chatId: invite.chat_id});
      if(acceptedResult.error) {
        throw new Error(acceptedResult.error);
      }

      li.remove(); //remove invite from invitation list
      makeChatElement(invite.chat_id); //create link to chat in Chat list
    };
    li.appendChild(button);
    invitationContainer.appendChild(li);
  }

}

function makeChatElement(chatId: number) {
  let linkItem = document.createElement('a');
  linkItem.href = `/test/chatroom?chatId=${chatId}`;
  linkItem.textContent = `ChatRoom Id = ${chatId}`;

  let listItem = document.createElement('li');
  listItem.appendChild(linkItem);

  chatlistContainer.appendChild(listItem);
}

async function fetchAndRenderChats() {
  let chatListResult = await ezFetch("/api/getchats");
  if(chatListResult.error) {
    throw new Error(chatListResult.error);
  }

  //dont use innerHTML due to protential XSS attacks that can be performed,
  //especially if values come from user input
  for(let chatId of Object.keys(chatListResult.chats)) {
    makeChatElement(Number(chatId));
  }
}

async function main() {
  //no need to wait for render invite function to finish, so don't use
  //await here
  fetchAndRenderInvites();
  fetchAndRenderChats();

}

main();