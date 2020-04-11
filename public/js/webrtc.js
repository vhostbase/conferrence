/** browser dependent definition are aligned to one and the same standard name **/
navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition 
  || window.msSpeechRecognition || window.oSpeechRecognition;

var urlParams = new URLSearchParams(window.location.search);
var chatroomID = urlParams.get('chatroom');
var yuid = urlParams.get('authId');
var callHistory = urlParams.get('history');
var role = urlParams.get('role');
if(callHistory)
	callHistory = callHistory.toUpperCase();
console.log('callHistory '+callHistory);
var meetingInfo = 'chatroom='+chatroomID+'&yuid='+yuid;

if(role && role !== null)
	meetingInfo += '&role='+role;

var config = {
	wssHost: 'wss://websvrapp.herokuapp.com?'+meetingInfo
	//wssHost: 'ws://localhost:51391?'+meetingInfo
	//wssHost: 'wss://vchat-simplevideochat.apps.us-east-1.starter.openshift-online.com?yuid='+fromYuid
  //wssHost: 'wss://wotpal.club'
  // wssHost: 'wss://example.com/myWebSocket'
};

var localVideoElem = null, 
  remoteVideoElem = null, 
  localVideoStream = null,
  videoCallButton = null,
  pingTimer,
  endCallButton = null;
	var peerConn = null,
  wsc = new WebSocket(config.wssHost),
  peerConnCfg = {'iceServers': 
    [{'url': 'stun:stun.services.mozilla.com'}, 
     {'url': 'stun:stun.l.google.com:19302'}]
  };
  
function pageReady() {
  // check browser WebRTC availability 
  if(navigator.getUserMedia) {
    videoCallButton = document.getElementById("videoCallButton");
    endCallButton = document.getElementById("endCallButton");
    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');
    //videoCallButton.removeAttribute("disabled");
    videoCallButton.addEventListener("click", function(){
		setTimeout(function(){
			activateCall();
		}, 5);
		setTimeout(function(){
			initiateCall();
		}, 5);
    });
    endCallButton.addEventListener("click", function (evt) {
		wsc.send(JSON.stringify({"closeConnection": true , "chatroom" : chatroomID}));
    });
	launchCaller();
  } else {
    alert("Sorry, your browser does not support WebRTC!")
  }
};
function launchCaller(){
	pingTimer = setInterval(checkForMeeting, 1000);
}
function prepareCall() {
  peerConn = new RTCPeerConnection(peerConnCfg);
  // send any ice candidates to the other peer
  peerConn.onicecandidate = onIceCandidateHandler;
  // once remote stream arrives, show it in the remote video element
  peerConn.onaddstream = onAddStreamHandler;
};
function checkForMeeting(){
	waitForSocketConnection(wsc, function(){
		wsc.send(JSON.stringify({"getMembers": true , "chatroom" : chatroomID}));
	});	
}
function waitForSocketConnection(socket, callback){
    setTimeout(
        function () {
            if (socket.readyState === 1) {
                console.log("Connection is made")
                if (callback != null){
                    callback();
                }
            } else {
                console.log("wait for connection...")
                waitForSocketConnection(socket, callback);
            }

        }, 5); // wait 5 milisecond for the connection...
}
function activateCall(){
	waitForSocketConnection(wsc, function(){
		wsc.send(JSON.stringify({"activateCall": true , "chatroom" : chatroomID, 'yuid' : yuid}));
	});
	
}
// run start(true) to initiate a call
function initiateCall() {
  prepareCall();
  // get the local stream, show it in the local video element and send it
  navigator.getUserMedia({ "audio": true, "video": true }, function (stream) {
    localVideoStream = stream;
    localVideo.srcObject = localVideoStream; //URL.createObjectURL(localVideoStream);
    peerConn.addStream(localVideoStream);
    createAndSendOffer();
  }, function(error) { console.log(error);});
};

function answerCall() {
  prepareCall();
  // get the local stream, show it in the local video element and send it
  navigator.getUserMedia({ "audio": true, "video": true }, function (stream) {
    localVideoStream = stream;
    localVideo.srcObject = localVideoStream;//URL.createObjectURL(localVideoStream);
    peerConn.addStream(localVideoStream);
    createAndSendAnswer();
  }, function(error) { console.log(error);});
};

wsc.onmessage = function (evt) {
  var signal = null;
  signal = JSON.parse(evt.data);
	if ( signal.getMembers){
		var joiner = document.getElementById("joiner");
		if(signal.members.length < 2){
			videoCallButton.setAttribute("disabled", true);
			joiner.innerText = 'No Members joined';
			return;
		}
		joiner.innerText = signal.members.length+' Members joined including you';
		videoCallButton.removeAttribute("disabled");		
		clearInterval(pingTimer);
		return;
	}
	if(signal.activateCall && signal.yuid !== yuid){
		location.reload();
		return;
	}
  if (!peerConn) answerCall();  
  if (signal.sdp) {
    console.log("Received SDP from remote peer.");
    peerConn.setRemoteDescription(new RTCSessionDescription(signal.sdp));
  }
  else if (signal.candidate) {
    console.log("Received ICECandidate from remote peer.");
    peerConn.addIceCandidate(new RTCIceCandidate(signal.candidate));
  } else if ( signal.closeConnection){
    console.log("Received 'close call' signal from remote peer.");
    endCall();
	}
};

function createAndSendOffer() {
  peerConn.createOffer(
    function (offer) {
      var off = new RTCSessionDescription(offer);
      peerConn.setLocalDescription(new RTCSessionDescription(off), 
        function() {
		  waitForSocketConnection(wsc, function(){
			wsc.send(JSON.stringify({"sdp": off , "chatroom" : chatroomID}));
		  });
        }, 
        function(error) { console.log(error);}
      );
    }, 
    function (error) { console.log(error);}
  );
};

function createAndSendAnswer() {
  peerConn.createAnswer(
    function (answer) {
      var ans = new RTCSessionDescription(answer);
      peerConn.setLocalDescription(ans, function() {
		  waitForSocketConnection(wsc, function(){
          wsc.send(JSON.stringify({"sdp": ans, "chatroom" : chatroomID }));
		  });
        }, 
        function (error) { console.log(error);}
      );
    },
    function (error) {console.log(error);}
  );
};

function onIceCandidateHandler(evt) {
  if (!evt || !evt.candidate) return;
  waitForSocketConnection(wsc, function(){
  wsc.send(JSON.stringify({"candidate": evt.candidate, "chatroom" : chatroomID}));
  });
};

function onAddStreamHandler(evt) {
  videoCallButton.setAttribute("disabled", true);
  endCallButton.removeAttribute("disabled"); 
  // set remote video stream as source for remote video HTML5 element
  remoteVideo.srcObject = evt.stream;//URL.createObjectURL(evt.stream);
};

function endCall() {
  peerConn.close();
  peerConn = null;
  videoCallButton.removeAttribute("disabled");
  endCallButton.setAttribute("disabled", true);
  if (localVideoStream) {
    localVideoStream.getTracks().forEach(function (track) {
      track.stop();
    });
    localVideo.src = "";
  }
  if (remoteVideo) remoteVideo.src = "";
  if(callHistory === 'Y'){
	  window.history.back();
  }else{
	location.reload();
  }
};