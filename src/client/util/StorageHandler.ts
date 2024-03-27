/*
WARNING:
  Don't assume that IndexedDB is permanently persistant. 
  A user can easily delete the contents of IndexedDB when clearing cookies and cache
  even if they tell the browser that this website's data should persist.
*/

import {ECDSAPrivateKey, ECDSAPublicKey, ECDHPrivateKey, ECDHPublicKey, AesGcmKey} from "../encryption/encryption.js";
import { KeyType } from "../shared/Constants.js";


const DB_NAME = "e2e2";
const DB_VERSION = 2;
const KEY_STORE = "key_store";
const CHAT_STORE = "chat_store1";
const USER_STORE = "user_store";

const MESSAGE_STORE = "message_store1";

/*
interface MessageEntry {
  message: string,
  messageId: number,
  chatId: number,
  sender: string,
  date: Date
}
*/

interface MessageEntry {
  chatId: number,
  data: {
    message: string,
    type: string,
    senderId: string
  }
}

//this is the exact format of an object stored in Chat Object Store
interface RawChatEntry {
  chatId: number, 
  lastReadMessageUUID: string | null,
  //members: {id: string}[],
  secretKey: CryptoKey | null,
  keyExchangeId: number | null
}


//this is the format exposed outside of StorageHandler for an entry in the
//Chat Object store. 
//this type is used because it automatically wraps the CryptoKey to the 
//appropriate AesGcmKey key. This avoids confusion on what CryptoKey to store.
interface ChatEntry {
  chatId: number, 
  lastReadMessageUUID: string | null,
  //members: {id: string}[],
  secretKey: AesGcmKey | null
  keyExchangeId: number | null
}

function rawChatEntryToChatEntry(entry: RawChatEntry): ChatEntry {
  return {
    chatId: entry.chatId,
    lastReadMessageUUID: entry.lastReadMessageUUID,
    keyExchangeId: entry.keyExchangeId,
    secretKey: entry.secretKey ? new AesGcmKey(entry.secretKey) : null,
  }
}

function chatEntryToRawChatEntry(entry: ChatEntry) : RawChatEntry {
  return {
    chatId: entry.chatId,
    lastReadMessageUUID: entry.lastReadMessageUUID,
    keyExchangeId: entry.keyExchangeId,
    secretKey: entry.secretKey ? entry.secretKey.getCryptoKey() : null
  }
}

interface KnownUser {
  id: string,
  signingPublicKey: CryptoKey
}



//the exact format of an object in the Key Object Store.
//this type is hidden within the StorageHandler object
interface RawKeyEntry {
  keyType: KeyType,
  key: CryptoKey | CryptoKeyPair
}

//this format abstracts the RawKeyEntry type by automatically wrapping any
//CryptoKey and CryptoKeyPair objects stored in IndexedDB into an appropriate
//CryptoKeyWrapper class.

type KeyEntry = 
  {keyType: KeyType.EXCHANGE_ID_PAIR, privateKey: ECDHPrivateKey, publicKey: ECDHPublicKey}
  | {keyType: KeyType.EXCHANGE_PREKEY_PAIR, privateKey: ECDHPrivateKey, publicKey: ECDHPublicKey}
  | {keyType: KeyType.IDENTITY_KEY_PAIR, privateKey: ECDSAPrivateKey, publicKey: ECDSAPublicKey}



function rawKeyEntryToKeyEntry(entry: RawKeyEntry) : KeyEntry {
  switch(entry.keyType) {
    case KeyType.IDENTITY_KEY_PAIR: {
      let keyPair = entry.key as CryptoKeyPair;
      return {keyType: entry.keyType, privateKey: new ECDSAPrivateKey(keyPair.privateKey), publicKey: new ECDSAPublicKey(keyPair.publicKey)};
    }
    case KeyType.EXCHANGE_ID_PAIR:
    case KeyType.EXCHANGE_PREKEY_PAIR: {
      let keyPair = entry.key as CryptoKeyPair;
      return {keyType: entry.keyType, privateKey: new ECDHPrivateKey(keyPair.privateKey), publicKey: new ECDHPublicKey(keyPair.publicKey)}
    }
  }
}

function keyEntryToRawKeyEntry(entry: KeyEntry) : RawKeyEntry {
  switch(entry.keyType) {
    case KeyType.EXCHANGE_ID_PAIR:
    case KeyType.EXCHANGE_PREKEY_PAIR:
    case KeyType.IDENTITY_KEY_PAIR: {
      return {keyType: entry.keyType, key: {privateKey: entry.privateKey.getCryptoKey(), publicKey: entry.publicKey.getCryptoKey()}};
    }
  }
}


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
      storageHandler = new _StorageHandler(db);
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
        storageHandler = new _StorageHandler(db);
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
  //MAKE SURE TO UNCOMMENT THIS TO PERSIST DB AFTER TESTING!!!!
  //await deleteDB();


  let DBOpenRequest = window.indexedDB.open(DB_NAME, DB_VERSION);

  
  // This event handles the event whereby a new version of the database needs to be created
  // Either one has not been created before, or a new version number has been submitted via the
  // window.indexedDB.open line above
  DBOpenRequest.onupgradeneeded = (event) => {
    //@ts-ignore
    let db: IDBDatabase = event.target.result;
  
    console.log(`Upgrade Needed from ${event.oldVersion} to ${event.newVersion}`);
  
    console.log(db.objectStoreNames);

    if(!db.objectStoreNames.contains(KEY_STORE)) {
      //note that KeyPath is equivalent to PRIMARy KEY in relational databases
      let objectStore = db.createObjectStore(KEY_STORE, {
        keyPath: "keyType",
      });
    }

    if(!db.objectStoreNames.contains(USER_STORE)) {
      //note that KeyPath is equivalent to PRIMARy KEY in relational databases
      let objectStore = db.createObjectStore(USER_STORE, {
        keyPath: "id",
      });

      objectStore.createIndex("id_key", "id_key", {unique: true});
    }

    if(!db.objectStoreNames.contains(CHAT_STORE)) {
      let objectStore = db.createObjectStore(CHAT_STORE, {
        keyPath: "chatId",
      });
    }

    if(db.objectStoreNames.contains(MESSAGE_STORE)) {
      db.deleteObjectStore(MESSAGE_STORE);
    }

    if(!db.objectStoreNames.contains(MESSAGE_STORE)) {
      let objectStore = db.createObjectStore(MESSAGE_STORE, {
        keyPath: "messageId",
        autoIncrement: true
      });

      objectStore.createIndex('chatId', 'chatId', {unique: false});
      objectStore.createIndex('senderId', 'senderId', {unique: false});


    }
  
  };
  
  
  return new Promise<IDBDatabase>((resolve, reject) => {
    DBOpenRequest.onerror = (event) => {
      console.error("Failed to open database", DBOpenRequest.error);
      reject(DBOpenRequest.error);
    };
    
    DBOpenRequest.onsuccess = (event) => {
      console.log("Open Success");  
      resolve(DBOpenRequest.result);
    };  
  });
  
}

export type StorageHandler = _StorageHandler;


class _StorageHandler {
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

  addUser(entry: KnownUser) {
    const transaction = this.db.transaction(USER_STORE, "readwrite");

    const request = transaction.objectStore(USER_STORE).add(entry);

    return new Promise<void>((resolve, reject) => {
      request.onsuccess = (e) => resolve();
      request.onerror = (e) => reject(request.error);

    });
  }

  removeUser(id: string) {
    const transaction = this.db.transaction(USER_STORE, "readwrite");

    const request = transaction.objectStore(USER_STORE).delete(id);

    return new Promise<void>((resolve, reject) => {
      request.onsuccess = (e) => resolve();
      request.onerror = (e) => reject(request.error);

    });
  }


  updateUser(entry: KnownUser) {
    const transaction = this.db.transaction(USER_STORE, "readwrite");

    const request = transaction.objectStore(USER_STORE).put(entry);

    return new Promise<void>((resolve, reject) => {
      request.onsuccess = (e) => resolve();
      request.onerror = (e) => reject(request.error);

    })
  }

  getUser(id: string) {
    const transaction = this.db.transaction(USER_STORE, "readonly");

    const request = transaction.objectStore(USER_STORE).get(id);

    return new Promise<KnownUser>((resolve, reject) => {
      request.onsuccess = (e) => resolve(request.result);
      request.onerror = (e) => reject(request.error);

    })
  }
  
  
  addKey(entry: KeyEntry) {
    const transaction = this.db.transaction(KEY_STORE, "readwrite");

  
    const objectStore = transaction.objectStore(KEY_STORE);
  
    //for all data inserted, if the ObjectStore has an explicit KeyPath,
    //then you must include it in the value JSON.
    const request = objectStore.add(keyEntryToRawKeyEntry(entry));
  
    return new Promise<void>((resolve, reject) => {
      request.onsuccess = (event) => {
        resolve();
      }
    
    
      request.onerror = (event) => {
        console.error("Failed to add item: ", request.error);
        reject(request.error);
      }
    });
  }
  
  removeKey(keyType: KeyType) {
    const transaction = this.db.transaction(KEY_STORE, "readwrite");
  
    const objectStore = transaction.objectStore(KEY_STORE);
    let request = objectStore.delete(keyType);

    return new Promise<void>((resolve, reject) => {
      request.onsuccess = (e) => resolve();
      request.onerror = (e) => {
        console.error(request.error);
        reject(request.error);
      }
    });
  
  }
  
  updateKey(entry: KeyEntry) {
    const transaction = this.db.transaction(KEY_STORE, "readwrite");
  
    const objectStore = transaction.objectStore(KEY_STORE);
  
    //note that if key does not exist, "put" will automatically add this item
    //for all data inserted, if the ObjectStore has an explicit KeyPath,
    //then you must include it in the value JSON.
    let request = objectStore.put(keyEntryToRawKeyEntry(entry));
    return new Promise<void>((resolve, reject) => {
      request.onsuccess = (e) => resolve();
      request.onerror = (e) => {
        console.error(request.error);
        reject(request.error);
      }
    });
  
  }
  
  getKey(keyType: KeyType.IDENTITY_KEY_PAIR) : Promise<{privateKey: ECDSAPrivateKey, publicKey: ECDSAPublicKey} | undefined>
  getKey(keyType: KeyType.EXCHANGE_ID_PAIR) : Promise<{privateKey: ECDHPrivateKey, publicKey: ECDHPublicKey} | undefined>
  getKey(keyType: KeyType.EXCHANGE_PREKEY_PAIR) : Promise<{privateKey: ECDHPrivateKey, publicKey: ECDHPrivateKey} | undefined>
  getKey(keyType: KeyType) {
    const transaction = this.db.transaction(KEY_STORE, "readonly");
  
    const objectStore = transaction.objectStore(KEY_STORE);
  
    //note that if key does not exist, "put" will automatically add this item
    let request = objectStore.get(keyType);
  
  
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        if(!request.result) {
          return resolve(undefined);
        }

        

        let entry;
        try {
          entry = rawKeyEntryToKeyEntry(request.result);
        } catch(e) {
          console.error(e);
          return reject(e);
        }
        

        resolve({privateKey: entry.privateKey, publicKey: entry.publicKey});
      };
      request.onerror = (event) => {
        reject(request.error);
      };
    })
    
  
  }
  
  
  addChat(entry: ChatEntry) : Promise<void> {
    const transaction = this.db.transaction(CHAT_STORE, "readwrite");
    const objectStore = transaction.objectStore(CHAT_STORE);
  
    //note that if key does not exist, "put" will automatically add this item
    let request = objectStore.add(chatEntryToRawChatEntry(entry));
  
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        resolve();
      };
      request.onerror = (event) => {
        reject(request.error);
      };
    })
  }
  
  updateChat(entry: ChatEntry) : Promise<void> {
    const transaction = this.db.transaction(CHAT_STORE, "readwrite");
    const objectStore = transaction.objectStore(CHAT_STORE);
  
    //note that if key does not exist, "put" will automatically add this item
    let request = objectStore.put(chatEntryToRawChatEntry(entry));
  
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        resolve();
      };
      request.onerror = (event) => {
        reject(request.error);
      };
    })
  }

  async updateLastReadMessageChat(chatId: number, uuid: string) : Promise<void> {
    let chatEntry = await this.getChat(chatId);
    chatEntry.lastReadMessageUUID = uuid;
    await this.updateChat(chatEntry);
  }
  
  getChat(chatId: number) : Promise<ChatEntry> {
    const transaction = this.db.transaction(CHAT_STORE, "readonly");
    const objectStore = transaction.objectStore(CHAT_STORE);
  
    //note that if key does not exist, "put" will automatically add this item
    let request = objectStore.get(chatId);
  
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        resolve(rawChatEntryToChatEntry(request.result));
      };
      request.onerror = (event) => {
        reject(request.error);
      };
    })
  }
  /*
  async addMemberToChat(chatId: string, memberId: string) {
    let chatEntry = await this.getChat(chatId);
    chatEntry.members.push({id: memberId});
    await this.updateChat(chatEntry);
  }
  
  async removeMemberFromChat(chatId: string, memberId: string) {
    let chatEntry = await this.getChat(chatId);
  
    let selectedUserIndex = chatEntry.members.findIndex(e => e.id === memberId);
  
    if(selectedUserIndex === -1) {
      return;
    }
  
    chatEntry.members.splice(selectedUserIndex, 1);
    await this.updateChat(chatEntry);
  }
  */
  
  
  addMessage(entry: MessageEntry) {
    const transaction = this.db.transaction(MESSAGE_STORE, "readwrite");
    const objectStore = transaction.objectStore(MESSAGE_STORE);
  
    let request = objectStore.add(entry);
  
    return new Promise<number>((resolve, reject) => {
      request.onsuccess = (ev) => {
        resolve(request.result as number);
      };
  
      request.onerror = (ev) => {
        reject(request.error);
      }
    });
  }
  
  
  /**
   * Returns the messages from this chat, sorted from newest to oldest.
   * 
   * @param chatId - the chat to get the messages from
   * @param numMessages - the number of messages to retrieve
   * @returns 
   */
  getMessages(chatId: number, numMessages?: number, newestToOldest: boolean = true) : Promise<MessageEntry[]>{
    const transaction = this.db.transaction(MESSAGE_STORE, "readonly");
    const objectStore = transaction.objectStore(MESSAGE_STORE);
  
    //get index for message store
    let chatIndex = objectStore.index('chatId');
  
    //prev means that entries are sorted in decreasing order (5,4,3,2,1)
    let request = chatIndex.openCursor(IDBKeyRange.only(chatId), newestToOldest ? 'prev' : 'next');
  
    return new Promise((resolve, reject) => {
      let rtn: MessageEntry[] = [];
      let messageIndex = 0;
  
      request.onsuccess = (event) => {
        //@ts-ignore
        const cursor: IDBCursorWithValue | null = event.target.result;
  
        //if all messages have been searched by cursor or the limit on 
        //the number of messages has been reached
        if(!cursor || (numMessages && messageIndex >= numMessages)) {
          resolve(rtn);
          return;
        }
  
        rtn.push(cursor.value);
        messageIndex++;
  
        cursor.continue();
      };
  
      request.onerror = (ev) => {
        reject(request.error);
      }
    });
   
  }
  
  deleteMessage(messageId: number) {
    const transaction = this.db.transaction(MESSAGE_STORE, "readwrite");
    const objectStore = transaction.objectStore(MESSAGE_STORE);
  
    let request = objectStore.delete(messageId);
  
    return new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        resolve();
      };
  
      request.onerror = (ev) => {
        reject(request.error);
      }
    });
  }
  
  
  printDBContents() {
    const transaction = this.db.transaction(KEY_STORE, "readonly");
    const objectStore = transaction.objectStore(KEY_STORE);
  
    console.log("Printing Contents of Database...");
  
    objectStore.openCursor().onsuccess = (event) => {
      //@ts-ignore
      const cursor: IDBCursorWithValue | null = event.target.result;
  
      if(!cursor) {
        console.log("Finished printing out database");
        return;
      }
  
      console.log(`Key=${cursor.key}, Value=${cursor.value}`);
  
      cursor.continue();
    };
  
  }
  
  clearObjectStore() {
    const transaction = this.db.transaction(DB_NAME, "readwrite");
    const objectStore = transaction.objectStore(KEY_STORE);
  
    objectStore.clear().onsuccess = (event) => {
      console.log("Database cleared.");
    };
  }
}


