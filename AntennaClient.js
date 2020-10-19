let AntennaClient;
(function () {
	"use strict";
	Window.AudioContext = window.AudioContext || window.webkitAudioContext;
	var defaultOptions = {
		ip: "tumble-room-vc.herokuapp.com",
		config: {
			iceServers: [
				{
					urls: ["stun:stun.l.google.com:19302"]
				}
			]
		},
		log: console.log
	};

	AntennaClient = class {
		constructor(options) {
			var { ip, config, log } = Object.assign(defaultOptions, options);
			this.log = log;
			this.ip = ip;
			this.peerConnections = {};
			this.peerPlayerIds = {};
			this.peerOutputs = {};
			this.config = config;
			this.audioContext = new AudioContext();
			this.audio = {
				input: new Audio,
				output: new Audio
			};

		}

		emit(...p) {
			if (this.socket) this.socket.emit(...p);
		}

		on(...p) {
			if (this.socket) this.socket.on(...p);
		}

		createPeerConnection(id) {
			let peerConnection = new RTCPeerConnection(this.config);
			this.peerConnections[id] = peerConnection;

			peerConnection.onicecandidate = event => {
				if (event.candidate) {
					this.emit("candidate", { id, candidate: event.candidate });
				}
			};
			//Setup Input Stream
			var inputStream = this.audio.input.srcObject;
			inputStream.getTracks().forEach(track => peerConnection.addTrack(track, inputStream));

			//Setup Output Stream
			peerConnection.ontrack = event => {
				var stream = new MediaStream;
				event.streams[0].getAudioTracks().forEach(track => stream.addTrack(track));
				var audio = new Audio;
				audio.muted = true;
				audio.srcObject = stream;
				audio.play();
				let source = this.audioContext.createMediaStreamSource(stream);
				source.connect(this.audioContext.destination);

				this.peerOutputs[id] = {
					stream,
					audio,
					source
				};
			};
			return peerConnection;
		}

		disconnectFromPeer(id) {
			if (!this.peerConnections[id]) return;
			this.peerConnections[id].close();
			delete this.peerConnections[id];
			if (!this.peerOutputs[id]) return;
			delete this.peerOutputs[id];
		}

		disconnectFromAllPeers() {
			for (let id in this.peerConnections) {
				this.disconnectFromPeer(id);
			}
		}

		login(world, id) {
			if (!world) return;
			this.world = world;
			this.emit("login", id);
		}

		joinRoom(room) {
			this.disconnectFromAllPeers();
			this.emit("joinRoom", room);
		}

		close() {
			this.socket.close();
		}

		setupSockets() {
			this.socket = io.connect(this.ip);
			this.on("connect", () => {
				this.log("Connected to " + this.ip);
			});
			this.on("peerConnect", id => {
				this.log(`Peer ${id} has joined the room. Sending a peer to peer connection request to the new peer.`);
				var peerConnection = this.createPeerConnection(id);
				peerConnection
					.createOffer()
					.then(sdp => peerConnection.setLocalDescription(sdp))
					.then(_ => {
						this.emit("request", { id, description: peerConnection.localDescription });
					});
			});
			this.on("request", ({ id, bcid, description }) => {
				this.log(`Incoming connection request from ${id}`, description);
				let peerConnection = this.createPeerConnection(id);
				peerConnection
					.setRemoteDescription(description)
					.then(_ => peerConnection.createAnswer())
					.then(sdp => peerConnection.setLocalDescription(sdp))
					.then(_ => {
						this.emit("answer", { id, description: peerConnection.localDescription });
					});
				this.peerPlayerIds[id] = bcid;
			});

			// From New Peer to existing Peers
			this.on("answer", ({ id, bcid, description }) => {
				this.log(`Connection request to ${id} has been answered:`, description);
				this.peerConnections[id].setRemoteDescription(description);
				this.peerPlayerIds[id] = bcid;
			});

			this.on("candidate", ({ id, candidate }) => {
				//this.log(`Candidate recived from ${id}:`, candidate)
				this.peerConnections[id]
					.addIceCandidate(new RTCIceCandidate(candidate))
					.catch(e => console.error(e));
			});

			this.on("peerDisconnect", id => {
				if (!this.peerConnections[id]) return;
				this.log(`Peer ${id} has left the room`);
				this.disconnectFromPeer(id);
			});
		}

		setupMic() {
			this.audioContext.resume();
			let outputDestination = this.audioContext.createMediaStreamDestination();
			this.audio.output.srcObject = outputDestination.stream;

			//Media Constaints
			const constraints = {
				audio: true
			};

			navigator.mediaDevices
				.getUserMedia(constraints)
				.then(stream => {
					this.log("Connectec to Microphone", stream);
					this.audio.input.srcObject = stream;
				})
				.catch(error => this.log(error));
		}
	};
})();