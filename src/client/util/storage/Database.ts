import { AccountStore, GroupChatRequestStore, GroupChatStore, KnownUserStore, MessageRequestStore, MessageStore, PendingInviteStore } from "./ObjectStore.js";

const DB_NAME = 'e2e2';
const DB_VERSION = 1;

/***** Object Stores *****/
//Active Stores
const ACCOUNT_STORE = "accounts";
const KNOWN_USER_STORE = "known_users";
const GROUP_CHAT_STORE = "group_chats";
const MESSAGE_STORE = "messages";
const PENDING_INVITE_STORE = "pending_invites";
const MESSAGE_REQUEST_STORE = "message_requests";
const GROUP_CHAT_REQUEST_STORE = "group_chat_requests"

//Deleted Stores


export class Database {
  //these are the current list of active stores in the database
  public readonly accountStore: AccountStore;
  public readonly knownUserStore: KnownUserStore;
  public readonly groupChatStore: GroupChatStore;
  public readonly messageStore: MessageStore;
  public readonly pendingInviteStore: PendingInviteStore;
  public readonly messageRequestStore: MessageRequestStore;
  public readonly groupChatRequestStore: GroupChatRequestStore;

  private constructor(
    accountStore: AccountStore,
    knownUserStore: KnownUserStore,
    groupChatStore: GroupChatStore,
    messageStore: MessageStore,
    pendingInviteStore: PendingInviteStore,
    messageRequestStore: MessageRequestStore,
    groupChatRequestStore: GroupChatRequestStore
  ) {
    this.accountStore = accountStore;
    this.knownUserStore = knownUserStore;
    this.groupChatStore = groupChatStore;
    this.messageStore = messageStore;
    this.pendingInviteStore = pendingInviteStore;
    this.messageRequestStore = messageRequestStore;
    this.groupChatRequestStore = groupChatRequestStore;
  }

  static async initDB() {
    let DBOpenRequest = window.indexedDB.open(DB_NAME, DB_VERSION);



    
  
  
    return new Promise<Database>((resolve, reject) => {
      DBOpenRequest.onerror = (event) => {
        console.error("Failed to open database", DBOpenRequest.error);
        reject(DBOpenRequest.error);
      };

      // This event handles the event whereby a new version of the database needs to be created
      // Either one has not been created before, or a new version number has been submitted via the
      // window.indexedDB.open line above
      DBOpenRequest.onupgradeneeded = (event) => {
        //@ts-ignore
        let db: IDBDatabase = event.target.result;
      
        console.log(`Upgrade Needed from ${event.oldVersion} to ${event.newVersion}`);
      
        console.log(db.objectStoreNames);

        //list of active stores
        let accountStore = new AccountStore(ACCOUNT_STORE, db);
        let knownUserStore = new KnownUserStore(KNOWN_USER_STORE, db);
        let groupChatStore = new GroupChatStore(GROUP_CHAT_STORE, db);
        let messageStore = new MessageStore(MESSAGE_STORE, db);
        let pendingInviteStore = new PendingInviteStore(PENDING_INVITE_STORE, db);
        let messageRequestStore = new MessageRequestStore(MESSAGE_REQUEST_STORE, db);
        let groupChatRequestStore = new GroupChatRequestStore(GROUP_CHAT_REQUEST_STORE, db);

        switch(event.oldVersion) {
          case 0:
            //make sure that object stores are written into indexeddb during 
            //database upgrade
            accountStore.initObjectStore();
            knownUserStore.initObjectStore();
            groupChatStore.initObjectStore();
            messageStore.initObjectStore();
            pendingInviteStore.initObjectStore();
            messageRequestStore.initObjectStore();
            groupChatRequestStore.initObjectStore();
          case 1:
            //can migrate data here
            //accountStore.migrateData(event.oldVersion)
          default: 
            break;
        }
      };
      
      DBOpenRequest.onsuccess = (event) => {
        console.log("Open Success");  
        let db = DBOpenRequest.result;

        resolve(new Database(
          new AccountStore(ACCOUNT_STORE, db),
          new KnownUserStore(KNOWN_USER_STORE, db),
          new GroupChatStore(GROUP_CHAT_STORE, db),
          new MessageStore(MESSAGE_STORE, db),
          new PendingInviteStore(PENDING_INVITE_STORE, db),
          new MessageRequestStore(MESSAGE_REQUEST_STORE, db),
          new GroupChatRequestStore(GROUP_CHAT_REQUEST_STORE, db)
        ));
      };  
    });
  }
}