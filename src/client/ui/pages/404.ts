import { ClientPage } from "../router/ClientPage.js";
import { ROUTER } from "../router/router.js";

export class Page404 extends ClientPage {
  load(rootElement: HTMLElement) {
    const header = document.createElement('h1');
    header.textContent = "404 Page Not Found";

    const backHomeButton = document.createElement('button');
    backHomeButton.textContent = "Back To Home";
    backHomeButton.onclick = (e) => {
      ROUTER.goTo('/home');
    }


    rootElement.innerHTML = "";
    rootElement.append(header, backHomeButton);
  }
}