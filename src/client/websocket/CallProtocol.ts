import { getDatabase } from "../util/storage/StorageHandler.js";
import { negotiateP2PConnection } from "../webrtc/P2P-Connect.js";
import { SignalingServerMessageHandler } from "../webrtc/SignalingServerMessageHandler.js";


export async function callSocketBuilder(localVideo: HTMLVideoElement, remoteVideo: HTMLVideoElement, userListCallback: (userList: {callerId: string}[]) => void) {
  const storageHandler = await getDatabase();

  let username = storageHandler.getUsername();
  let password = storageHandler.getPassword();
  if(!username || !password) {
    throw new Error("Not logged in!");
  }



  let socketHandler = new CallSocketHandler(username, password, localVideo, remoteVideo, userListCallback);

  return socketHandler;

}

interface CallMessage {
  type: 'sdp' | 'icecandidate' | 'callsuccess' | 'callend',
  ownerId: string,
  otherId: string,
  bePolite: boolean, //this property is set by the server, NOT CLIENT
  [otherKeys: string] : any
}

interface ServerMessage {
  type: 'userlist',
  [otherKeys: string] : any
}

class CallSocketHandler extends SignalingServerMessageHandler{
  private ws: WebSocket;
  private otherId: string;
  private myId: string;
  private localVideo: HTMLVideoElement;
  private remoteVideo: HTMLVideoElement;

  private userListCallback: (userList: {callerId: string}[]) => void;
  private changePoliteness?: (polite: boolean) => void;

  constructor(username: string, password: string, localVideo: HTMLVideoElement, remoteVideo: HTMLVideoElement, userListCallback: (userList: {callerId: string}[]) => void) {
    super();

    this.localVideo = localVideo;
    this.remoteVideo = remoteVideo;

    this.userListCallback = userListCallback;

    this.myId = username;
    this.otherId = "";

    let protocol = window.isSecureContext ? "wss://" : "ws://";

    let authToken = encodeURIComponent(password);

    this.ws = new WebSocket(`${protocol}${window.location.host}?enc_type=call&userId=${username}&authtoken=${authToken}`);

    this.ws.onopen = this.onOpen.bind(this);
    this.ws.onerror = this.onError.bind(this);
    this.ws.onclose = this.onClose.bind(this);
    this.ws.onmessage = this.onMessage.bind(this);

  }

  async startCall(otherId: string, isPolite?: boolean) : Promise<MediaStream | null> {
    this.otherId = otherId;
    try {
      //ask to use webcam and mic (only call this once. If using multiple P2P,
      //use the same MediaStream reference to set the tracks of each connection)
      let userCamAndMic = await window.navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });

      //double negation casts to boolean (undefined becomes false)
      this.changePoliteness = negotiateP2PConnection(this, this.remoteVideo, userCamAndMic);
      this.changePoliteness(!!isPolite);
      return userCamAndMic;
    } catch(e) {
      console.error(e);
      return null;
    }
  }

  sendSessionDescription(sdp: RTCSessionDescription): void {
    this.ws.send(JSON.stringify({type: 'sdp', ownerId: this.myId, otherId: this.otherId, sdp: sdp}));
  }

  sendNewIceCandidate(candidate: RTCIceCandidateInit): void {
    this.ws.send(JSON.stringify({type: 'icecandidate', ownerId: this.myId, otherId: this.otherId, candidate: candidate}));
  }

  //when a WebSocket connection is successfully established
  protected onOpen(e: Event) {
    console.log("Connected To WebSocket Successfully!");
  }

  //when a WebSocket connection closes due to an error
  protected onError(e: Event) {
    console.error("WebSocket Error: ", e);
  }

  //when a WebSocket connection is closed by client or server
  protected onClose(e: CloseEvent) {
    console.log(e.reason);
    console.log(e.code);
    console.log("WebSocket connection closed!");
  } 

  //when a message is received during WebSocket connection
  protected async onMessage(e: MessageEvent<any>) {
    console.log(e.data);
    let data = JSON.parse(e.data) as (CallMessage | ServerMessage);

    console.log(data.type);

    switch(data.type) {
      case "sdp":
        //change politeness if p2p connection is already occurring
        //or create a new p2p connection with a certain polite or impolite role
        if(data.bePolite !== undefined) {
          if(!this.changePoliteness) {
            let stream = await this.startCall(data.ownerId, data.bePolite);
            this.localVideo.srcObject = stream;
          } else {
            this.changePoliteness(data.bePolite);
          }
        }
        this.onReceiveSessionDescription(data.sdp);
        break;
      case "icecandidate":
        this.onReceiveNewIceCandidate(data.candidate);
        break;

      case 'userlist':
        this.userListCallback(data.users);
        break;
    }

  }
}