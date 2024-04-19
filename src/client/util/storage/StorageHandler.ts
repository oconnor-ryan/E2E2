/*
WARNING:
  Don't assume that IndexedDB is permanently persistant. 
  A user can easily delete the contents of IndexedDB when clearing cookies and cache
  even if they tell the browser that this website's data should persist.
*/

import { AccountStore, GroupChatRequestStore, GroupChatStore, KnownUserStore, MessageRequestStore, MessageStore, PendingInviteStore } from "./ObjectStore.js";

const DB_NAME = "e2e2";
const DB_VERSION = 1;



//using function closure in order to hide storageHandler variable
//and assure that only one instance of storageHandler is ever initialized
//per page load.
export const getDatabase = (() => {
  let storageHandler: StorageHandler | undefined;


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
    if(storageHandler) {
      return storageHandler;
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
      let db = await initDB();
      storageHandler = new StorageHandler(db);
      return storageHandler;
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
        let db = await initDB();
        storageHandler = new StorageHandler(db);
        return storageHandler;
      }
    } 
    
    window.alert("You must allow Persistant storage for this site to securely store your encryption keys/data!");
    throw new Error("Do not have permission to access IndexedDB!");
  };

  

  
})();


async function deleteDB() {
  let request = window.indexedDB.deleteDatabase(DB_NAME);

  return new Promise<void>((resolve, reject) => {
    request.onsuccess = (e) => resolve();
    request.onerror = (e) => reject(request.error);
  });
}

async function initDB() {
  //MAKE SURE TO COMMENT THIS TO PERSIST DB AFTER TESTING!!!!
  //await deleteDB();


  let DBOpenRequest = window.indexedDB.open(DB_NAME, DB_VERSION);

  //list of active stores
  let accountStore: AccountStore;
  let knownUserStore: KnownUserStore;
  let groupChatStore: GroupChatStore;
  let messageStore: MessageStore;
  let pendingInviteStore: PendingInviteStore;
  let messageRequestStore: MessageRequestStore;
  let groupChatRequestStore: GroupChatRequestStore;

  


  // This event handles the event whereby a new version of the database needs to be created
  // Either one has not been created before, or a new version number has been submitted via the
  // window.indexedDB.open line above
  DBOpenRequest.onupgradeneeded = (event) => {
    //@ts-ignore
    let db: IDBDatabase = event.target.result;
  
    console.log(`Upgrade Needed from ${event.oldVersion} to ${event.newVersion}`);
  
    console.log(db.objectStoreNames);

    accountStore = new AccountStore(db);
    knownUserStore = new KnownUserStore(db);
    groupChatStore = new GroupChatStore(db);
    messageStore = new MessageStore(db);
    pendingInviteStore = new PendingInviteStore(db);
    messageRequestStore = new MessageRequestStore(db);
    groupChatRequestStore = new GroupChatRequestStore(db);

    accountStore.initObjectStore();
    knownUserStore.initObjectStore();
    groupChatStore.initObjectStore();
    messageStore.initObjectStore();
    pendingInviteStore.initObjectStore();
    messageRequestStore.initObjectStore();
    groupChatRequestStore.initObjectStore();
  };
  
  
  return new Promise<IDBDatabase>((resolve, reject) => {
    DBOpenRequest.onerror = (event) => {
      console.error("Failed to open database", DBOpenRequest.error);
      reject(DBOpenRequest.error);
    };
    
    DBOpenRequest.onsuccess = (event) => {
      console.log("Open Success");  
      let db = DBOpenRequest.result;

    };  
  });
  
}

export type { StorageHandler };


class StorageHandler {
  private readonly db: IDBDatabase;
  private readonly localStorage = window.localStorage;


  constructor(db: IDBDatabase) {
    this.db = db;
  }

  updateUsername(username: string) : boolean {
    try {
      this.localStorage.setItem("username", username);
      return true;

    } catch(e) {
      console.error(e);
      return false;
    }
  
  }
  
  getUsername() {
    return this.localStorage.getItem("username");
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

  getPassword() {
    return this.localStorage.getItem('password');
  }

  
}




