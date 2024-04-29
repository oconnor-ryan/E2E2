import { createAccount } from "../../util/ApiRepository.js";
import { ClientPage } from "../router/ClientPage.js";
import { ROUTER } from "../router/router.js";
import { Database, LOCAL_STORAGE_HANDLER, getDatabase } from "../../storage/StorageHandler.js";
import { displayError } from "../../util/ClientError.js";

export class AccountPage extends ClientPage {

  load(rootElement: HTMLElement): void {

    rootElement.innerHTML = `
      <h2>Create Account</h2>
      <form id="create-account-form" action="" method="post">
        <input name="username" placeholder="username"/>
        <input type="submit" value="submit"/>
      </form>

      <h2>Select Account to Use:</h2>
      <div id="account-list"></div>
    `;

    const accountForm = document.getElementById('create-account-form') as HTMLFormElement;
    const accountListElement = document.getElementById('account-list') as HTMLDivElement;

    accountForm.onsubmit = async (e) => {
      e.preventDefault(); //dont allow post request to go through
    
      //@ts-ignore
      let username: string = accountForm.elements["username"].value;
    
      console.log(username);
    
      try {
        await createAccount(username);
        //username and password are kept in local storage after account creation
        this.renderAccount(username, LOCAL_STORAGE_HANDLER.getPassword()!, accountListElement);
  
      } catch(e) {
        displayError(e as Error);
      }
    
    }

    this.loadAsync(accountListElement).catch(e => {console.error(e)})
  }

  private async loadAsync(accountListElement: HTMLElement) {
    const db = await getDatabase();
    await this.renderAccounts(db, accountListElement);
  }
  
  private renderAccount(username: string, password: string, rootElement: HTMLElement) {
    let div = document.createElement('div');
    div.className = "account-box";
    div.textContent = username;
    div.style.color = 'black';
    div.onclick = (ev) => {
      LOCAL_STORAGE_HANDLER.updateUsernameAndPassword(username, password);
      ROUTER.goTo('/home');
    }
    rootElement.appendChild(div);
  }
  
  private async renderAccounts(db: Database, rootElement: HTMLElement) {
    let accounts = await db.accountStore.getAll();
    for(let acc of accounts) {
      this.renderAccount(acc.username, acc.password, rootElement);
    }
  }
}