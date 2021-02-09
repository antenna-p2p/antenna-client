"use strict";

let AntennaClient;
(function () {
	Window.AudioContext = window.AudioContext ?? window.webkitAudioContext;
	const DEFAULT_OPTIONS = {
		//ip: "ws://localhost:3001",
		ip: "antennatest.herokuapp.com",
		config: {
			iceServers: [ // what is iceservers
				{
					urls: ["stun:stun.l.google.com:19302"],
				},
			],
		},
		log: console.log,
		static: false,
	};

	/**
	 * monitors volume of audio node
	 * @param {AudioNode} audioNode 
	 * @param {AudioContext} [audioContext]
	 * @param {function (number)} callback 
	 */
	function moniterDB(audioNode, audioContext = new AudioContext, callback) {
		if (audioNode.constructor.name == "MediaStream")
			audioNode = audioContext.createMediaStreamSource(audioNode);

		let analyser = audioContext.createAnalyser(),
			jsNode = audioContext.createScriptProcessor(2048, 1, 1);

		analyser.smoothingTimeConstant - 0.8;
		analyser.fftSize = 1024;

		audioNode.connect(analyser);
		analyser.connect(jsNode);
		if (out != undefined)
			jsNode.connect(out);

		jsNode.addEventListener("audioprocess", () => {
			let freq = new Uint8Array(analyser.frequencyBinCount);
			analyser.getByteFrequencyData(freq);
			callback(freq.reduce((a, b) => a + b) / freq.length);
		});
		return jsNode;
	}

	AntennaClient = class AntennaClient {
		constructor(options) {
			options = Object.assign(DEFAULT_OPTIONS, options);

			this.log = options.log;
			this.config = options.config;
			this.ip = options.ip;

			this.peerConnections = {};
			this.peerPlayerIds = {};
			this.peerOutputs = {};

			this.devices = {
				input: null,
				output: null,
			};
			this.settings = {
				gain: 1,
				inputId: "communications",
				outputId: "communications",
				onMicDB: _ => 0,
				onSpeakerDB: _ => 0,
			};
			this.input = {
				audio: new Audio,
			};
		}

		emit(...p) {
			if (this.socket)
				this.socket.emit(...p);
		}

		on(...p) {
			if (this.socket)
				this.socket.on(...p);
		}

		createPeerConnection(id) {
			let peerConnection = new RTCPeerConnection(this.config);
			this.peerConnections[id] = peerConnection;

			peerConnection.onicecandidate = event => {
				if (event.candidate)
					this.emit("candidate", { id, candidate: event.candidate });
			};
			// Setup Input Stream
			let inputStream = this.input.audio.srcObject;
			inputStream.getTracks().forEach(track => peerConnection.addTrack(track, inputStream));

			// Setup Output Stream
			peerConnection.ontrack = event => {
				let stream = new MediaStream;
				event.streams[0].getAudioTracks().forEach(track => stream.addTrack(track));
				// for some reason you have to stream peer connections to an audio element before you can do anything else to it
				{
					let audio = new Audio;
					audio.muted = true;
					audio.srcObject = stream;
					audio.play();
				}

				let audioContext = new AudioContext,
					source = audioContext.createMediaStreamSource(stream),
					gain = audioContext.createGain(),
					panner = audioContext.createPanner(),
					destination = audioContext.createMediaStreamDestination(),
					audio = new Audio;

				source.connect(gain);
				gain.gain.value = this.settings.gain;

				let dbParams = [audioContext, db => this.peerOutputs[id].db = db],
					dbMeasurer = moniterDB(gain, ...dbParams);
				//gain.connect(destination);

				dbMeasurer.connect(destination);
				audio.srcObject = destination.stream;
				//audio.src = URL.createObjectURL(destination.stream)
				audio.play();
				audio.setSinkId(this.settings.outputId);

				Object.assign(this.peerOutputs[id], {
					stream,
					source,
					gain,
					panner,
					audioContext,
					destination,
					audio,
				});
			};
			this.peerOutputs[id] = {};
			return peerConnection;
		}

		updateStatus({ id, status } = {}) {
			let target;
			if (id) {
				target = this.peerOutputs[id];
			} else {
				target = this;
				status = this.settings;
			}
			if (target.statusDot)
				target.statusDot.setColor(status.gain > 0 ? "green" : "red");
		}

		disconnectFromPeer(id) {
			if (!this.peerConnections[id]) {
				this.peerConnections[id].close();
				delete this.peerConnections[id];
			}
			if (this.peerOutputs[id])
				delete this.peerOutputs[id];
		}

		disconnectFromAllPeers() {
			for (let id in this.peerConnections) {
				this.disconnectFromPeer(id);
			}
		}

		joinRoom(room = this.room.roomId) {
			this.roomLoaded = false;
			this.disconnectFromAllPeers();
			if (!room.roomId)
				room = { roomId: room };
			this.emit("joinRoom", room.roomId);
			this.room = room;

			setTimeout(_ => {
				this.roomLoaded = true;
			}, 0);
		}

		close() {
			this.socket.close();
		}

		setupSockets() {
			this.socket = io.connect(this.ip);
			this.on("connect", () => {
				this.log(`Connected to ${this.ip}`);
				if (this.room) {
					this.log(`Rejoining ${this.room.roomId}`);
					this.joinRoom();
				}
			});
			this.on("peerConnect", async ({ id }) => {
				this.log(`Peer ${id} has joined the room. Sending a peer to peer connection request to the new peer.`);
				let peerConnection = this.createPeerConnection(id, true);
				peerConnection
					.createOffer()
					.then(sdp => peerConnection.setLocalDescription(sdp))
					.then(_ => {
						this.emit("request", { id, description: peerConnection.localDescription });
					});
			});
			this.on("request", async ({ id, description }) => {
				this.log(`Incoming connection request from ${id}`, description);
				let peerConnection = this.createPeerConnection(id);
				peerConnection
					.setRemoteDescription(description)
					.then(_ => peerConnection.createAnswer())
					.then(sdp => peerConnection.setLocalDescription(sdp))
					.then(_ => {
						this.emit("answer", { id, description: peerConnection.localDescription });
						this.emit("status", this.settings);
					});
			});

			// From New Peer to existing Peers
			this.on("answer", ({ id, description }) => {
				this.log(`Connection request to ${id} has been answered:`, description);
				this.peerConnections[id].setRemoteDescription(description);
				this.emit("status", this.settings);
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

			this.on("status", ({ id, status }) => {
				this.updateStatus({ id, status });
			});
		}

		setVolume(value) { this.setGain(value); }

		setGain(value) {
			this.settings.gain = value;
			Object.values(this.peerOutputs).forEach(peer => peer.gain.gain.value = value);
			this.updateStatus();
			this.emit("status", this.settings);
		}

		onMicDB(cb) {
			this.settings.onMicDB = cb;
		}

		onSpeakerDB(cb) {
			this.settings.onSpeakerDB = _ => cb(this.peerOutputs.reduce((s, p) => s + p.db, 0) / this.peerOutputs.length);
		}

		setSpeaker(deviceId = "communications") {
			this.settings.outputId = deviceId;
			Object.values(this.peerOutputs).forEach(peer => {
				console.log(peer.audio, deviceId);
				peer.audio.setSinkId(deviceId);
			});
		}


		setMicrophone(deviceId = "communications") {
			this.settings.inputId = deviceId;
			// Media Constraints
			const CONSTRAINTS = {
				audio: { deviceId }
			};

			return new Promise((resolve, reject) => {
				navigator.mediaDevices
					.getUserMedia(CONSTRAINTS)
					.then(stream => {
						this.log("Connected to Microphone", stream);

						let audioContext = new AudioContext,
							micOutput = moniterDB(stream, audioContext, db => {
								this.input.db = db;
								this.settings.onMicDB(db);
							}),
							destination = audioContext.createMediaStreamDestination();

						micOutput.connect(destination);
						this.devices.input = destination.stream;

						this.input.audio.srcObject = stream;
						resolve();
					})
					.catch(e => console.error(e));
			});
		}

		async getDevices(kind = "input") {
			let devices = await navigator.mediaDevices.enumerateDevices();
			return devices.filter(device => device.kind == "audio" + kind);
		}
	};
})();