//For signaling server, if we only want to call 1 member of chat,
//you can retrieve the Websocket used by the desired client by appending
//a user id to each Websocket on the server.

type SendDataCallbacks = {
  'call-request': (sdp: RTCSessionDescription) => void,
  'new-ice-candidate': (candidate: string) => void,
  'media-track-event': (streams: Readonly<MediaStream[]>) => void,
  'callee-accepted-call'?: (sdp: RTCSessionDescription) => void
}

class WebRTCVoIPHandler {
  private peerConnection: RTCPeerConnection;
  private _isClosed = false;


  private static MEDIA_CONSTRAINTS = {
    audio: true,
    video: {
      aspectRatio: {
        ideal: 1.333333
      }
    }
  }

  private sendDataCallbacks: SendDataCallbacks; 

  constructor(webcamStream: MediaStream, sendDataCallbacks: SendDataCallbacks) {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: "turn:" + "",
          username: "webrtc",
          credential: ""
        }
      ]
    });


    this.sendDataCallbacks = sendDataCallbacks;

    this.peerConnection.onicecandidate = this.onIceCandidate.bind(this);
    this.peerConnection.oniceconnectionstatechange = this.onIceConnectionStateChange.bind(this);
    this.peerConnection.onicegatheringstatechange = this.onIceGatheringStateChange.bind(this);
    this.peerConnection.onsignalingstatechange = this.onSignalingStateChange.bind(this);
    this.peerConnection.onnegotiationneeded = this.onNegotiationNeeded.bind(this);
    this.peerConnection.ontrack = this.onTrack.bind(this);
    
  }

  public isClosed(): boolean {return this._isClosed;}

  public async handleAnswerFromCallee(sdp: RTCSessionDescriptionInit) {
    let desc = new RTCSessionDescription(sdp);

    await this.peerConnection.setRemoteDescription(desc).catch(e => console.error(e));
  }


  private onIceCandidate(ev: RTCPeerConnectionIceEvent) {
    if(!ev.candidate) {
      return;
    }

    let outgoingCandidate = ev.candidate.candidate;

    this.sendDataCallbacks['new-ice-candidate'](outgoingCandidate);
  }

  private onIceConnectionStateChange(ev: Event) {
    switch(this.peerConnection.iceConnectionState) {
      case 'closed':
      case 'failed': 
      case 'disconnected':
        this.closeCallAndConnection();
        break;
    }
  }

  // Handle the |icegatheringstatechange| event. This lets us know what the
  // ICE engine is currently working on: "new" means no networking has happened
  // yet, "gathering" means the ICE engine is currently gathering candidates,
  // and "complete" means gathering is complete. Note that the engine can
  // alternate between "gathering" and "complete" repeatedly as needs and
  // circumstances change.
  private onIceGatheringStateChange(ev: Event) {
    
  }

  private onSignalingStateChange(ev: Event) {
    switch(this.peerConnection.signalingState) {
      case 'closed':
        this.closeCallAndConnection();
        break;
    }
  }

  // Called by the WebRTC layer to let us know when it's time to
  // begin, resume, or restart ICE negotiation.
  private async onNegotiationNeeded(ev: Event) {
    try{
      const offer = await this.peerConnection.createOffer();

      // If the connection hasn't yet achieved the "stable" state,
      // return to the caller. Another negotiationneeded event
      // will be fired when the state stabilizes.
      if(this.peerConnection.signalingState !== "stable") {
        return;
      }

      //establish offer as local peer's current description
      await this.peerConnection.setLocalDescription(offer);

      //send offer to remote peer via WebSocket

      let sdp = this.peerConnection.localDescription;

      if(!sdp) {
        return;
      }

      this.sendDataCallbacks["call-request"](sdp);

    } catch(error) {
      console.error(error);
    }
  }

  private onTrack(ev: RTCTrackEvent) {
    this.sendDataCallbacks['media-track-event'](ev.streams);
  }

  private closeCallAndConnection() {
    this._isClosed = true;

    //prevent any extra events from executing during hangup
    this.peerConnection.ontrack = null;
    this.peerConnection.onicecandidate = null;
    this.peerConnection.onsignalingstatechange = null;
    this.peerConnection.onicegatheringstatechange = null;
    this.peerConnection.onnegotiationneeded = null;


    //stop all transceivers in connection
    this.peerConnection.getTransceivers().forEach(transceiver => {
      transceiver.stop();
    });

    //close peer connection
    this.peerConnection.close();

    //remove reference of peerConnection
    //@ts-ignore
    this.peerConnection = null;


  }

  public static async invite() {
    let webcamStream = await window.navigator.mediaDevices.getUserMedia(WebRTCVoIPHandler.MEDIA_CONSTRAINTS);
    let rtn = new WebRTCVoIPHandler(webcamStream, {'call-request': (sdp) => {}, 'new-ice-candidate': (can) => {}, "media-track-event": (streams) => {}, 'callee-accepted-call': () => {} })

    let transceiver = (track: string | MediaStreamTrack) => rtn.peerConnection.addTransceiver(track, {streams: [webcamStream]});

    webcamStream.getTracks().forEach(track => transceiver(track));

    //rest of invite is handled be negotiationneeded event, 
    //so no need to worry about it here

    return rtn;
  }

  public static async accept(sdp: RTCSessionDescriptionInit) {
    let webcamStream = await window.navigator.mediaDevices.getUserMedia(WebRTCVoIPHandler.MEDIA_CONSTRAINTS);
    let rtn = new WebRTCVoIPHandler(webcamStream, {'call-request': (sdp) => {}, 'new-ice-candidate': (can) => {}, "media-track-event": (streams) => {}})

    let desc = new RTCSessionDescription(sdp);

    // If the connection isn't stable yet, wait for it...
    if (rtn.peerConnection.signalingState != "stable") {

      // Set the local and remove descriptions for rollback; don't proceed
      // until both return.
      await Promise.all([
        rtn.peerConnection.setLocalDescription({type: "rollback"}),
        rtn.peerConnection.setRemoteDescription(desc)
      ]);


      return null;
    } else {
      await rtn.peerConnection.setRemoteDescription(desc);
    }

    let transceiver = (track: string | MediaStreamTrack) => rtn.peerConnection.addTransceiver(track, {streams: [webcamStream]});

    webcamStream.getTracks().forEach(track => transceiver(track));

    await rtn.peerConnection.setLocalDescription(await rtn.peerConnection.createAnswer());

    //send confirmation that you joined call to caller here
    if(rtn.sendDataCallbacks['callee-accepted-call']) {
      rtn.sendDataCallbacks['callee-accepted-call'](rtn.peerConnection.localDescription!);
    }

    return rtn;
  }
}