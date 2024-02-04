/*
WARNING:
  Don't assume that IndexedDB is permanently persistant. 
  A user can easily delete the contents of IndexedDB when clearing cookies and cache
  even if they tell the browser that this website's data should persist.
*/


const DB_NAME = "e2e2";
const KEY_STORE = "key_store";

let db: IDBDatabase | undefined;

const localStorage = window.localStorage;

let persistData = false;

//this allows you to make sure that data in IndexedDB is only deleted
//if the user explicitly does so. 
//
//Note that in Firefox, if you tell it to delete all site data when
//the browser is closed, this WILL INCLUDE data put in persistant storage.
//
//When first creating an account, make sure to tell user that if they delete
//site data when closing browser, leave this website as an exception.
navigator.storage.persist().then((persistant) => {
  persistData = persistant;
  console.log("Allow persistance: " + persistant);
  if(!persistant) {
    throw new Error("You must allow persistance for this app to work correctly!");
  }

  initDB();

}).catch(e => {
  console.error(e);
});

export function updateUsername(username: string) : boolean {
  if(!persistData) {
    return false;
  }

  localStorage.setItem("username", username);
  return true;

}


export function getUsername() {
  if(!persistData) {
    return null;
  }

  return localStorage.getItem("username");
}


function initDB() {
  let DBOpenRequest = window.indexedDB.open(DB_NAME, 1);

  
  // This event handles the event whereby a new version of the database needs to be created
  // Either one has not been created before, or a new version number has been submitted via the
  // window.indexedDB.open line above
  DBOpenRequest.onupgradeneeded = (event) => {
    //@ts-ignore
    db = event.target.result;
  
    console.log("Upgrade Needed");
    if(!db) {
      return;
    }
  
    db.onerror = (event) => {
      console.log("Error Loading database!");
    }
  
    console.log(db.objectStoreNames);

    if(db.objectStoreNames.length == 0) {
      //note that KeyPath is equivalent to PRIMARy KEY in relational databases
      let objectStore = db.createObjectStore(KEY_STORE, {
        keyPath: "keyType",
      });

     //objectStore.createIndex("Key", "Key", {unique: true});

    }
  
  };
  
  
  
  DBOpenRequest.onerror = (event) => {
    console.error("Failed to open database", DBOpenRequest.error);
  };
  
  DBOpenRequest.onsuccess = (event) => {
    db = DBOpenRequest.result;
    console.log("Open Success");  
  };  
}


//Standard CRUD operations below

export function addKey(keyType: string, value: CryptoKey | CryptoKeyPair) {
  if(!db) {
    throw new Error("Database was never initialized!");
  }

  const transaction = db.transaction(KEY_STORE, "readwrite");

  transaction.oncomplete = (event) => {
    console.log("Added item to database");
  };

  transaction.onerror = (event) => {
    console.error("Item cannot be added to database!", transaction.error);
  }

  const objectStore = transaction.objectStore(KEY_STORE);

  //for all data inserted, if the ObjectStore has an explicit KeyPath,
  //then you must include it in the value JSON.
  const request = objectStore.add({keyType: keyType, key: value});

  request.onsuccess = (event) => {
    
  }


  request.onerror = (event) => {
    console.error("Failed to add item: ", request.error);
  }

}

export function removeKey(keyType: string) {
  if(!db) {
    throw new Error("Database was never initialized!");
  }

  const transaction = db.transaction(KEY_STORE, "readwrite");

  transaction.oncomplete = (event) => {
    console.log("Deleted item from database");
  };

  transaction.onerror = (event) => {
    console.error("Item cannot be deleted from database!", transaction.error);
  }

  const objectStore = transaction.objectStore(KEY_STORE);
  objectStore.delete(keyType);

}

export function updateKey(keyType: string, value: CryptoKey | CryptoKeyPair) {
  if(!db) {
    throw new Error("Database was never initialized!");
  }

  const transaction = db.transaction(KEY_STORE, "readwrite");

  transaction.oncomplete = (event) => {
    console.log("Updated item from database");
  };

  transaction.onerror = (event) => {
    console.error("Item cannot be updated from database!", transaction.error);
  };

  const objectStore = transaction.objectStore(KEY_STORE);

  //note that if key does not exist, "put" will automatically add this item
  //for all data inserted, if the ObjectStore has an explicit KeyPath,
  //then you must include it in the value JSON.
  objectStore.put({keyType: keyType, key: value});

}

export async function getKey(keyType: string) : Promise<CryptoKey | CryptoKeyPair | undefined> {
  if(!db) {
    throw new Error("Database was never initialized!");
  }

  const transaction = db.transaction(KEY_STORE, "readonly");

  transaction.oncomplete = (event) => {
    console.log("Got item from database");
  };

  transaction.onerror = (event) => {
    console.error("Item cannot be retrieved from database!", transaction.error);
  };

  const objectStore = transaction.objectStore(KEY_STORE);

  //note that if key does not exist, "put" will automatically add this item
  let request = objectStore.get(keyType);


  return new Promise((resolve, reject) => {
    request.onsuccess = (event) => {
      let record = request.result;
      resolve(record.key);
    };
    request.onerror = (event) => {
      reject(request.error);
    };
  })
  

}

export function printDBContents() {
  if(!db) {
    throw new Error("Database was never initialized!");
  }

  const transaction = db.transaction(KEY_STORE, "readonly");
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

function clearObjectStore() {
  if(!db) {
    throw new Error("Database was never initialized!");
  }

  const transaction = db.transaction(DB_NAME, "readwrite");
  const objectStore = transaction.objectStore(KEY_STORE);

  objectStore.clear().onsuccess = (event) => {
    console.log("Database cleared.");
  };
}