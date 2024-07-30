const startVideoCallButton = document.getElementById('startVideoCall');
const startAudioCallButton = document.getElementById('startAudioCall');
const toggleCameraButton = document.getElementById('toggleCamera');
const toggleMicrophoneButton = document.getElementById('toggleMicrophone');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const messageInput = document.getElementById('messageInput');
const sendMessageButton = document.getElementById('sendMessage');
const chatMessages = document.getElementById('chatMessages');
const endCallButton = document.getElementById('endCall');
const nextButton = document.getElementById('next');

let localStream;
let peerConnection;
let signalingServer;

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// WebSocket connection to signaling server
signalingServer = new WebSocket('ws://localhost:3001'); // Ensure it matches the port

// Handle WebSocket messages
signalingServer.onmessage = async (message) => {
  const data = JSON.parse(message.data);

  if (data.action === 'connect') {
    const { peerId, type } = data;
    startCall(type, peerId);
  } else if (data.offer) {
    await handleOffer(data.offer, data.from);
  } else if (data.answer) {
    await handleAnswer(data.answer);
  } else if (data.iceCandidate) {
    await handleIceCandidate(data.iceCandidate);
  } else if (data.message) {
    displayMessage(data.message, 'received');
  }
};

// Start Video Call button click handler
startVideoCallButton.addEventListener('click', () => {
  startCall('video');
});

// Start Audio Call button click handler
startAudioCallButton.addEventListener('click', () => {
  startCall('audio');
});

// Toggle Camera button click handler
toggleCameraButton.addEventListener('click', () => {
  toggleMediaStream('video');
});

// Toggle Microphone button click handler
toggleMicrophoneButton.addEventListener('click', () => {
  toggleMediaStream('audio');
});

// Send Message button click handler
sendMessageButton.addEventListener('click', () => {
  const message = messageInput.value.trim();
  if (message !== '') {
    sendMessage(message);
    messageInput.value = '';
  }
});

// End Call button click handler
endCallButton.addEventListener('click', () => {
  endCall();
});

// Function to end the call
function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
  }
}

// Next button click handler
nextButton.addEventListener('click', () => {
  nextPeer();
});

// Function to connect to the next peer
function nextPeer() {
  endCall(); // End current call

  // Determine call type based on current stream or previous call type
  const type = localStream ? (localStream.getVideoTracks().length > 0 ? 'video' : 'audio') : '';

  // Send signal to server to find next peer of the same type
  signalingServer.send(JSON.stringify({ next: type }));
}

// Start a call (audio or video)
async function startCall(type, peerId = null) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
    localVideo.srcObject = localStream;

    // Create peer connection
    peerConnection = new RTCPeerConnection(configuration);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Handle incoming media stream
    peerConnection.ontrack = event => {
      remoteVideo.srcObject = event.streams[0];
    };

    // Handle ICE candidate
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        signalingServer.send(JSON.stringify({ iceCandidate: event.candidate, to: peerId }));
      }
    };

    if (peerId) {
      // Create and send offer to peer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      signalingServer.send(JSON.stringify({ offer, to: peerId }));
    }
  } catch (error) {
    console.error('Error starting the call:', error);
  }
}

// Handle incoming offer from peer
async function handleOffer(offer, from) {
  try {
    peerConnection = new RTCPeerConnection(configuration);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Handle incoming media stream
    peerConnection.ontrack = event => {
      remoteVideo.srcObject = event.streams[0];
    };

    // Handle ICE candidate
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        signalingServer.send(JSON.stringify({ iceCandidate: event.candidate, to: from }));
      }
    };

    // Set remote description and create answer
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    signalingServer.send(JSON.stringify({ answer, to: from }));
  } catch (error) {
    console.error('Error handling offer:', error);
  }
}

// Handle incoming answer from peer
async function handleAnswer(answer) {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (error) {
    console.error('Error handling answer:', error);
  }
}

// Handle ICE candidate from peer
async function handleIceCandidate(iceCandidate) {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate));
  } catch (error) {
    console.error('Error handling ICE candidate:', error);
  }
}

// Toggle camera or microphone
function toggleMediaStream(type) {
  if (localStream) {
    localStream.getTracks().forEach(track => {
      if (track.kind === type) {
        track.enabled = !track.enabled;
      }
    });
  }
}

// Send chat message
function sendMessage(message) {
  const data = {
    message,
    type: 'text',
  };
  signalingServer.send(JSON.stringify(data));
  displayMessage(message, 'sent');
}

// Display chat message
function displayMessage(message, type) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  div.textContent = message;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom
}
