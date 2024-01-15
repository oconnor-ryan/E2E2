(() => {

  const messageInput = document.getElementById('message-input') as HTMLInputElement;
  const messageButton = document.getElementById('send-message-button') as HTMLButtonElement;
  const messagesContainer = document.getElementById('messages') as HTMLDivElement;

  const ws = new WebSocket("ws://localhost:3000");

  //websocket event handlers

  ws.onerror = (ev) => {
    console.error("Failed to connect");
    console.error(ev);
  };

  //when receiving messages from server
  ws.onmessage = (ev) => {
    let message = ev.data;
    renderOtherMessageToScreen(message);
  };

  //if the WebSocket connection is lost or closed
  ws.onclose = (ev) => {
    window.alert("WebSocket connection closed! No messages will be sent!");
  };

  //event listeners for UI elements

  //send message when hitting enter while message input element is focused
  messageInput.onkeyup = (ev) => {
    if(ev.key.toLowerCase() == "enter") {
      sendMessage();
    }
  }

  //send message when pressing the Send button
  messageButton.onclick = (ev) => {
    sendMessage();
  };


  //functions

  function sendMessage() {
    let message = messageInput.value;
    if(!message.trim()) {
      return;
    }

    ws.send(message);
    renderMyMessageToScreen(message); //render user's message to screen
    messageInput.value = ''; //clear input
  }


  //renders the current user's messages to their chat box.
  function renderMyMessageToScreen(message: string) {
    let container = document.createElement('div');
    container.style.backgroundColor = 'cyan';
    container.style.color = 'black';
    container.style.width = '40%';
    container.style.marginBottom = '5px';
    container.innerHTML = message;

    messagesContainer.appendChild(container);
  }

  //renders messages from the server from other people to the chat box.
  function renderOtherMessageToScreen(message: string) {
    let container = document.createElement('div');
    container.style.backgroundColor = 'orange';
    container.style.color = 'black';
    container.style.width = '40%';
    container.style.marginBottom = '5px';

    container.style.marginLeft = '60%';
    container.innerHTML = message;

    messagesContainer.appendChild(container);
  }

})();