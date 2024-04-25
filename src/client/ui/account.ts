import * as fetcher from "../util/ApiRepository.js";
import * as storage from './util/storage/StorageHandler.js';
import { StorageHandler } from "./util/storage/StorageHandler.js";

const accountForm = document.getElementById('create-account-form') as HTMLFormElement;
const messageElement = document.getElementById('result-message') as HTMLParagraphElement;

async function main() {
  messageElement.innerHTML = "Start";
  let storageHandler: StorageHandler;
  try {
    storageHandler = await storage.getDatabase();
    window.alert("Success! Got IndexedDB!");
  } catch(e: any) {
    messageElement.innerHTML = e.message;
    window.alert(e.name);
    return;
  }

  messageElement.innerHTML = `${await window.navigator.storage.persisted()}`;

  accountForm.onsubmit = async (e) => {
    e.preventDefault(); //dont allow post request to go through
  
    //@ts-ignore
    let username: string = accountForm.elements["username"].value;
  
    console.log(username);
  
    let jsonRes = await fetcher.createAccount(username);
  
    messageElement.innerHTML = `Create Account Result: ${JSON.stringify(jsonRes)}`;
  }

}

main();