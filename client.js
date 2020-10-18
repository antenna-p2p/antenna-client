const peerConnections = {};
const peerSources = {};
const config = {
	iceServers: [
		{
			urls: ["stun:stun.l.google.com:19302"]
		}
	]
}

let socket;
let input;
let audioContext;

function disconnectFromPeer(id) {
	if (!peerConnections[id]) return
	peerConnections[id].close()
	delete peerConnections[id];
	if (!peerSources[id]) return;
	/*peerSources[id].disconnect(audioContext.destination);
	peerSources[id].close();*/
	delete peerSources[id];
}

function disconnectFromAllPeers() {
	for (let id in peerConnections) {
		disconnectFromPeer(id);
	}
}

//Media Constaints
const constraints = {
	audio: true
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
	input.getTracks().forEach(track => peerConnection.addTrack(track, input));

	//Setup Output Stream
	peerConnection.ontrack = event => {
		console.log("track",event)
		let element = new Audio;
		element.srcObject = event.streams[0];
		element.play();
		peerSources[id] = element;
		/*let peerSource = audioContext.createMediaStreamSource(event.streams[0])
		peerSources[id] = peerSource
		peerSource.connect(audioContext.destination);*/
	}

	return peerConnection;
}

document.querySelector("button").addEventListener("click", () => {
	document.querySelector("button").remove();
	//let ip = "ws://localhost:3001";
	//let ip = "https://" + location.hostname + ":3001";
	let ip = "tumble-room-vc.herokuapp.com"
	socket = io.connect(ip);
	audioContext = new AudioContext
	navigator.mediaDevices
		.getUserMedia(constraints)
		.then(stream => {
			console.log("Connected to Microphone Stream", stream)

			input = stream
			socket.emit("joinRoom")
		})
		.catch(error => console.error(error))


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

});


window.onunload = window.onbeforeunload = () => {
	socket.close();
};