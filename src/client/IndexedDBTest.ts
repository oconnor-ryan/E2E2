/*
  WARNING:
  Don't assume that IndexedDB is permanently persistant. 
  A user can easily delete the contents of IndexedDB when clearing cookies and cache.
  Depending on the browser, it may also delete data in IndexedDB if the browser
  believes that it is storing too much data
*/

//this allows you to make sure that data in IndexedDB is only deleted
//if the user explicitly does so. May be useful if I can't figure out
//how to generate the necessary encryption keys for each user session.

/*
navigator.storage.persist().then((persistant) => {
  console.log("Allow persistance: " + persistant);
}).catch(e => {
  console.error(e);
});
*/

const DB_NAME = "mydb";
let DBOpenRequest = window.indexedDB.open(DB_NAME, 2);

let db: IDBDatabase | undefined;

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

  createNewObjectStore();

 // objectStore.createIndex("Key", "Key", {unique: true});
};

function createNewObjectStore() {
  if(!db) {
    return;
  }

  console.log(db.objectStoreNames);
  if(db.objectStoreNames.length == 0) {
    //note that KeyPath is equivalent to PRIMARy KEY in relational databases
    const objectStore = db.createObjectStore(DB_NAME, {
      keyPath: "Key",
    });
  }
}


DBOpenRequest.onerror = (event) => {
  console.error("Failed to open database", DBOpenRequest.error);
};

DBOpenRequest.onsuccess = (event) => {
  db = DBOpenRequest.result;
  console.log("Open Success");


  //clearObjectStore();

  addDataToDB("Hi");
  addDataToDB("You");

  printDBContents();

};


//Standard CRUD operations below

function addDataToDB(value: string) {
  if(!db) {
    return;
  }

  const transaction = db.transaction(DB_NAME, "readwrite");

  transaction.oncomplete = (event) => {
    console.log("Added item to database");
  };

  transaction.onerror = (event) => {
    console.error("Item cannot be added to database!", transaction.error);
  }

  const objectStore = transaction.objectStore(DB_NAME);

  //for all data inserted, if the ObjectStore has an explicit KeyPath,
  //then you must include it in the value JSON.
  const request = objectStore.add({Key: value});

  request.onsuccess = (event) => {
    
  }


  request.onerror = (event) => {
    console.error("Failed to add item: ", request.error);
  }

}

function removeItemFromDB(key: string) {
  if(!db) {
    return;
  }

  const transaction = db.transaction(DB_NAME, "readwrite");

  transaction.oncomplete = (event) => {
    console.log("Deleted item from database");
  };

  transaction.onerror = (event) => {
    console.error("Item cannot be deleted from database!", transaction.error);
  }

  const objectStore = transaction.objectStore(DB_NAME);
  objectStore.delete(key);

}

function updateItem(value: string) {
  if(!db) {
    return;
  }

  const transaction = db.transaction(DB_NAME, "readwrite");

  transaction.oncomplete = (event) => {
    console.log("Updated item from database");
  };

  transaction.onerror = (event) => {
    console.error("Item cannot be updated from database!", transaction.error);
  };

  const objectStore = transaction.objectStore(DB_NAME);

  //note that if key does not exist, "put" will automatically add this item
  //for all data inserted, if the ObjectStore has an explicit KeyPath,
  //then you must include it in the value JSON.
  objectStore.put({Key: value});

}

function getItem(key: string) {
  if(!db) {
    return;
  }

  const transaction = db.transaction(DB_NAME, "readonly");

  transaction.oncomplete = (event) => {
    console.log("Got item from database");
  };

  transaction.onerror = (event) => {
    console.error("Item cannot be retrieved from database!", transaction.error);
  };

  const objectStore = transaction.objectStore(DB_NAME);

  //note that if key does not exist, "put" will automatically add this item
  let request = objectStore.get(key);
  request.onsuccess = (event) => {
    console.log(`Key=${key}, Value=${request.result}`);
  }

}

function printDBContents() {
  if(!db) {
    return;
  }

  const transaction = db.transaction(DB_NAME, "readonly");
  const objectStore = transaction.objectStore(DB_NAME);

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
    return;
  }

  const transaction = db.transaction(DB_NAME, "readwrite");
  const objectStore = transaction.objectStore(DB_NAME);

  objectStore.clear().onsuccess = (event) => {
    console.log("Database cleared.");
  };
}