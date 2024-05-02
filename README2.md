# E2E2 (**E**nd-**To**-**E**nd **E**ncrypted) Private Messanger

A instant-messaging web application where users can send encrypted messages to each other that cannot be read by the web server.

> Disclaimer: Do not use this project in any production service. 
> This project's only purpose is to serve as a educational tool on using
> the WebCrypto API and applying cryptographic primitives in a web application.
> There is no guarantee that this software can protect a user's encrypted
> messages.

## Features
- Users can create chat rooms and invite other users to join their chat rooms.
- Chat members can send and receive end-to-end-encrypted messages and files to each other.
- Offline chat members will be able to retrieve messages sent to them while they were gone.
- Users can engage in 1-to-1 VoIP video calls using a peer-to-peer connection using WebRTC.

## Encryption

The following steps are performed in order to send an encrypted message.
1. When first joining a chat room, the new chat member must generate a AES-GCM encryption key that all chat members will use for encrypting messages.
2. They then perform an X3DH key exchange with each chat member and derive a shared secret from this exchange.
3. This shared secret is used to generate another AES-GCM key.
4. The shared secret key is used to encrypt the chat room's encryption key and is sent to each chat member.
5. At this point, the chat member who sent the key exchanges can now send messages.
6. When the other chat members go on the chat room, they retrieve the list of new key exchanges that have been performed, deriving the same shared secret that the new chat member derived and use that shared secret to decrypt the chat room's new encryption key. 
7. Now that they have the new chat encryption key, they can read the new chat members messages and send out their own messages to the rest of the chat room.

### X3DH Key Exchange
The link to the documentation for this algorithm is:
https://signal.org/docs/specifications/x3dh/

In order to allow asyncronous messages to be sent, I decided to implement the Extended Triple Diffie-Hellman (X3DH) key exchange algorithm from the Signal Protocol. This algorithm was developed by a software development group known as Open Whisper Systems, who later developed the Signal Messanger application. 

I have to make a few modifications to the original X3DH exchange:
1. The Web Cryptography API has no support for the X25519 or X448 elliptic curves for cryptography keys that the original X3DH protocol recommends us to use. Thus, I replaced all signing keys with the Elliptic Curve Digital Signature Algorithm (ECDSA) using a P-512 elliptic curve and all Diffie-Hellman keys with the Elliptic Curve Diffie-Hellman (ECDH) algorithm using a P-512 elliptic curve.

2. In the Web Cryptography API, cryptography keys each have a specific type and cannot perform actions that their key type was not intended to do. For example, you cannot perform an Elliptic Curve Diffie-Hellman (ECDH) function on cryptography keys that are not explicitly marked with the type "ECDH". In the original protocol, each user's identity key pair was used both as a signing key and as the input of the ECDH function. Because the Web Cryptography API prevents this action, I created 2 identity key pairs, one is a ECDSA key pair used for signatures and one is a ECDH key used for the Diffie-Hellman exchanges used in the X3DH key exchange.

3. The original X3DH key exchange recommends the use a set of one-time prekeys that are used to improve forward secrecy. Since a one-time prekey can only be used once, each X3DH key exchange performed will change the one-time prekey, making it more difficult for an attacker to derive the shared secret outputted by the key exchange. I decided to exclude these one-time prekeys due to the extra complexity of managing each user's one-time keys. Also, the original X3DH protocol states that if no one-time prekeys are provided, it will still perform the key exchange without these keys anyways.



