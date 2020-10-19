let AntennaClient;
(function () {
	"use strict";
	Window.AudioContext = window.AudioContext || window.webkitAudioContext;
	let defaultOptions = {
		//ip: "ws://localhost:3001",
		ip: "tumble-room-vc.herokuapp.com",
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

	function setupNodeRoation(target) {
		let up = [0, 1, 0];
		let forward = [0, 0, -1];
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

	AntennaClient = class {
		constructor(options) {
			let { ip, config, log } = Object.assign(defaultOptions, options);
			this.log = log;
			this.ip = ip;
			this.peerConnections = {};
			this.peerPlayerIds = {};
			this.peerOutputs = {};
			this.config = config;
			this._gain = 1;
			this.input = {};

		}

		get omnipresent() {
			return !this.bcid;
		}

		getPlayer(id) {
			if (this.omnipresent || (!this.room && !this.world)) return;
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
			let inputStream = this.input.stream;
			if (!inputStream) {
				inputStream.getTracks().forEach(track => peerConnection.addTrack(track, inputStream));
			}

			//Setup Output Stream
			peerConnection.ontrack = event => {
				let stream = new MediaStream;
				event.streams[0].getAudioTracks().forEach(track => stream.addTrack(track));
				let audio = new Audio;
				audio.muted = true;
				audio.srcObject = stream;
				audio.play();
				let audioContext = new AudioContext();
				setupNodeRoation(audioContext.listener);
				let source = audioContext.createMediaStreamSource(stream);
				let gain = audioContext.createGain();
				source.connect(gain);
				gain.gain.value = this._gain;

				if (omnipresent || this.omnipresent) {
					gain.connect(audioContext.destination);
				} else {
					//for Positioning
					let panner = audioContext.createPanner();
					setupNodeRoation(panner);
					gain.connect(panner);
					panner.connect(audioContext.destination);
					panner.coneInnerAngle = 360;
				}

				this.peerOutputs[id] = {
					stream,
					source,
					gain,
					panner,
					audioContext
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
				let peerConnection = this.createPeerConnection(id, !bcid);
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

		setNodePosition(target, pos) {
			this.log("Setting position for", pos);

			pos = [pos.x, 0, pos.y];

			if (target.positionX) {
				[
					target.positionX.value,
					target.positionY.value,
					target.positionZ.value
				] = pos;
			} else {
				target.setPosition(...pos);
			}
		}

		setPosition(info = this.getPlayer()) {
			if (this.omnipresent) return;
			let target;
			if (!info) return;
			if (info.i == this.bcid) {
				target = Object.values(this.peerOutputs).map(peer => peer.audioContext.listener);
			} else {
				let rtcID = this.peerPlayerIds[info.i];
				let peer = this.peerOutputs[rtcID];
				if (peer) target = peer.panner;
			}
			if (!target) return;
			if (Array.isArray(target)) {
				target.forEach(target => this.setNodePosition(target, info));
			} else {
				this.setNodePosition(target, info);
			}
		}

		setVolume(value) { this.setGain(value); }

		setGain(value) {
			this._gain = value;
			let gainNodes = Object.values(this.peerOutputs).map(peer => peer.gain);
			gainNodes.forEach(gainNode => gainNode.gain = value);

		}

		setupMic() {
			//Media Constaints
			const constraints = {
				audio: true
			};

			return new Promise((resolve, reject) => {
				navigator.mediaDevices
					.getUserMedia(constraints)
					.then(stream => {
						this.log("Connectec to Microphone", stream);
						this.input.stream = stream;
						resolve();
					})
					.catch(error => this.log(error));

			});
		}
	};
})();