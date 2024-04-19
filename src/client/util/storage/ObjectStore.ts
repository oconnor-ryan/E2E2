import { ECDHKeyPair, ECDSAKeyPair, ECDSAKeyPairBuilder, ECDHKeyPairBuilder, ECDSAPublicKey, ECDHPublicKey } from "../../encryption/encryption.js";

/**
 * Used to remove boilerplate for basic CRUD operations in object stores.
 * For each entry, there is a regular Entry that is public to the user of this 
 * class and a private RawEntry which stores the contents of Entry in a way compatible to 
 * what IndexedDB allows (JSON values only, IndexedDB will throw errors if a class object is used).
 * For more complex queries (such as those that require filtering data or using cursors),
 * you will have to implement that functionality using the lower-level IndexedDB API instead
 * of this class.
 */
abstract class ObjectStorePromise<Identifier extends IDBValidKey | IDBKeyRange, Entry, RawEntry> {
  public readonly objStoreName: string;
  public readonly db: IDBDatabase;

  constructor(objStore: string, db: IDBDatabase) {
    this.objStoreName = objStore;
    this.db = db;
  }

  initObjectStore() {
    try {
      if(!this.db.objectStoreNames.contains(this.objStoreName)) {
        let objStore = this.db.createObjectStore(this.objStoreName, this.getStoreOptions());
        this.setStoreIndices(objStore);
      }
    } catch(e) {
      //this can be ignored since this indicates that the user was not
      //supposed to call this function since it can only be called in
      //a upgrade event in IndexedDB
    }
    
  }

  //used to migrate between different versions of this object store
  abstract migrateData(oldVersion: number): Promise<void>;

  protected abstract getStoreOptions(): IDBObjectStoreParameters;
  protected abstract setStoreIndices(objStore: IDBObjectStore): void;
  protected abstract convertEntryToRaw(entry: Entry): RawEntry;
  protected abstract convertRawToEntry(raw: RawEntry): Entry;


  async get(id: Identifier) : Promise<Entry> {
    const transaction = this.db.transaction(this.objStoreName, "readonly");

    const request = transaction.objectStore(this.objStoreName).get(id);

    return new Promise<Entry>((resolve, reject) => {
      request.onsuccess = (e) => resolve(this.convertRawToEntry(request.result));
      request.onerror = (e) => reject(request.error);
    }) 
  }

  async getAll() : Promise<Entry[]> {
    const transaction = this.db.transaction(this.objStoreName, "readonly");

    const request = transaction.objectStore(this.objStoreName).getAll();

    return new Promise<Entry[]>((resolve, reject) => {
      request.onsuccess = (e) => resolve(request.result.map((row) => this.convertRawToEntry(row)));
      request.onerror = (e) => reject(request.error);
    }) 
  }

  async add(entry: Entry) : Promise<Identifier> {
    const transaction = this.db.transaction(this.objStoreName, "readwrite");
    const request = transaction.objectStore(this.objStoreName).add(this.convertEntryToRaw(entry));

    return new Promise<Identifier>((resolve, reject) => {
      request.onsuccess = (e) => resolve(request.result as Identifier);
      request.onerror = (e) => reject(request.error);
    }) 
  }

  async update(entry: Entry) : Promise<Identifier> {
    const transaction = this.db.transaction(this.objStoreName, "readwrite");
    const request = transaction.objectStore(this.objStoreName).put(this.convertEntryToRaw(entry));

    return new Promise<Identifier>((resolve, reject) => {
      request.onsuccess = (e) => resolve(request.result as Identifier);
      request.onerror = (e) => reject(request.error);
    }) 
  }

  async delete(id: Identifier) : Promise<void> {
    const transaction = this.db.transaction(this.objStoreName, "readwrite");
    const request = transaction.objectStore(this.objStoreName).delete(id);

    return new Promise<void>((resolve, reject) => {
      request.onsuccess = (e) => resolve();
      request.onerror = (e) => reject(request.error);
    }) 
  }

  async deleteAll() {
    const transaction = this.db.transaction(this.objStoreName, "readwrite");
    const request = transaction.objectStore(this.objStoreName).clear();
    return new Promise<void>((resolve, reject) => {
      request.onsuccess = (e) => resolve();
      request.onerror = (e) => reject(request.error);
    }) 
  }

}



export interface AccountEntry {
  id: string,
  identityKeyPair: ECDSAKeyPair
  exchangeIdKeyPair: ECDHKeyPair,
  exchangeIdPreKeyPair: ECDHKeyPair,
  exchangeIdPreKeyBundlePair: ECDHKeyPair[],
  mailboxId: string,
}

interface AccountEntryRaw {
  id: string,
  identityKeyPair: CryptoKeyPair
  exchangeIdKeyPair: CryptoKeyPair,
  exchangeIdPreKeyPair: CryptoKeyPair,
  exchangeIdPreKeyBundlePair: CryptoKeyPair[],
  mailboxId: string,
}

export class AccountStore extends ObjectStorePromise<string, AccountEntry, AccountEntryRaw> {

  protected getStoreOptions(): IDBObjectStoreParameters {
    return {
      keyPath: 'id'
    }
  }

  protected setStoreIndices(objectStore: IDBObjectStore): void {}

  async migrateData(oldVersion: number) {
    //for each version upgrade, apply a conversion function to migrate old data
    //to new version
    switch(oldVersion) {
      case 0:

      case 1: 

      case 2:
    }
  }

  convertEntryToRaw(entry: AccountEntry) : AccountEntryRaw {
    return {
      id: entry.id,
      identityKeyPair: entry.identityKeyPair.getCryptoKeyPair(),
      exchangeIdKeyPair: entry.exchangeIdKeyPair.getCryptoKeyPair(),
      exchangeIdPreKeyPair: entry.exchangeIdPreKeyPair.getCryptoKeyPair(),
      exchangeIdPreKeyBundlePair: entry.exchangeIdPreKeyBundlePair.map((val) => val.getCryptoKeyPair()),
      mailboxId: entry.mailboxId
    };
  }

  convertRawToEntry(entry: AccountEntryRaw) : AccountEntry {
    let ecdsaKeyBuilder = new ECDSAKeyPairBuilder();
    let ecdhKeyBuilder = new ECDHKeyPairBuilder();


    return {
      id: entry.id,
      identityKeyPair: ecdsaKeyBuilder.getKeyPairWrapperFromCryptoKeyPair(entry.identityKeyPair),
      exchangeIdKeyPair: ecdhKeyBuilder.getKeyPairWrapperFromCryptoKeyPair(entry.exchangeIdKeyPair),
      exchangeIdPreKeyPair: ecdhKeyBuilder.getKeyPairWrapperFromCryptoKeyPair(entry.exchangeIdPreKeyPair),
      exchangeIdPreKeyBundlePair: entry.exchangeIdPreKeyBundlePair.map((val) => ecdhKeyBuilder.getKeyPairWrapperFromCryptoKeyPair(val)),
      mailboxId: entry.mailboxId
    };
  }
}

export interface KnownUserEntry {
  id: string,
  identityKeyPublic: ECDSAPublicKey
  exchangeIdKeyPublic: ECDHPublicKey,
  exchangeIdPreKeyPublic: ECDHPublicKey,
  exchangeIdPreKeyBundlePublic: ECDHPublicKey[],
  mailboxId: string | undefined,
}

interface KnownUserEntryRaw {
  id: string,
  identityKeyPublic: CryptoKey
  exchangeIdKeyPublic: CryptoKey,
  exchangeIdPreKeyPublic: CryptoKey,
  exchangeIdPreKeyBundlePublic: CryptoKey[],
  mailboxId: string | undefined,
}

export class KnownUserStore extends ObjectStorePromise<string, KnownUserEntry, KnownUserEntryRaw> {

  protected getStoreOptions(): IDBObjectStoreParameters {
    return {
      keyPath: 'id'
    }
  }

  protected setStoreIndices(objectStore: IDBObjectStore): void {
    objectStore.createIndex('identityKeyPublic', 'identityKeyPublic', {unique: true});
  }

  async migrateData(oldVersion: number) {}
  
  convertEntryToRaw(entry: KnownUserEntry) : KnownUserEntryRaw {
    return {
      id: entry.id,
      identityKeyPublic: entry.identityKeyPublic.getCryptoKey(),
      exchangeIdKeyPublic: entry.exchangeIdKeyPublic.getCryptoKey(),
      exchangeIdPreKeyPublic: entry.exchangeIdPreKeyPublic.getCryptoKey(),
      exchangeIdPreKeyBundlePublic: entry.exchangeIdPreKeyBundlePublic.map((val) => val.getCryptoKey()),
      mailboxId: entry.mailboxId
    };
  }

  convertRawToEntry(entry: KnownUserEntryRaw) : KnownUserEntry {

    return {
      id: entry.id,
      identityKeyPublic: new ECDSAPublicKey(entry.identityKeyPublic),
      exchangeIdKeyPublic: new ECDHPublicKey(entry.exchangeIdKeyPublic),
      exchangeIdPreKeyPublic: new ECDHPublicKey(entry.exchangeIdPreKeyPublic),
      exchangeIdPreKeyBundlePublic: entry.exchangeIdPreKeyBundlePublic.map((val) => new ECDHPublicKey(val)),
      mailboxId: entry.mailboxId
    };
  }
}


interface GroupChatEntry {
  groupId: string,
  members: string[]
}

export class GroupChatStore extends ObjectStorePromise<string, GroupChatEntry, GroupChatEntry> {

  protected getStoreOptions(): IDBObjectStoreParameters {
    return {
      keyPath: 'groupId'
    }
  }

  protected setStoreIndices(objectStore: IDBObjectStore): void {}
  
  async migrateData(oldVersion: number) {}

  convertEntryToRaw(entry: GroupChatEntry) : GroupChatEntry {return entry;}
  convertRawToEntry(entry: GroupChatEntry) : GroupChatEntry {return entry;}
}

export interface PendingInvite {
  groupId: string | null,
  receiverId: string,
  expireDate: Date,
  comment: string
}

export class PendingInviteStore extends ObjectStorePromise<[string, string], PendingInvite, PendingInvite> {

  protected getStoreOptions(): IDBObjectStoreParameters {
    return {
      keyPath: ['groupId', 'receiverId']
    }
  }

  protected setStoreIndices(objectStore: IDBObjectStore): void {}
  
  async migrateData(oldVersion: number) {}

  convertEntryToRaw(entry: PendingInvite) : PendingInvite {return entry;}
  convertRawToEntry(entry: PendingInvite) : PendingInvite {return entry;}
}

export interface GroupChatRequest {
  senderId: string,
  groupId: string,
  comment: string,
  members: {
    id: string,
    mailboxId: string
  }[]
}

export class GroupChatRequestStore extends ObjectStorePromise<[string, string], GroupChatRequest, GroupChatRequest> {

  protected getStoreOptions(): IDBObjectStoreParameters {
    return {
      keyPath: ['groupId', 'senderId']
    }
  }

  protected setStoreIndices(objectStore: IDBObjectStore): void {}
  
  async migrateData(oldVersion: number) {}

  convertEntryToRaw(entry: GroupChatRequest) : GroupChatRequest {return entry;}
  convertRawToEntry(entry: GroupChatRequest) : GroupChatRequest {return entry;}
}

export interface MessageRequest {
  senderId: string,
  mailboxId: string,
  comment: string
}

export class MessageRequestStore extends ObjectStorePromise<string, MessageRequest, MessageRequest> {

  protected getStoreOptions(): IDBObjectStoreParameters {
    return {
      keyPath: 'senderId'
    }
  }

  protected setStoreIndices(objectStore: IDBObjectStore): void {}
  
  async migrateData(oldVersion: number) {}

  convertEntryToRaw(entry: MessageRequest) : MessageRequest {return entry;}
  convertRawToEntry(entry: MessageRequest) : MessageRequest {return entry;}
}

export interface MessageData {
  type: string,
  senderIdKeyPublic: string,
  groupId: string | null,
  data: any
}

export interface RegularMessageData extends MessageData {
  type: "message",
  data: {
    message: string
  }
}

export interface FileUploadMessageData extends MessageData {
  type: "file",
  data: {
    message: string,
    fileSignature: string,
    fileId: string,
    fileName: string
  }
}

//Call Data is ephemeral and should not be stored, so bdont define them here
//Invitations and ChatRequests also should not be stored in messages since
//they have their own dedicated object stores



export interface Message {
  id: string,
  insertId: number,
  senderId: string,
  groupId: string | null,
  fromTrustedUser: boolean, //does the senderPublicKey match a key of a user we know?
  isVerified: boolean //was the message signed with the correct public key

  //for the sake of simplicity, we are storing messages the same way that the encrypted payloads
  //of messages are formatted. Note that messages that cannot be decrypted are discarded
  data: {
    signature: string,
    signed_data: MessageData
  }
}

export class MessageStore extends ObjectStorePromise<string, Message, Message> {

  protected getStoreOptions(): IDBObjectStoreParameters {
    return {
      keyPath: 'id'
    }
  }

  protected setStoreIndices(objectStore: IDBObjectStore): void {
    objectStore.createIndex('groupId', 'groupId');
    objectStore.createIndex('senderId', 'senderId');

  }

  async migrateData(oldVersion: number) {}

  convertEntryToRaw(entry: Message): Message {return entry;}
  convertRawToEntry(raw: Message): Message {return raw;}


  getMessages(id: string, idType: 'group' | 'individual', newestToOldest: boolean = false) {
    const transaction = this.db.transaction(this.objStoreName, "readonly");
    const objStore = transaction.objectStore(this.objStoreName);

    let index = idType === 'group' ? objStore.index('groupId') : objStore.index('senderId');

    let request = index.openCursor(IDBKeyRange.only(id), newestToOldest ? 'prev' : 'next')

    return new Promise((resolve, reject) => {
      let rtn: Message[] = [];
      request.onsuccess = (ev) => {
        //@ts-ignore
        const cursor: IDBCursorWithValue | null = ev.target.result;

        if(!cursor) {
          return resolve(rtn);
        }

        rtn.push(cursor.value);
        cursor.continue();
      }

      request.onerror = (ev) => {
        return reject(request.error);
      }
    })
  }
  
}