/*
WARNING:
  Don't assume that IndexedDB is permanently persistant. 
  A user can easily delete the contents of IndexedDB when clearing cookies and cache
  even if they tell the browser that this website's data should persist.
*/

import { base64ToBase64URL } from "../util/Base64.js";
import { Database } from "./Database.js";

//consider this
//let cb = await Database.initDB();

//using function closure in order to hide storageHandler variable
//and assure that only one instance of storageHandler is ever initialized
//per page load.
//using syncronous function since not all browsers allow top-level code
//to use async-await
export const getDatabase = (() => {
  let database: Database | undefined;


  //this allows you to make sure that data in IndexedDB is only deleted
  //if the user explicitly does so. 
  //
  //Note that in Firefox, if you tell it to delete all site data when
  //the browser is closed, this WILL INCLUDE data put in persistant storage.
  //
  //When first creating an account, make sure to tell user that if they delete
  //site data when closing browser, leave this website as an exception.
  //
  //WARNING: Chromium-based browsers will not prompt users for using Persistant
  //storage and will always return false, unless one of the following things 
  //are true (https://chromestatus.com/feature/4931497563783168):
  // 1. Website is bookmarked and user has 5 or less total bookmarks
  // 2. Website is added to homescreen
  // 3. Website is granted push notification permissions
  // 4. Website has "high sight engagement"
  //
  // A popup does appear for requesting for push notifications, so 
  // you can request for push notification permission to allow persistant
  // storage.
  //
  return async () => {
    //
    if(database) {
      return database;
    }

    if(!window.isSecureContext) {
      throw new Error("StorageManager API is not available under non-secure contexts!");
    }

    if(!window.navigator.storage) {
      throw new Error("Persistance API is unavailable, use a browser version that supports it!");
    }

    let persistData = await window.navigator.storage.persist();
    console.log("Allow persistance: " + persistData);

    if(persistData) {
      database = await Database.initDB();
      return database;
    }
    
        
    //@ts-ignore
    //this works to detect chromium-based browsers.
    //https://stackoverflow.com/questions/57660234/how-can-i-check-if-a-browser-is-chromium-based
    //
    //If browser is Chromium-based, by requesting Notification permission popup to appear, the 
    //user can allow Persistant Storage to work.
    if(window.chrome) {
      //value can be 'denied', 'granted', or 'default'
      let notePermission = await Notification.requestPermission();

      //persistance will only be true after next page reload,
      //but database will still work
      if(notePermission === 'granted') {
        database = await Database.initDB();
        return database;
      }
    } 
    
    window.alert("You must allow Persistant storage for this site to securely store your encryption keys/data!");
    throw new Error("Do not have permission to access IndexedDB!");
  };

  

  
})();

export type {Database}




class LocalStorageHandler {
  private readonly localStorage = window.localStorage;

  updateUsernameAndPassword(username: string, password: string) : boolean {
    try {
      this.localStorage.setItem("username", username);
      this.localStorage.setItem("password", password);
      return true;

    } catch(e) {
      console.error(e);
      return false;
    }
  
  }
  
  updatePassword(password: string) {
    try {
      this.localStorage.setItem("password", password);
      return true;

    } catch(e) {
      console.error(e);
      return false;
    }
  }

  getUsername() {
    return this.localStorage.getItem("username");
  }

  getPassword() {
    return this.localStorage.getItem('password');
  }

  getAuthHeader() {
    let userId = this.getUsername();
    let password = this.getPassword();

    if(!userId || !password) {
      throw new Error("No user ID and/or password found!");
    }

    let authHeader = "Basic " + btoa(userId + ":" + password);
    return authHeader;
  }

  getWebSocketCred() {
    let userId = this.getUsername();
    let password = this.getPassword();

    if(!userId || !password) {
      throw new Error("No user ID and/or password found!");
    }

    let base64UserAndPass = btoa(userId + ":" + password);

    return base64ToBase64URL(base64UserAndPass);
  }

  
}

export const LOCAL_STORAGE_HANDLER = new LocalStorageHandler();




