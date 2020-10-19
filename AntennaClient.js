let AntennaClient;
(function () {
	"use strict";
	Window.AudioContext = window.AudioContext || window.webkitAudioContext;
	var defaultOptions = {
		ip: "ws://localhost:3001",
		//ip: "tumble-room-vc.herokuapp.com",
		config: {
			iceServers: [
				{
					urls: ["stun:stun.l.google.com:19302"]
				}
			]
		},
		log: console.log,
		static: false
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

		get static() {
			return !this.bcid;
		}

		getPlayer(id) {
			if (this.static||(!this.room && !this.world) || (!id && !this.bcid)) return;
			let room = this.world.room || this.room;
			if (!id) id = this.bcid;
			return room.playerCrumbs.find(p => p.i == id);
		}

		emit(...p) {
			if (this.socket) this.socket.emit(...p);
		}

		on(...p) {
			if (this.socket) this.socket.on(...p);
		}

		createPeerConnection(id, omnipresent) {
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

				if (omnipresent || this.static) {
					source.connect(this.audioContext.destination);
				} else {
					//for Positioning
					var panner = this.audioContext.createPanner();
					source.connect(panner);
					panner.connect(this.audioContext.destination);
					panner.coneInnerAngle = 360;
				}

				this.peerOutputs[id] = {
					stream,
					audio,
					panner,
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
			this.bcid = id;
			this.emit("login", id);
		}

		joinRoom(room = this.room.roomId) {
			this.disconnectFromAllPeers();
			if (!room.roomId) room = { roomId: room };
			this.emit("joinRoom", room.roomId);
			this.room = room;
			this.setPosition();
		}

		close() {
			this.socket.close();
		}

		setupSockets() {
			this.socket = io.connect(this.ip);
			this.on("connect", () => {
				this.log("Connected to " + this.ip);
				if (this.room) {
					this.log("Rejoining " + this.room.roomId);
					this.joinRoom();
				}
			});
			this.on("peerConnect", ({ id, bcid }) => {
				this.log(`Peer ${id} (${bcid || "omnipresent"}) has joined the room. Sending a peer to peer connection request to the new peer.`);
				var peerConnection = this.createPeerConnection(id, !!bcid);
				peerConnection
					.createOffer()
					.then(sdp => peerConnection.setLocalDescription(sdp))
					.then(_ => {
						this.emit("request", { id, description: peerConnection.localDescription });
					});
				this.peerPlayerIds[bcid] = id;
				this.setPosition(this.getPlayer(bcid));
			});
			this.on("request", ({ id, bcid, description }) => {
				this.log(`Incoming connection request from ${id} (${bcid || "omnipresent"}) `, description);
				let peerConnection = this.createPeerConnection(id, !bcid);
				peerConnection
					.setRemoteDescription(description)
					.then(_ => peerConnection.createAnswer())
					.then(sdp => peerConnection.setLocalDescription(sdp))
					.then(_ => {
						this.emit("answer", { id, description: peerConnection.localDescription });
					});
				this.peerPlayerIds[bcid] = id;
				this.setPosition(this.getPlayer(bcid));
			});

			// From New Peer to existing Peers
			this.on("answer", ({ id, description }) => {
				this.log(`Connection request to  ${id} has been answered:`, description);
				this.peerConnections[id].setRemoteDescription(description);
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

		setPosition(info = this.getPlayer()) {
			if (this.static) return;
			let target;
			if (info.i == this.bcid) {
				target = this.audioContext.listener;
			} else {
				let rtcID = this.peerPlayerIds[info.i];
				let peer = this.peerOutputs[rtcID];
				if (peer) target = peer.panner;
			}
			if (!target) return;
			this.log("Setting position for", info);

			let pos = [info.x, 0, info.y];
			let up = [0, 1, 0];
			let forward = [0, 0, -1];

			if (target.positionX) {
				[
					target.positionX.value,
					target.positionY.value,
					target.positionZ.value
				] = pos;
			} else {
				target.setPosition(...pos);
			}
			if (target.forwardX) {
				[
					target.forwardX.value,
					target.forwardY.value,
					target.forwardZ.value
				] = forward;
				[
					target.upX.value,
					target.forwardY.value,
					target.forwardZ.value
				] = forward;
			} else {
				target.setOrientation(...forward, ...up);
			}
		}

		setupMic() {
			this.audioContext.resume();
			let outputDestination = this.audioContext.createMediaStreamDestination();
			this.audio.output.srcObject = outputDestination.stream;

			//Media Constaints
			const constraints = {
				audio: true
			};

			return new Promise((resolve, reject) => {
				navigator.mediaDevices
					.getUserMedia(constraints)
					.then(stream => {
						this.log("Connectec to Microphone", stream);
						this.audio.input.srcObject = stream;
						resolve()
					})
					.catch(error => this.log(error));

			});
		}
	};
})();