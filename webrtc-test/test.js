//For signaling server, if we only want to call 1 member of chat,
//you can retrieve the Websocket used by the desired client by appending
//a user id to each Websocket on the server.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var WebRTCVoIPHandler = /** @class */ (function () {
    function WebRTCVoIPHandler(webcamStream, sendDataCallbacks) {
        this._isClosed = false;
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
    WebRTCVoIPHandler.prototype.isClosed = function () { return this._isClosed; };
    WebRTCVoIPHandler.prototype.handleAnswerFromCallee = function (sdp) {
        return __awaiter(this, void 0, void 0, function () {
            var desc;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        desc = new RTCSessionDescription(sdp);
                        return [4 /*yield*/, this.peerConnection.setRemoteDescription(desc).catch(function (e) { return console.error(e); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WebRTCVoIPHandler.prototype.onIceCandidate = function (ev) {
        if (!ev.candidate) {
            return;
        }
        var outgoingCandidate = ev.candidate.candidate;
        this.sendDataCallbacks['new-ice-candidate'](outgoingCandidate);
    };
    WebRTCVoIPHandler.prototype.onIceConnectionStateChange = function (ev) {
        switch (this.peerConnection.iceConnectionState) {
            case 'closed':
            case 'failed':
            case 'disconnected':
                this.closeCallAndConnection();
                break;
        }
    };
    // Handle the |icegatheringstatechange| event. This lets us know what the
    // ICE engine is currently working on: "new" means no networking has happened
    // yet, "gathering" means the ICE engine is currently gathering candidates,
    // and "complete" means gathering is complete. Note that the engine can
    // alternate between "gathering" and "complete" repeatedly as needs and
    // circumstances change.
    WebRTCVoIPHandler.prototype.onIceGatheringStateChange = function (ev) {
    };
    WebRTCVoIPHandler.prototype.onSignalingStateChange = function (ev) {
        switch (this.peerConnection.signalingState) {
            case 'closed':
                this.closeCallAndConnection();
                break;
        }
    };
    // Called by the WebRTC layer to let us know when it's time to
    // begin, resume, or restart ICE negotiation.
    WebRTCVoIPHandler.prototype.onNegotiationNeeded = function (ev) {
        return __awaiter(this, void 0, void 0, function () {
            var offer, sdp, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.peerConnection.createOffer()];
                    case 1:
                        offer = _a.sent();
                        // If the connection hasn't yet achieved the "stable" state,
                        // return to the caller. Another negotiationneeded event
                        // will be fired when the state stabilizes.
                        if (this.peerConnection.signalingState !== "stable") {
                            return [2 /*return*/];
                        }
                        //establish offer as local peer's current description
                        return [4 /*yield*/, this.peerConnection.setLocalDescription(offer)];
                    case 2:
                        //establish offer as local peer's current description
                        _a.sent();
                        sdp = this.peerConnection.localDescription;
                        if (!sdp) {
                            return [2 /*return*/];
                        }
                        this.sendDataCallbacks["call-request"](sdp);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error(error_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    WebRTCVoIPHandler.prototype.onTrack = function (ev) {
        this.sendDataCallbacks['media-track-event'](ev.streams);
    };
    WebRTCVoIPHandler.prototype.closeCallAndConnection = function () {
        this._isClosed = true;
        //prevent any extra events from executing during hangup
        this.peerConnection.ontrack = null;
        this.peerConnection.onicecandidate = null;
        this.peerConnection.onsignalingstatechange = null;
        this.peerConnection.onicegatheringstatechange = null;
        this.peerConnection.onnegotiationneeded = null;
        //stop all transceivers in connection
        this.peerConnection.getTransceivers().forEach(function (transceiver) {
            transceiver.stop();
        });
        //close peer connection
        this.peerConnection.close();
        //remove reference of peerConnection
        //@ts-ignore
        this.peerConnection = null;
    };
    WebRTCVoIPHandler.invite = function () {
        return __awaiter(this, void 0, void 0, function () {
            var webcamStream, rtn, transceiver;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, window.navigator.mediaDevices.getUserMedia(WebRTCVoIPHandler.MEDIA_CONSTRAINTS)];
                    case 1:
                        webcamStream = _a.sent();
                        rtn = new WebRTCVoIPHandler(webcamStream, { 'call-request': function (sdp) { }, 'new-ice-candidate': function (can) { }, "media-track-event": function (streams) { }, 'callee-accepted-call': function () { } });
                        transceiver = function (track) { return rtn.peerConnection.addTransceiver(track, { streams: [webcamStream] }); };
                        webcamStream.getTracks().forEach(function (track) { return transceiver(track); });
                        //rest of invite is handled be negotiationneeded event, 
                        //so no need to worry about it here
                        return [2 /*return*/, rtn];
                }
            });
        });
    };
    WebRTCVoIPHandler.accept = function (sdp) {
        return __awaiter(this, void 0, void 0, function () {
            var webcamStream, rtn, desc, transceiver, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, window.navigator.mediaDevices.getUserMedia(WebRTCVoIPHandler.MEDIA_CONSTRAINTS)];
                    case 1:
                        webcamStream = _c.sent();
                        rtn = new WebRTCVoIPHandler(webcamStream, { 'call-request': function (sdp) { }, 'new-ice-candidate': function (can) { }, "media-track-event": function (streams) { } });
                        desc = new RTCSessionDescription(sdp);
                        if (!(rtn.peerConnection.signalingState != "stable")) return [3 /*break*/, 3];
                        // Set the local and remove descriptions for rollback; don't proceed
                        // until both return.
                        return [4 /*yield*/, Promise.all([
                                rtn.peerConnection.setLocalDescription({ type: "rollback" }),
                                rtn.peerConnection.setRemoteDescription(desc)
                            ])];
                    case 2:
                        // Set the local and remove descriptions for rollback; don't proceed
                        // until both return.
                        _c.sent();
                        return [2 /*return*/, null];
                    case 3: return [4 /*yield*/, rtn.peerConnection.setRemoteDescription(desc)];
                    case 4:
                        _c.sent();
                        _c.label = 5;
                    case 5:
                        transceiver = function (track) { return rtn.peerConnection.addTransceiver(track, { streams: [webcamStream] }); };
                        webcamStream.getTracks().forEach(function (track) { return transceiver(track); });
                        _b = (_a = rtn.peerConnection).setLocalDescription;
                        return [4 /*yield*/, rtn.peerConnection.createAnswer()];
                    case 6: return [4 /*yield*/, _b.apply(_a, [_c.sent()])];
                    case 7:
                        _c.sent();
                        //send confirmation that you joined call to caller here
                        if (rtn.sendDataCallbacks['callee-accepted-call']) {
                            rtn.sendDataCallbacks['callee-accepted-call'](rtn.peerConnection.localDescription);
                        }
                        return [2 /*return*/, rtn];
                }
            });
        });
    };
    WebRTCVoIPHandler.MEDIA_CONSTRAINTS = {
        audio: true,
        video: {
            aspectRatio: {
                ideal: 1.333333
            }
        }
    };
    return WebRTCVoIPHandler;
}());
