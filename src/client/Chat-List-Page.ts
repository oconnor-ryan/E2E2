import * as fetcher from "./util/EasyFetch.js";


const chatlistContainer = document.getElementById("chat-list") as HTMLUListElement;
const invitationContainer = document.getElementById("invitations") as HTMLDivElement;
const createChatButton = document.getElementById("create-chat-button") as HTMLButtonElement;

createChatButton.onclick = (e) => {
  createChat();
};

async function fetchAndRenderInvites() {
  let invites = await fetcher.getInvites();

  for(let invite of invites) {
    let li = document.createElement('li');
    li.textContent = `Sender=${invite.sender}, ChatId=${invite.chat_id} `;

    let button = document.createElement('button');
    button.textContent = "Accept?";
    button.onclick = async (e) => {
      await fetcher.acceptInvite(invite.chat_id)

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
  let chats = await fetcher.getChats();

  //dont use innerHTML due to protential XSS attacks that can be performed,
  //especially if values come from user input
  for(let chatId of Object.keys(chats)) {
    makeChatElement(Number(chatId));
  }
}

async function createChat() {
  let chat = await fetcher.createChat();
  makeChatElement(chat.id);
}

async function main() {
  //no need to wait for render invite function to finish, so don't use
  //await here
  fetchAndRenderInvites();
  fetchAndRenderChats();

}

main();