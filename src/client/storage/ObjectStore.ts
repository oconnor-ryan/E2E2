import { Message, KeyExchangeRequest, StoredMessageBase, StoredKeyExchangeRequest, StoredKeyExchangeRequestRaw } from "../message-handler/MessageType.js";
import { ECDHKeyPair, ECDSAKeyPair, ECDSAKeyPairBuilder, ECDHKeyPairBuilder, ECDSAPublicKey, ECDHPublicKey, AesGcmKey } from "../encryption/encryption.js";

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
  abstract migrateData(oldVersion: number): void;

  protected abstract getStoreOptions(): IDBObjectStoreParameters;
  protected abstract setStoreIndices(objStore: IDBObjectStore): void;
  protected abstract convertEntryToRaw(entry: Entry): RawEntry;
  protected abstract convertRawToEntry(raw: RawEntry): Entry;


  async get(id: Identifier) : Promise<Entry | null> {
    const transaction = this.db.transaction(this.objStoreName, "readonly");

    const request = transaction.objectStore(this.objStoreName).get(id);

    return new Promise<Entry | null>((resolve, reject) => {
      request.onsuccess = (e) => resolve(request.result ? this.convertRawToEntry(request.result) : null);
      request.onerror = (e) => reject(request.error);
    }) 
  }

  async has(id: Identifier) : Promise<boolean> {
    return !!(await this.get(id)); 
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
  username: string,
  password: string,
  identityKeyPair: ECDSAKeyPair
  exchangeIdKeyPair: ECDHKeyPair,
  exchangeIdPreKeyPair: ECDHKeyPair,
  exchangeIdPreKeyBundlePair: ECDHKeyPair[],
  mailboxId: string,
  lastReadMessageUUID: string | undefined,
  lastReadKeyExchangeRequestUUID: string | undefined,
}

interface AccountEntryRaw {
  username: string,
  password: string,
  identityKeyPair: CryptoKeyPair
  exchangeIdKeyPair: CryptoKeyPair,
  exchangeIdPreKeyPair: CryptoKeyPair,
  exchangeIdPreKeyBundlePair: CryptoKeyPair[],
  mailboxId: string,
  lastReadMessageUUID: string | undefined,
  lastReadKeyExchangeRequestUUID: string | undefined,
}

export class AccountStore extends ObjectStorePromise<string, AccountEntry, AccountEntryRaw> {

  protected getStoreOptions(): IDBObjectStoreParameters {
    return {
      keyPath: 'username'
    }
  }

  async setLastReadMessage(username: string, messageUUID: string) {
    let acc = await this.get(username);
    if(!acc) {
      throw new Error("Account not found!")
    }
    
    acc.lastReadMessageUUID = messageUUID;

    return this.update(acc);

  }

  async setLastReadKeyExchangeRequest(username: string, keyExchangeRequestUUID: string) {
    let acc = await this.get(username);
    if(!acc) {
      throw new Error("Account not found!")
    }

    acc.lastReadKeyExchangeRequestUUID = keyExchangeRequestUUID;

    return this.update(acc);

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
      username: entry.username,
      password: entry.password,
      identityKeyPair: entry.identityKeyPair.getCryptoKeyPair(),
      exchangeIdKeyPair: entry.exchangeIdKeyPair.getCryptoKeyPair(),
      exchangeIdPreKeyPair: entry.exchangeIdPreKeyPair.getCryptoKeyPair(),
      exchangeIdPreKeyBundlePair: entry.exchangeIdPreKeyBundlePair.map((val) => val.getCryptoKeyPair()),
      mailboxId: entry.mailboxId,
      lastReadKeyExchangeRequestUUID: entry.lastReadKeyExchangeRequestUUID,
      lastReadMessageUUID: entry.lastReadMessageUUID,

    };
  }

  convertRawToEntry(entry: AccountEntryRaw) : AccountEntry {
    let ecdsaKeyBuilder = new ECDSAKeyPairBuilder();
    let ecdhKeyBuilder = new ECDHKeyPairBuilder();


    return {
      username: entry.username,
      password: entry.password,
      identityKeyPair: ecdsaKeyBuilder.getKeyPairWrapperFromCryptoKeyPair(entry.identityKeyPair),
      exchangeIdKeyPair: ecdhKeyBuilder.getKeyPairWrapperFromCryptoKeyPair(entry.exchangeIdKeyPair),
      exchangeIdPreKeyPair: ecdhKeyBuilder.getKeyPairWrapperFromCryptoKeyPair(entry.exchangeIdPreKeyPair),
      exchangeIdPreKeyBundlePair: entry.exchangeIdPreKeyBundlePair.map((val) => ecdhKeyBuilder.getKeyPairWrapperFromCryptoKeyPair(val)),
      mailboxId: entry.mailboxId,
      lastReadKeyExchangeRequestUUID: entry.lastReadKeyExchangeRequestUUID,
      lastReadMessageUUID: entry.lastReadMessageUUID,
    };
  }
}

export interface KnownUserEntry {
  identityKeyPublicString: string,
  waitingGroupMember?: boolean //used when you're invited to a group chat and its members ask to exchange keys before you accepted the group invite
  username: string,
  remoteServer: string,
  identityKeyPublic: ECDSAPublicKey
  exchangeIdKeyPublic: ECDHPublicKey,
  exchangePreKeyPublic: ECDHPublicKey,
  mailboxId: string | undefined, //if undefined, user has not accepted invite
  currentEncryptionKey: AesGcmKey
}

interface KnownUserEntryRaw {
  identityKeyPublicString: string,
  username: string,
  remoteServer: string,
  identityKeyPublic: CryptoKey
  exchangeIdKeyPublic: CryptoKey,
  exchangePreKeyPublic: CryptoKey,
  mailboxId: string | undefined,
  currentEncryptionKey: CryptoKey
}

export class KnownUserStore extends ObjectStorePromise<string, KnownUserEntry, KnownUserEntryRaw> {

  protected getStoreOptions(): IDBObjectStoreParameters {
    return {
      keyPath: 'identityKeyPublicString'
    }
  }

  protected setStoreIndices(objectStore: IDBObjectStore): void {
    objectStore.createIndex('username-domain', ['username', 'remoteServer'])
  }

  async migrateData(oldVersion: number) {}

  //this can be optimized in future using low-level IndexedDB cursor,
  async getAllFriends() {
    let users = await this.getAll();
    return users.filter((u) => u.mailboxId !== undefined);
  }

  async getAllPendingInviteUsers() {
    let users = await this.getAll();
    return users.filter((u) => u.mailboxId !== undefined);
  }
  
  convertEntryToRaw(entry: KnownUserEntry) : KnownUserEntryRaw {
    return {
      username: entry.username,
      identityKeyPublicString: entry.identityKeyPublicString,
      identityKeyPublic: entry.identityKeyPublic.getCryptoKey(),
      exchangeIdKeyPublic: entry.exchangeIdKeyPublic.getCryptoKey(),
      exchangePreKeyPublic: entry.exchangePreKeyPublic.getCryptoKey(),
      mailboxId: entry.mailboxId,
      currentEncryptionKey: entry.currentEncryptionKey.getCryptoKey(),
      remoteServer: entry.remoteServer
    };
  }

  convertRawToEntry(entry: KnownUserEntryRaw) : KnownUserEntry {

    return {
      username: entry.username,
      identityKeyPublicString: entry.identityKeyPublicString,
      identityKeyPublic: new ECDSAPublicKey(entry.identityKeyPublic),
      exchangeIdKeyPublic: new ECDHPublicKey(entry.exchangeIdKeyPublic),
      exchangePreKeyPublic: new ECDHPublicKey(entry.exchangePreKeyPublic),
      mailboxId: entry.mailboxId,
      currentEncryptionKey: new AesGcmKey(entry.currentEncryptionKey),
      remoteServer: entry.remoteServer
    };
  }
}




interface GroupChatEntry {
  groupId: string,
  status: 'joined-group' | 'pending-approval' | 'denied',
  //contains identity keys of each user in KnownUser
  members: {
    identityKeyPublicString: string,
    username: string,
    remoteServer: string
  }[]
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


export class KeyExchangeRequestStore extends ObjectStorePromise<[string, string], StoredKeyExchangeRequest, StoredKeyExchangeRequestRaw> {

  protected getStoreOptions(): IDBObjectStoreParameters {
    return {
      keyPath: ['senderUsername', 'senderServer']
    }
  }


  protected setStoreIndices(objectStore: IDBObjectStore): void {}
  
  async migrateData(oldVersion: number) {}

  convertEntryToRaw(entry: StoredKeyExchangeRequest) : StoredKeyExchangeRequestRaw {
    return {
      senderServer: entry.senderServer,
      senderUsername: entry.senderUsername,
      id: entry.id,
      payload: entry.payload,
      derivedEncryptionKey: entry.derivedEncryptionKey.getCryptoKey()
    };
  }
  convertRawToEntry(entry: StoredKeyExchangeRequestRaw) : StoredKeyExchangeRequest {
    return {
      senderServer: entry.senderServer,
      senderUsername: entry.senderUsername,
      id: entry.id,
      payload: entry.payload,
      derivedEncryptionKey: new AesGcmKey(entry.derivedEncryptionKey)
    };
  }
}




//Call Data is ephemeral and should not be stored, so bdont define them here
//Invitations and ChatRequests also should not be stored in messages since
//they have their own dedicated object stores





export class MessageStore extends ObjectStorePromise<string, StoredMessageBase, StoredMessageBase> {

  protected getStoreOptions(): IDBObjectStoreParameters {
    return {
      //note that insertId is the order that the message is inserted into client database, not server database
      keyPath: 'insertId', //insert id is automatically appended
      autoIncrement: true
    }
  }

  protected setStoreIndices(objectStore: IDBObjectStore): void {
    objectStore.createIndex('groupId', 'groupId');
    objectStore.createIndex('senderId', 'senderId');
    objectStore.createIndex('uuid', 'uuid');

  }

  migrateData(oldVersion: number) {}

  convertEntryToRaw(entry: StoredMessageBase): StoredMessageBase {return entry;}
  convertRawToEntry(raw: StoredMessageBase): StoredMessageBase {return raw;}



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

export interface FileEntry {
  fileUUID: string,
  file: File | undefined, //file has not been retrieved yet if undefined
  accessToken: string,
  remoteServer: string | undefined,
}

export class FileStore extends ObjectStorePromise<string, FileEntry, FileEntry> {

  protected getStoreOptions(): IDBObjectStoreParameters {
    return {
      keyPath: 'fileUUID', 
    }
  }

  protected setStoreIndices(objectStore: IDBObjectStore): void {
    objectStore.createIndex('accessToken', 'accessToken');
  }

  async migrateData(oldVersion: number) {}

  convertEntryToRaw(entry: FileEntry) : FileEntry {return entry;}
  convertRawToEntry(entry: FileEntry) : FileEntry {return entry;}
}