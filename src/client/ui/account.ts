import { Database } from "../storage/Database.js";
import { LOCAL_STORAGE_HANDLER, getDatabase } from "../storage/StorageHandler.js";
import * as api from "../util/ApiRepository.js";
import { displayError } from "../util/ClientError.js";

const accountForm = document.getElementById('create-account-form') as HTMLFormElement;
const accountListElement = document.getElementById('account-list') as HTMLDivElement;


function renderAccount(username: string, password: string) {
  let div = document.createElement('div');
  div.className = "account-box";
  div.textContent = username;
  div.style.color = 'black';
  div.onclick = (ev) => {
    LOCAL_STORAGE_HANDLER.updateUsernameAndPassword(username, password);
    window.location.href = "/home"; //redirect to home page
  }
  accountListElement.appendChild(div);
}

async function renderAccounts(db: Database) {
  let accounts = await db.accountStore.getAll();
  for(let acc of accounts) {
    renderAccount(acc.username, acc.password);
  }
}
async function main() {
  const db = await getDatabase();
  await renderAccounts(db);

  accountForm.onsubmit = async (e) => {
    e.preventDefault(); //dont allow post request to go through
  
    //@ts-ignore
    let username: string = accountForm.elements["username"].value;
  
    console.log(username);
  
    try {
      await api.createAccount(username);
      //username and password are kept in local storage after account creation
      renderAccount(username, LOCAL_STORAGE_HANDLER.getPassword()!);

    } catch(e) {
      displayError(e as Error);
    }
  
  }
}

main();