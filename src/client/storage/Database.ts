import { AccountStore, FileStore, GroupChatStore, KnownUserStore, KeyExchangeRequestStore, MessageStore } from "./ObjectStore.js";

const DB_NAME = 'e2e2';
const DB_VERSION = 1;

/***** Object Stores *****/
//Active Stores
const ACCOUNT_STORE = "accounts";
const KNOWN_USER_STORE = "known_users";
const GROUP_CHAT_STORE = "group_chats";
const MESSAGE_STORE = "messages";
const KEY_EXCHANGE_STORE = "key_exchanges";
const FILE_STORE = 'file_store'

//Deleted Stores


abstract class DataMigrator {
  protected migrationData: any;
  
  abstract grabMigrationData(db: IDBDatabase) : Promise<void> ;
  abstract insertMigrationData(db: IDBDatabase): Promise<void>;
}




export class Database {
  //these are the current list of active stores in the database
  public readonly accountStore: AccountStore;
  public readonly knownUserStore: KnownUserStore;
  public readonly groupChatStore: GroupChatStore;
  public readonly messageStore: MessageStore;
  public readonly messageInviteStore: KeyExchangeRequestStore;
  public readonly fileStore: FileStore;

  private constructor(
    accountStore: AccountStore,
    knownUserStore: KnownUserStore,
    groupChatStore: GroupChatStore,
    messageStore: MessageStore,
    messageInviteStore: KeyExchangeRequestStore,
    fileStore: FileStore
  ) {
    this.accountStore = accountStore;
    this.knownUserStore = knownUserStore;
    this.groupChatStore = groupChatStore;
    this.messageStore = messageStore;
    this.messageInviteStore = messageInviteStore;
    this.fileStore = fileStore
  }

  
  static async initDB() {
    let DBOpenRequest = window.indexedDB.open(DB_NAME, DB_VERSION);

    //Used to grab old data from previous object store before deleting the store
    //since this data is backed up into memory, once the new object stores
    //are created and the versionchange is complete, we can now move
    //data into the new object stores
    let dataMigrator: DataMigrator; 


    // This event handles the event whereby a new version of the database needs to be created
    // Either one has not been created before, or a new version number has been submitted via the
    // window.indexedDB.open line above
    // note that this will execute syncronously before the onsuccess event,
    // giving you time to add and delete object stores, create indexes, etc 
    DBOpenRequest.onupgradeneeded = (event) => {
      let openDbRequest = event.target as IDBOpenDBRequest
      let db: IDBDatabase = openDbRequest.result;
      let transaction = openDbRequest.transaction; //use this transaction to perform data migrations between old objectStores

      
      console.log(`Upgrade Needed from ${event.oldVersion} to ${event.newVersion}`);
    
      console.log(db.objectStoreNames);

      //list of active stores
      let accountStore = new AccountStore(ACCOUNT_STORE, db);
      let knownUserStore = new KnownUserStore(KNOWN_USER_STORE, db);
      let groupChatStore = new GroupChatStore(GROUP_CHAT_STORE, db);
      let messageStore = new MessageStore(MESSAGE_STORE, db);
      let messageRequestStore = new KeyExchangeRequestStore(KEY_EXCHANGE_STORE, db);
      let fileEntryStore = new FileStore(FILE_STORE, db);

      switch(event.oldVersion) {
        case 0:
          //make sure that object stores are written into indexeddb during 
          //database upgrade
          accountStore.initObjectStore();
          knownUserStore.initObjectStore();
          groupChatStore.initObjectStore();
          messageStore.initObjectStore();
          messageRequestStore.initObjectStore();
          fileEntryStore.initObjectStore();
        case 1:
          //can change individual object stores here
          //accountStore.migrateData(event.oldVersion)

          //or write functions that migrate data from one
          //message store to another
          //dataMigrator.grabMigrationData(db);

          
        default: 
          break;
      }
    };

  
    return new Promise<Database>((resolve, reject) => {
      DBOpenRequest.onerror = (event) => {
        console.error("Failed to open database", DBOpenRequest.error);
        reject(DBOpenRequest.error);
      };

      
      
      DBOpenRequest.onsuccess = (event) => {
        console.log("Open Success");  
        let db = DBOpenRequest.result;

        //from here, you can start migrating data from old object stores to new object stores
        //dataMigrator.insertMigrationData(db);
        resolve(new Database(
          new AccountStore(ACCOUNT_STORE, db),
          new KnownUserStore(KNOWN_USER_STORE, db),
          new GroupChatStore(GROUP_CHAT_STORE, db),
          new MessageStore(MESSAGE_STORE, db),
          new KeyExchangeRequestStore(KEY_EXCHANGE_STORE, db),
          new FileStore(FILE_STORE, db)
        ));
      };  
    });
  }
}