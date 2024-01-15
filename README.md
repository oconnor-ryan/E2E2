# End-To-End-Encrypted(E2EE) Web Application

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
* Will be a Single Page Application since there is no need for complex SEO
and the UI will remain mostly the same thoughout the app.
* Attempt to request use of Persistant Storage (Local Storage, IndexedDB) to
store encryption keys. Otherwise, prompt for a password to generate the key
from a key derivation function.

### Tools
- Front-end Framework
  * React would be good because of personal experience with NextJS
  * Could write my own Javascript, but that may be more tedious.
- Encryption
  * Web Crypto API (native to all targeted browsers)
- Bundler / Minifier
  * Webpack 


### UI and UX
* The page should not have to reload to view new messages.
* Single Page App

### Encryption
**FOCUS MORE ON THIS**



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
    - The message size is limited to the modulus used for public key encryption. (Example: For RSA with a modulus of 4096, the maximum message size is 512 bytes, which in UTF-8, is 128 characters per message)
    
2. 
3. Use Already-Existing persistant messaging protocol, like Signal Protocol.


## Server Side
The server serves 3 primary purposes:
1. Allow clients to create accounts 
2. Distribute messages between multiple clients
3. Store the encrypted messages and files of its clients
  - Clients will not store messages because we want one user to access their messages through multiple devices.

### Tools
- Back-end Framework
  * NodeJS Runtime
  * ExpressJS to simplify setting up Web API routes
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

## Optional Features
* Audio and Video Calls (similar to Discord)
*

## Examples Of Similar Projects
* Signal (simple messaging app with e2ee, has no web client)
* Element (more complex messaging app, allowing the client to connect to multiple servers and spaces using Matrix protocol. Users can self-host the page using Synapse or another server implementation of the Matrix protocol)
* WhatsApp (similar to Signal, but has web client)
* Discord (users can talk in private chats or on public "servers", user's cannot self-host Discord and messages are not encrypted)
* Microsoft Teams (similar to Element, but no self-hosting and has options
to download extensions)
