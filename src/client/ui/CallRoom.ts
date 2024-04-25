import { callSocketBuilder } from "../webrtc/VideoCaller.js";

const userList = document.getElementById('user-list') as HTMLDivElement;
const localVideo = document.getElementById('localCam') as HTMLVideoElement;
const remoteVideo = document.getElementById('remoteCam') as HTMLVideoElement;



(async () => {


  let socketHandler = callSocketBuilder(localVideo, remoteVideo, (updatedUserList) => {

    while(userList.firstChild) {
      userList.removeChild(userList.firstChild);
    }

    console.log(updatedUserList);

    updatedUserList.forEach((user) => {
      let line = document.createElement('p');
      let button = document.createElement('button');

      button.textContent = "Call";
      button.onclick = async (e) => {
        let stream = await socketHandler.startCall(user.callerId);
        localVideo.srcObject = stream;
      };

      line.textContent = user.callerId;
      line.appendChild(button);

      userList.appendChild(line);
    })
  });


})();



