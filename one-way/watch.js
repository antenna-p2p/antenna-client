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

socket.on("connect", () => {
	console.log("Connected to " + ip);
})

socket.on("offer", (id, description) => {
	const peerConnection = new RTCPeerConnection(config);
	
	peerConnection.ontrack = event => {
		video.srcObject = event.streams[0];
	};
	peerConnection.onicecandidate = event => {
		if (event.candidate) {
			socket.emit("candidate", id, event.candidate);
		}
	};
	peerConnection
		.setRemoteDescription(description)
		.then(() => peerConnection.createAnswer())
		.then(sdp => peerConnection.setLocalDescription(sdp))
		.then(() => {
			socket.emit("answer", id, peerConnection.localDescription);
		});
});

socket.on("candidate", (id, candidate) => {
	peerConnection
		.addIceCandidate(new RTCIceCandidate(candidate))
		.catch(e => console.error(e));
});

socket.on("connect", () => {
	socket.emit("watcher");
});

socket.on("broadcaster", () => {
	socket.emit("watcher");
});

socket.on("disconnectPeer", () => {
	peerConnection.close();
});

window.onunload = window.onbeforeunload = () => {
	socket.close();
};