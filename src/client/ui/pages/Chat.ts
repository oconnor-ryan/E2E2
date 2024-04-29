import { ClientPage } from "../router/ClientPage.js";


export class ChatPage extends ClientPage {
  load(rootElement: HTMLElement): void {
    let searchParams = new URLSearchParams(window.location.search);

    rootElement.innerHTML = "Chat Page: " + searchParams.toString();
  }
}