const peerConnections = {};
const config = {
	iceServers: [
		{
			urls: ["stun:stun.l.google.com:19302"]
		}
	]
}

var ip = "ws://localhost:3000"
const socket = io(ip)
const video = document.querySelector("video");

// Media contrains
const constraints = {
	video: { facingMode: "user" },
	// Uncomment to enable audio
	audio: true,
};

navigator.mediaDevices
	.getUserMedia(constraints)
	.then(stream => {
		video.srcObject = stream;
		socket.emit("broadcaster");
	})
	.catch(error => console.error(error));

socket.on("watcher", id => {
	const peerConnection = new RTCPeerConnection(config);
	peerConnections[id] = peerConnection;

	let stream = video.srcObject;
	stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

	peerConnection.onicecandidate = event => {
		if (event.candidate) {
			socket.emit("candidate", id, event.candidate);
		}
	};

	peerConnection
		.createOffer()
		.then(sdp => peerConnection.setLocalDescription(sdp))
		.then(() => {
			socket.emit("offer", id, peerConnection.localDescription);
		});
});

socket.on("connect", () => {
	console.log("Connected to " + ip);
})

socket.on("answer", (id, description) => {
	peerConnections[id].setRemoteDescription(description);
});

socket.on("candidate", (id, candidate) => {
	peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("disconnectPeer", id => {
	peerConnections[id].close();
	delete peerConnections[id];
});

window.onunload = window.onbeforeunload = () => {
	socket.close();
};