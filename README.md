# E2E2 (End-To-End Encrypted) Website

A instant-messaging web application where users can send encrypted messages to each other that cannot be read by the web server.

> Disclaimer: Do not use this project in any production service. 
> This project's only purpose is to serve as a educational tool on using
> the WebCrypto API and applying cryptographic primitives in a web application.
> There is no guarantee that this software can protect a user's encrypted
> messages.

## Current Objectives
1. Implement user signatures for messages and key exchanges. Save public keys of users you chat with in order to verify that each message sent was sent by them (this way, you no longer need to attach a senderId to each message, it can be signed with a user's signing key). When first connecting to user, save their keys so that if it changes, you have the option to use their new signing key uploaded to the server.
2. Delete messages and key exchanges once all users in a chat room receive all previous messages

## Current Bugs
1. When a key exchange is performed, the person who sent the previous key exchange will lose any messages encrypted with their key because their key exchange is not stored on the database.

## Objectives to Consider
1. Try encrypting the members of a chat such that the server does not know who the users in a chat room are (similar to Signal's private group feature)
2. Similar to the first consideration, a server can figure out who is part of a chat based on the initial HTTP upgrade request used to join a chat room via WebSocket. A alternative to this is to provide a unique access token to each user that is not linked to their account. Note that current invite method will not work since when an invite is accepted, the request is verified by the user's ID and signature. 

3. Currently, you can only send POST requests to server because each request body is signed by the user's identity key. Maybe consider using JWT token for authentication and authorization for requests that do not have a body (note that setting cookie does not work because we want to use client's private signing key to sign data, but you cannot set cookies on a client's HTTP request. Try keeping auth data and signatures in custom HTTP headers or in query in GET request).

4. Federated Communication (Server-To-Server). Users chatting on one server instance can form chats with users from a different server as long as their userId and server domain name are known.

5. WebRTC for peer-to-peer connections for syncronous chats and voice/video calls

## Future Objectives
1. Add method to backup account in case they accidentally clear their browser.
  - Do this by generating another ECDSA keypair as backup.
  - Put backup public key on server
  - Generate a password via crypto.getRandomValues() with over 80 bits of entropy (Note that Entropy = log2 ((number of unique symbols) ^ (length of password)))
  - Encrypt the backup private key via AES key derived from PBKDF2, with the password and a randomly-generated salt used as input. 
  - Concatenate the password and salt and display this to the user, telling them to store it in a trusted password manager or file.
  - Once the user accepts this password, the encrypted backup key is written into a file and put into the downloads folder.
  - When the user begins to recover an account, they must drop the encrypted file and the password-salt combination into the Recover Account form to retrieve their backup private key, authenticate with server, and login.
  - A new backup keypair is generated using the above steps after logging in.

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


## Project Structure
- **src/** contains all Typescript files.
  - **src/client/** contains all browser-side code kept in the website's /js route.
    - **src/client/shared/** is a special folder that contains code that can be used both server-side and client-side.
  - **src/server/** contains all server-side code.

- **client-assets/** contains all static website assets (HTML, CSS, Images)
  - **client-assets/static-root/** contains non-HTML assets and are served via the /static route of the website. Note that all assets inserted here are public.
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
* ALL messages are end-to-end encrypted, meaning the server should not be capable of decrypting messages.
* Users can form group chats
* Users can invite each other to certain group chats
* Group chats can be organized by topics or channels (simlar to Discord Servers/Channels or Element's Matrix Spaces/Rooms)
* If users are removed from a chat, all encryption keys are regenerated if needed
* Chats can be asyncronous (a user can send a message to an offline user and the offline user will receive the message once they connect to server).

- Accounts and Login
  - All users must register their device when first creating an account.
  - All cryptography keys used to log in must be persisted on browser.
  - Only one primary device per account.
    - Signal and Whatsapp use phone number, so the phone is the main device, though you can link other computers to your account via your phone.
    - (Optional) Consider adding option to link up to 2 other devices. Your main device must be used to link both.
  - Users can transfer accounts from one device to another if needed
  - If device is lost:
    - Have user request that they want to backup their device. The client generates a second keypair and sends the public key to the server. The private key is then stored as a file on the client, and the user is responsible for putting it in a safe spot (maybe allow encrypted via PBKDF2). When the user registers from another device, they have the option to recover their account using this file. If this succeeds, then the user gets access to their account, a new keypair is generated for that device for messaging, and the user loses their old messages. 
  - If another person steals your credentials and puts it in their browser:
    - The original owner should delete their account, preventing the malicous user from receiving or sending any more messages.

## Client Side
* Uses Persistant Storage (IndexedDB) to store encryption keys and received messages.
* Crypto Keys cannot be deleted, but messages can.

### Tools
- Front-end Framework
  * None. Using standard HTML/CSS/Javascript
- Encryption Library
  * Web Crypto API (native to all targeted browsers)
- Supported Browsers: 
  - Safari (desktop and mobile)
  - Chrome (desktop and mobile)
  - Firefox (desktop and mobile)
  - Edge (desktop and mobile)
  - Any other browser that supports Persistant Storage, WebCrypto API, and WebSockets.


### Encryption
**\*FOCUS MORE ON THIS\***

Methods for Encrypting Messages:
1. Shared Key
  - One of the clients in a group chat creates an AES key, encrypts it with each chat member's public key, and sends the encrypted key to each client.
  - This single key is used by each client to encrypt messages they send and decrypt messages they receive.
  - Will need a way to allow clients to talk even if shared key generated by one client is rejected by other clients.
2. Use 3-Party Diffe-Hellman Key Exchange.


## Server Side
The server serves 3 primary purposes:
1. Allow clients to create accounts and login
2. Distribute encrypted messages between multiple clients
3. Store the encrypted messages and files of its clients until every device owned by those clients receives the message.

### Tools
- Back-end Framework
  * NodeJS Runtime
  * ExpressJS to simplify setting up API routes (MIT)
  * WS NPM package to simplify handling WebSocket server. (MIT)
  * postgres NPM package for communicating with database (Unlicense)
  * jsonwebtoken NPM package for handling user session after login via JWT (MIT)
- Database
  * PostgreSQL 

### Login
- When creating an account, a keypair is generated and the server keeps the public key.
- When logging in, the server generates a long, random string, encrypts it via the user's public key, and sends it to the client. If the client can decrypt the message and send it in plaintext to the server, then the user is logged in.
- When receiving session cookie, ensure that cookie property HttpOnly is set to true to prevent Javascript on browser from accessing it.

## Examples Of Similar Projects
* Signal (simple messaging app with e2ee, has no web client)
  - End-to-End-Encrypted messages
  - Must use phone number and phone to create account.
  - Can link up to 5 computers (NOT PHONES) to same account, but unlinks after 30 days.
  - Linked devices do not sync conversation history since each device generates its own keypair.
  - Uses Signal Protocol
  - Centralized
  - No web client
* Element 
  - more complex messaging app 
  - allows the client to connect to multiple servers and spaces using Matrix protocol.
  - Users can self-host the page using Synapse or another server implementation of the Matrix protocol
  - End-to-end encryption is optional
  - Decentralized, meaning messages can be sent across multiple servers, even self-hosted ones.

* WhatsApp 
  - Very similar to Signal
    - Must use phone to register
    - Uses Signal Protocol
    - Asyncronous Messaging
  - Can link up to 4 devices (including phones) using primary phone temporarily
  - Message History does sync message history, but requires your phone to have the Whatsapp app open and is slow on web client. Primary phone has the greatest priority
  - Has Web Client
* Wire
 - Uses Proteus protocol, an implementation of Signal protocol
 - Allows up to 8 devices to be linked, but does not sync conversation history between devices since each device generates its own keypair
 - 1 temporary device can be used to login on a public computer to view and send new messages. This device deletes all messages locally on logout and has limited permissions.
 
* Discord 
  - users can talk in private chats or on public "servers"
  - Centralized Server
  - messages are not encrypted and are persistant
  - Asyncronous chats


## Other End-to-End-Encrypted Instant Messaging Protocols
* Signal
* OMEMO (extension of XMPP Protocol)
* OLM and MEGOLM (extension of Matrix Protocol)
* OpenPGP (not necessary a instant messaging protocol, but may be useful)


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

- Authentication Factors
  - a category of evidence that proves whether if the user is indeed who they claim to be.
  - There are 3 types of factors
    1. Knowledge Factor
      - The user knows information that only the user they claim to be knows.
      - Examples
        - Password
        - Security Questions
    2. Possession Factor
      - The user possesses something that only the user they claim to be has.
      - Examples
        - SMS verification via magic link or one time passcode (possesses phone)
        - Email verification via magic link (possesses email account)
        - Authenticator app using one time passcodes (possesses phone)
        - Has FIDO2 Security Key (possesses key)
    3. Inherence Factor
      - The user has physical features that only the user they claim to be has
      - Examples
        - Fingerprints
        - Face recognition
        - voice recognition