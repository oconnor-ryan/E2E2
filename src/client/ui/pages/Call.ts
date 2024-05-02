import { getDatabase } from "../../storage/StorageHandler.js";
import { negotiateP2PConnection } from "../../webrtc/P2P-Connect.js";
import { SignalingServerMessageHandler } from "../../webrtc/SignalingServerMessageHandler.js";
import { ClientPage } from "../router/ClientPage.js";
import { ROUTER } from "../router/router.js";
import { getWebSocketHandler } from "../../websocket/SocketHandler.js";
import { displayNotification, getDefaultMessageReceivedHandlerUI } from "../components/Notification.js";
import { MessageSenderBuilder, SocketMessageSender } from "../../message-handler/MessageSender.js";
import { EncryptedCallSignalingMessageData, StoredMessageCallBase } from "../../message-handler/MessageType.js";

export class CallPage extends ClientPage {
  private changePoliteness?: (polite: boolean) => void;

  load(rootElement: HTMLElement): void {
    rootElement.innerHTML = `
    <h1>Call Room</h1>
    <p id="home-link">Back to Home</p>

    <div id="user-list-wrapper">
      <h2>Online Users!</h2>
      <div id="user-list"></div>
    </div>

    <video id="localCam" width="400" height="300" autoplay playsinline muted="true"></video>
    <video id="remoteCam" width="400" height="300" autoplay playsinline></video>
    `;

    const homeLink = document.getElementById('home-link') as HTMLElement;
    homeLink.onclick = (e) => {
      ROUTER.goTo('/home');
    };

    

    this.loadAsync().catch(e => console.error(e));

  }

  private async loadAsync() {
    const remoteVideo = document.getElementById('remoteCam') as HTMLVideoElement; 
    const userList = document.getElementById('user-list') as HTMLDivElement;

    const db = await getDatabase();


    const signaler = new Signaler();

    let messageReceiver = getDefaultMessageReceivedHandlerUI();
    let oldOnMessage = messageReceiver.onmessage;
    

    const socketData = getWebSocketHandler(db, messageReceiver);

    messageReceiver.onmessage = (message, messageSaved, error) => {
      if(error) {
        return oldOnMessage(message, messageSaved, error);
      }

      //this is not a valid call 
      if((message as StoredMessageCallBase).bePolite === undefined) {
        return;
      }

      let callMessage = message as StoredMessageCallBase;

      switch(callMessage.payload.type) {
        case 'call-request':
          break;
        case 'call-accept': 
          break;
        case 'call-signaling':
          let signalData = message.payload as EncryptedCallSignalingMessageData;
          if(signalData.data.sdp) {
            this.startCall(message.senderIdentityKeyPublic, signaler, socketData.messageSenderBuilder, callMessage.bePolite)

            signaler.onReceiveSessionDescription(signalData.data.sdp);
          } else if(signalData.data.ice) {
            signaler.onReceiveNewIceCandidate(signalData.data.ice);
          }
          break;
        default:
          break;
      }
    }

    messageReceiver.oncallinforesponse = (info) => {
      //render callable users
      userList.innerHTML = "";

      info.users.forEach(u => {
        let element = document.createElement('li') as HTMLLIElement;
        let button = document.createElement('button') as HTMLButtonElement;
        element.textContent = u.username;

        button.textContent = 'Call';
        button.onclick = async (ev) => {
          try {
            this.startCall(u.identityKeyPublicString, signaler, socketData.messageSenderBuilder, u.bePolite);
          } catch(e) {
            console.error(e);
          }
        };

        element.appendChild(button);
        userList.appendChild(element);

      });

    };

    

    messageReceiver.onsocketopen = () => {
      socketData.sendCallInfoRequest(db).catch(e => console.error(e));
    }
  }

  private async startCall(otherUserIdKey: string, signaler: Signaler, messageSenderBuilder: MessageSenderBuilder, isPolite: boolean) {
    const remoteVideo = document.getElementById('remoteCam') as HTMLVideoElement; 
    const localVideo = document.getElementById('localCam') as HTMLVideoElement;

    const messageSender = await messageSenderBuilder.buildMessageSender(otherUserIdKey, 'individual-key');
    signaler.setSender(messageSender);

    try {
      //ask to use webcam and mic (only call this once. If using multiple P2P,
      //use the same MediaStream reference to set the tracks of each connection)
      let userCamAndMic = await window.navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });

      //if we are already trying to call the other user, change our politeness 
      if(this.changePoliteness) {
        this.changePoliteness(!!isPolite);
      }
      //start our call 
      else {
        this.changePoliteness = negotiateP2PConnection(signaler, remoteVideo, userCamAndMic);
      }

      localVideo.srcObject = userCamAndMic;
    } catch(e) {
      console.error(e);
      
    }
  }
}

class Signaler extends SignalingServerMessageHandler {
  private messageSender: SocketMessageSender | undefined = undefined;

  setSender(messageSender: SocketMessageSender) {
    this.messageSender = messageSender;
  }

  sendSessionDescription(sdp: RTCSessionDescription): void {
    if(!this.messageSender) {
      throw new Error('No message sender defined');
    }
    this.messageSender.callSignalingMessage(sdp, 'sdp').catch(e => {console.error(e)});
  }
  sendNewIceCandidate(candidate: RTCIceCandidateInit): void {
    if(!this.messageSender) {
      throw new Error('No message sender defined');
    }
    this.messageSender.callSignalingMessage(candidate, 'ice').catch(e => {console.error(e)});
  }

}