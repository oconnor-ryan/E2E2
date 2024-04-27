import { MessageReceivedEventHandler } from "../../message-handler/MessageParser.js";

export function displayNotification(title: string, message: string) {
  let root = document.createElement('div');

  root.style.position = 'fixed';
  root.style.top = '20px';
  root.style.left = '25%';
  root.style.width = '50%';
  root.style.height = 'auto';
  root.style.backgroundColor = 'cyan';
  root.style.color = 'black';

  root.textContent = `${title}: ${message}`;

  document.body.appendChild(root);
  setTimeout(() => {
    document.body.removeChild(root);
  }, 5000);
}

export function getDefaultMessageReceivedHandlerUI() {
  const messageReceiver = new MessageReceivedEventHandler();
  messageReceiver.onmessage = (m, payload, messageSaved, error) => {
    if(error) {
      return displayNotification("MessageReceiveError", "A message was received, but we cannot decrypt your message!")
    }
    if(!messageSaved) {
      return displayNotification(`Message Received!`, "But the message was not saved to database!");
    }
    return displayNotification(`Message Received!`, "");
  }

  messageReceiver.onkeyexchangerequest = (m, exchangeSaved, error) => {
    if(error) {
      return displayNotification("InviteReceivedError", "A invite was received, but we cannot read it!")
    }
    return displayNotification(`Invite Received!`, "");
  }

  messageReceiver.onbatchedmessageerror = (numMessagesSaved, numInvitesSaved) => {
    return displayNotification(`You got ${numMessagesSaved} messages and ${numInvitesSaved} exchange requests!`, ``);
  }

  messageReceiver.onerror = (error) => {
    return displayNotification(`Error`, error.error);
  }

  return messageReceiver;
}