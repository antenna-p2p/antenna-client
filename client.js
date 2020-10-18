Window.AudioContext = window.AudioContext || window.webkitAudioContext;
const peerConnections = {};
const peerOutputs = {};
const config = {
	iceServers: [
		{
			urls: ["stun:stun.l.google.com:19302"]
		}
	]
}
//let ip = "ws://localhost:3001";
//let ip = "https://" + location.hostname + ":3001";
var audioContext = new AudioContext;
let ip = "tumble-room-vc.herokuapp.com"
let socket = io.connect(ip);
let audio = {
	input: new Audio,
	output: new Audio
}


function createPeerConnection(id) {
	let peerConnection = new RTCPeerConnection(config);
	peerConnections[id] = peerConnection;

	peerConnection.onicecandidate = event => {
		if (event.candidate) {
			socket.emit("candidate", id, event.candidate);
		}
	};
	//Setup Input Stream
	var inputStream = audio.input.srcObject;
	inputStream.getTracks().forEach(track => peerConnection.addTrack(track, inputStream));

	//Setup Output Stream
	peerConnection.ontrack = event => {
		console.log("track", event)

		var stream = new MediaStream;
		event.streams[0].getAudioTracks().forEach(track=>stream.addTrack(track));
		var audio = new Audio;
		audio.muted = true;
		audio.srcObject = stream
		audio.play();
		let source = audioContext.createMediaStreamSource(stream)

		source.connect(audioContext.destination);
		peerOutputs[id] = {
			stream,
			audio,
			source
		}
	}
	return peerConnection;
}

function disconnectFromPeer(id) {
	if (!peerConnections[id]) return
	peerConnections[id].close()
	delete peerConnections[id];
	if (!peerOutputs[id]) return;
	delete peerOutputs[id];
}

function disconnectFromAllPeers() {
	for (let id in peerConnections) {
		disconnectFromPeer(id);
	}
}

document.querySelector("button").addEventListener("click", () => {
	document.querySelector("button").remove();
	audioContext.resume();
	let outputDestination = audioContext.createMediaStreamDestination();
	audio.output.srcObject = outputDestination.stream;

	//Media Constaints
	const constraints = {
		audio: true
	}

	
	navigator.mediaDevices
		.getUserMedia(constraints)
		.then(stream => {
			console.log("Connected to Microphone Stream", stream)

			audio.input.srcObject = stream
			socket.emit("joinRoom")
		})
		.catch(error => console.error(error))

});


socket.on("connect", () => {
	console.log("Connected to " + ip);
})

// From New Peer to existing Peers
socket.on("peerConnect", function (id) {
	console.log(`Peer ${id} has joined the room. Sending a peer to peer connection request to the new peer.`)
	let peerConnection = createPeerConnection(id);
	peerConnection
		.createOffer()
		.then(sdp => peerConnection.setLocalDescription(sdp))
		.then(_ => {
			socket.emit("offer", id, peerConnection.localDescription);
		})
})

// From existing Peers to New Peer
socket.on("offer", (id, description) => {
	console.log(`Incoming connection offer from ${id}:`, description)
	let peerConnection = createPeerConnection(id);
	peerConnection
		.setRemoteDescription(description)
		.then(_ => peerConnection.createAnswer())
		.then(sdp => peerConnection.setLocalDescription(sdp))
		.then(_ => {
			socket.emit("answer", id, peerConnection.localDescription);
		})
})

// From New Peer to existing Peers
socket.on("answer", (id, description) => {
	console.log(`Connection offer to ${id} has been answered:`, description)
	peerConnections[id].setRemoteDescription(description);
});

socket.on("candidate", (id, candidate) => {
	console.log(`Candidate recived from ${id}:`, candidate)
	peerConnections[id]
		.addIceCandidate(new RTCIceCandidate(candidate))
		.catch(e => console.error(e));
});

socket.on("peerDisconnect", id => {
	if (!peerConnections[id]) return
	console.log(`Peer ${id} has left the room`)
	disconnectFromPeer(id);
})


window.onunload = window.onbeforeunload = () => {
	socket.close();
};