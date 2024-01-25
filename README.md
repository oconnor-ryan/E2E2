# E2E2 (End-To-End Encrypted) Website

A instant-messaging web application where users can send encrypted messages
to each other that cannot be read by the web server.

> Disclaimer: Do not use this project in any production service. 
> This project's only purpose is to serve as a educational tool on using
> the WebCrypto API and applying cryptographic primitives in a web application.
> There is no guarantee that this software can protect a user's encrypted
> messages.

## Current Objectives
1. Create "Rooms" for chat messaging that allow only one group of users
to talk to each other. 
  - Each room should user their own shared key. 
  - No users outside this room can enter and cannot decrypt any messages inside
outside this room can retrieve the key used to decrypt the messages in the
group.

2. Figure out how users setup shared key in case of bad clients
  - Right now, a client can claim to have generated a shared key without proof, which currently prevents all group members from communicating on that chat until everyone in the chat leaves. 
  - This acts as a small scale denial-of-service attack and forces other users to create a new chat.
  - In addition, a client can claim to have accepted a shared key even if it was invalid. It prevents us from assuming that if every recipient of the shared key accepts it, that the key must be correct. If we do assume this and 2 users do this before everyone else joins a group chat, everyone else will be unable to speak in the chat.

  - This can be fixed by:
    - When a user first connects to the WebSocket Server, a unmodified client should send its encrypted shared key to all other clients connected.
    - If all of the recipients of the shared key are unable to import the shared key, wait until another client sends their generated shared key.
    - This repeats until at least 1 client accepts a shared key. However, the sender of that key is told that only 1 client can read their messages.
    - However, if another client generates a shared key and more clients accept the new shared key, then all users who join will receive this key and the users with the old shared key are asked to import the new shared key to join the conversation with everyone else.
    - If a client does not accept the most popular shared key, then the next most popular shared key is used.

  - This fixes the problem by allowing all members with unmodified clients to communicate with each other and prevents those with compromised or malicious clients from locking out communication between these unmodified clients.

3. Message Persistance
  - Store users and messages securely in a database.
  - Problems To Solve
    - How To Login?
    - If a user's password is stolen, all messages inside the list of chats
    this user is in will be exposed. How do you protect other clients?
    - Should I create a different encryption key for each user, each chat,
    or each message?



## Project Structure
- **src/** contains all Typescript files.
  - **src/client/** contains all browser-side code kept in the website's /js route.
    - **src/client/shared/** is a special folder that contains code that can be used both server-side and client-side.
  - **src/server/** contains all server-side code.

- **client-assets/** contains all static website assets (HTML, CSS, Images)
  - **client-assets/public/** contains non-HTML assets and serves as the website's root folder.
  - **client-assets/html/** contains all HTML files used in website.

- **dist/** stores the transpiled Javascript from the Typescript inside the src/ folder.

## To Run Project
In order to build and run the project:
1. Install NodeJS and NPM (this was tested on Node 20 LTS and NPM 10.3)
2. Run `npm install` at root of project.
3. Run `npm run build` to build project.
4. Run `npm run start` to start web server on port 3000.

## Project Requirements
* This messaging service should allow users to communicate to each other via:
  - Text
  - Images
  - Files
* Users can form group chats
* Users can invite each other to certain group chats
* Group chats can be organized by topics or channels (simlar to Discord Servers/Channels or Element's Matrix Spaces/Rooms)
* Users can self-host the server for their own private use.


## Client Side
* This should be a separate project so that users who don't trust
the server they're connected to can clone the project via Git and build
the project themselves.
* Attempt to request use of Persistant Storage (Local Storage, IndexedDB) to store encryption keys. Otherwise, prompt for a password to generate the key from a key derivation function.

### Tools
- Front-end Framework
  * None. Using standard HTML/CSS/Javascript
- Encryption
  * Web Crypto API (native to all targeted browsers)


### Encryption
**\*FOCUS MORE ON THIS\***

Methods for Encrypting Messages:
1. Use Only Public Key Encryption:
  - Each user has a public-private keypair
  - When sending a message:
      1. Take the message and encrypt it with the respective public key for each user in the group.
      2. Send those encrypted messages from the client to the server, who will distribute the correct encrypted messages to each user.
      3. When a user receives a message, they use their private key to decrypt the message.
  - Generating Keys
    - When creating an account, a key pair will be generated client-side
    - The private key will be encrypted using an AES key derived from the PBKDF2 function, which takes in the user's password and outputs the AES key.
  - Storing keys
    - The private key is stored client-side unencrypted. 
    - The private key is also stored server-side, encrypted by AES key from key derivation function.
    - The public key is stored server-side.
  - Advantages
    - Easier to implement
    - Public key encryption is very difficult to break.
  - Disadvantages
    - Computationally expensive on client, especially for larger groups
    - If someone's private key is stolen, all messages sent to and from the user can be decrypted
      - This could be fixed by creating a new key-pair per user for every group, limiting the amount of decrypted messages to the ones sent to and from the user in the current group.
    - Each encrypted version of the same message must be stored on server for each user.
    - The message size is limited to the modulus used for public key encryption. (Example: For RSA with a modulus of 4096, the maximum message size is 512 bytes)
    
2. Shared Key
  - Each user has a public-private key to encrypt their keys and metadata.
  - A shared secret is kept per group chat and distributed to the group's members.
  - Shared keys must be encrypted before being stored on the server to prevent the server from viewing a group's plaintext messages.
  - Each chat member will have a copy of the shared key of the group they're in. This shared key will be encrypted by the user's public key.
  - Each user's private key is encrypted by an AES key generated from a key-derivation function that takes the user's password, similar to GNU Privacy Guard program.


## Server Side
The server serves 3 primary purposes:
1. Allow clients to create accounts 
2. Distribute messages between multiple clients
3. Store the encrypted messages and files of its clients
  - Clients will not store messages because we want one user to access their messages through multiple devices.
  - All client keys and shared keys must be ENCRYPTED before being stored on the server. A client can unlock those keys using a key generated from a key derivation function.

### Tools
- Back-end Framework
  * NodeJS Runtime
  * ExpressJS to simplify setting up Web API routes
  * WS NPM package to simplify handling WebSocket server.
  * mysql2 or postgres NPM package for communicating with database
  * express-session NPM package for session handling
- Database
  * MariaDB or PostgreSQL

### Login
Methods For Login:
1. Use hashing (SHA-256 or SHA-512) and salting
  - When creating account password, hash and salt the password, then
  send this to the server.
  - When a user logs in, if the hash generated from the given password and salt are the same, then the password is correct.

  - Advantages
    - Easy to implement
    - Salting reduces the effectiveness of rainbow tables.
  - Disadvantages
    - If a attacker is able to download the database from a server, they can retrieve the password from a hash and salt if they have the hardware to do so.

2. Store the result of a key derivation function(PBKDF2,scrypt,argon2,etc)
  - When creating account password, derive a key from a given password and store it on the server.
  - When logging in, the given password is run through the KDF and compared to the stored key.
  - Advantages
    - More expensive to calculate for attackers
  - Disadvantages
    - The only key-derivation function for user passwords in WebCrypto API is PBKDF2, which is more prone to being brute-forced by high-end GPUs compared to other KDFs that allow low-entropy inputs (argon2, scrypt, bcrypt). To combat this, OWASP recommends 600000 iterations for password storage.
  - Note
    - If using Approach 1 in Encryption section:
      - Make sure the password key stored on the database is NOT THE SAME as the one used to decrypt the private key. Use a different salt for the AES key derived from the password so that the password key cannot be used to decrypt the user's private key.



## Examples Of Similar Projects
* Signal (simple messaging app with e2ee, has no web client)
* Element (more complex messaging app, allowing the client to connect to multiple servers and spaces using Matrix protocol. Users can self-host the page using Synapse or another server implementation of the Matrix protocol)
* WhatsApp (similar to Signal, but has web client)
* Discord (users can talk in private chats or on public "servers", user's cannot self-host Discord and messages are not encrypted)
* Microsoft Teams (similar to Element, but no self-hosting and has options
to download extensions)

## Weird Stuff To Look Out For
* Don't assume UTF-8 characters have a maximum byte size of 4. This character(🤦🏼‍♂️) is 17 bytes because it contains multiple "unicode scalars". For this emoji (🤦🏼‍♂️), there are 5 scalars used: 4 bytes for face palm emoji, 4 bytes for the emoji modifier for the color of the emoji, 3 bytes for a zero-width joiner character, 3 bytes to specify that it is male, and 3 bytes for the variation selector, totalling 17 bytes. Some text editors display 🤦🏼‍♂️ as 🤦🏼\u200d♂️ or 🤦🏼♂️ due to this. If setting a message size limit, be aware of this.

## Glossery (And Other Useful Words)
- Forward Secrecy (or Perfect Forward Secrecy)
  - a feature of key-agreement protocols that assures that the session keys generated during key-agreement cannot be compromised even if the long-term secrets used in the key-agreement are compromised.
  - This protects past messages from being decrypted if a attacker gets the long-term secrets.
  - Past Messages Safe, future messages compromised
  - TLS (aka modern HTTPS) achieves forward secrecy through Ephemreal Diffie-Hellman Algorithm

- Future Secrecy (Post-Compromise Secrecy (PCS) or Backward Secrecy)
  - Opposite of Forward Secrecy
  - Assures that even if long term secrets are compromised, the protocol can "self-heal" and continue to protect messages after the compromise. 
  - Future Messages Safe, past messages compromised
  - Double Ratchet Algorithm achieves this

- Authenticated Encryption
  - https://en.wikipedia.org/wiki/Authenticated_encryption

- Asyncronous Messaging
  - Users do not have to be connected to server to receive messages

- Server-Side Fanout
  - Server receives one encrypted message from a client, and then sends that message to all connected clients

- Client-Side Fanout
  - Client generates different ciphertext from a message for each connected client and sends each encrypted message to the server for each client.