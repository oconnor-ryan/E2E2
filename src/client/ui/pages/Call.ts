import { getDatabase } from "src/client/storage/StorageHandler.js";
import { negotiateP2PConnection } from "../../webrtc/P2P-Connect.js";
import { SignalingServerMessageHandler } from "../../webrtc/SignalingServerMessageHandler.js";
import { ClientPage } from "../router/ClientPage.js";
import { ROUTER } from "../router/router.js";
import { getWebSocketHandler } from "src/client/websocket/SocketHandler.js";
import { displayNotification, getDefaultMessageReceivedHandlerUI } from "../components/Notification.js";
import { MessageSenderBuilder, SocketMessageSender } from "src/client/message-handler/MessageSender.js";
import { EncryptedCallSignalingMessageData } from "src/client/message-handler/MessageType.js";

export class CallPage extends ClientPage {
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

    const userList = document.getElementById('user-list') as HTMLDivElement;
    const localVideo = document.getElementById('localCam') as HTMLVideoElement;
    const remoteVideo = document.getElementById('remoteCam') as HTMLVideoElement; 


  }

  private async loadAsync(userListElement: HTMLElement) {
    const db = await getDatabase();

    //make an API call to get current list of online friends
    //along with whether or not they tell you to be polite for P2P Negotation
    userListElement.innerHTML = "";


    const signaler = new Signaler();

    let messageReceiver = getDefaultMessageReceivedHandlerUI();
    let oldOnMessage = messageReceiver.onmessage;
    messageReceiver.onmessage = (message, messageSaved, error) => {
      if(error) {
        return oldOnMessage(message, messageSaved, error);
      }

      switch(message.payload?.type) {
        case 'call-request':
          break;
        case 'call-accept': 
          break;
        case 'call-signaling':
          let signalData = message.payload as EncryptedCallSignalingMessageData;
          if(signalData.data.sdp) {
            signaler.onReceiveSessionDescription(signalData.data.sdp);
          } else if(signalData.data.ice) {
            signaler.onReceiveNewIceCandidate(signalData.data.ice);
          }
          break;
        default:
          break;
      }
    }
    const socketData = getWebSocketHandler(db, messageReceiver);
    
  }

  private async startCall(otherUserIdKey: string, signaler: Signaler, messageSenderBuilder: MessageSenderBuilder, remoteVideo: HTMLVideoElement, isPolite: boolean) {
    const messageSender = await messageSenderBuilder.buildMessageSender(otherUserIdKey, 'individual-key');
    signaler.setSender(messageSender);

    try {
      //ask to use webcam and mic (only call this once. If using multiple P2P,
      //use the same MediaStream reference to set the tracks of each connection)
      let userCamAndMic = await window.navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });

      //double negation casts to boolean (undefined becomes false)
      const changePoliteness = negotiateP2PConnection(signaler, remoteVideo, userCamAndMic);
      changePoliteness(!!isPolite);

      return userCamAndMic;
    } catch(e) {
      console.error(e);
      return null;
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