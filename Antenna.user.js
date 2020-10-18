// ==UserScript==
// @name         Antenna
// @description  3D Web based peer to peer voice chat
// @author       TumbleGamer
// @version      0.0.10.10
// @match        https://boxcritters.com/play/
// @match        https://boxcritters.com/play/?*
// @match        https://boxcritters.com/play/#*
// @match        https://boxcritters.com/play/index.html
// @match        https://boxcritters.com/play/index.html?*
// @match        https://boxcritters.com/play/index.html#*
// @run-at       document-start
// @grant none
// @require      https://github.com/SArpnt/joinFunction/raw/master/script.js
// @require      https://github.com/SArpnt/EventHandler/raw/master/script.js
// @require      https://github.com/SArpnt/cardboard/raw/master/script.user.js
// @require      https://github.com/tumble1999/mod-utils/raw/master/mod-utils.js

// ==/UserScript==

(function () {
	"use strict";
	Window.AudioContext = window.AudioContext || window.webkitAudioContext;
	var Antenna = new TumbleMod({
		abriv: "Ant",
		cardboard: true,
		ip: "tumble-room-vc.herokuapp.com",
		emit: function (...p) {
			if (this.socket) this.socket.emit(...p)
		},
		on: function (...p) {
			if (this.socket) this.socket.on(...p)
		},
		peerConnections: {},
		peerPlayerIds: {},
		peerOutputs: {},
		config: {
			iceServers: [
				{
					urls: ["stun:stun.l.google.com:19302"]
				}
			]
		},
		audioContext: new AudioContext,
		audio: {
			input: new Audio,
			output: new Audio
		}

	})
	Antenna.log("Hello World")

	function createPeerConnection(id) {
		let peerConnection = new RTCPeerConnection(Antenna.config);
		Antenna.peerConnections[id] = peerConnection;

		peerConnection.onicecandidate = event => {
			if (event.candidate) {
				Antenna.emit("candidate", { id, candidate: event.candidate });
			}
		};
		//Setup Input Stream
		var inputStream = Antenna.audio.input.srcObject;
		inputStream.getTracks().forEach(track => peerConnection.addTrack(track, inputStream));

		//Setup Output Stream
		peerConnection.ontrack = event => {
			Antenna.log("track", event)

			var stream = new MediaStream;
			event.streams[0].getAudioTracks().forEach(track => stream.addTrack(track));
			var audio = new Audio;
			audio.muted = true;
			audio.srcObject = stream
			audio.play();
			let source = Antenna.audioContext.createMediaStreamSource(stream)

			source.connect(Antenna.audioContext.destination);
			Antenna.peerOutputs[id] = {
				stream,
				audio,
				source
			}
		}
		return peerConnection;
	}


	function disconnectFromPeer(id) {
		if (!Antenna.peerConnections[id]) return
		Antenna.peerConnections[id].close()
		delete Antenna.peerConnections[id];
		if (!Antenna.peerOutputs[id]) return;
		delete Antenna.peerOutputs[id];
	}
	function disconnectFromAllPeers() {
		for (let id in Antenna.peerConnections) {
			disconnectFromPeer(id);
		}
	}

	function joinRoom(room) {
		disconnectFromAllPeers();
		Antenna.emit("joinRoom", room);
		Antenna.log("Joined room " + room);
	}


	cardboard.on("runScripts", function () {
		if (io) Antenna.log("Socket.io's 'io' variable has been found")
		Antenna.socket = io.connect(Antenna.ip)

		Antenna.on("connect", () => {
			Antenna.log("Connected to " + Antenna.ip);
		});
		Antenna.on("peerConnect", id => {
			Antenna.log(`Peer ${id} has joined the room. Sending a peer to peer connection request to the new peer.`);
			var peerConnection = createPeerConnection(id);
			peerConnection
				.createOffer()
				.then(sdp => peerConnection.setLocalDescription(sdp))
				.then(_ => {
					Antenna.emit("request", { id, description: peerConnection.localDescription })
				})
		});
		Antenna.on("request", ({ id, bcid, description }) => {
			Antenna.log(`Incoming connection request from ${id}`, description);
			let peerConnection = createPeerConnection(id);
			peerConnection
				.setRemoteDescription(description)
				.then(_ => peerConnection.createAnswer())
				.then(sdp => peerConnection.setLocalDescription(sdp))
				.then(_ => {
					Antenna.emit("answer", { id, description: peerConnection.localDescription });
				})
			Antenna.peerPlayerIds[id] = bcid
		})

		// From New Peer to existing Peers
		Antenna.on("answer", ({ id, bcid, description }) => {
			Antenna.log(`Connection request to ${id} has been answered:`, description)
			Antenna.peerConnections[id].setRemoteDescription(description);
			Antenna.peerPlayerIds[id] = bcid
		});

		Antenna.on("candidate", ({ id, candidate }) => {
			//Antenna.log(`Candidate recived from ${id}:`, candidate)
			Antenna.peerConnections[id]
				.addIceCandidate(new RTCIceCandidate(candidate))
				.catch(e => console.error(e));
		});

		Antenna.on("peerDisconnect", id => {
			if (!Antenna.peerConnections[id]) return
			Antenna.log(`Peer ${id} has left the room`)
			disconnectFromPeer(id);
		})
	})
	cardboard.on("worldCreated", world => {
		Antenna.log("World created")
		Antenna.world = world;
	});

	cardboard.on("worldSocketCreated", (world, socket) => {
		socket.on("joinRoom", r => {
			Antenna.log("Joined Room: " + r.roomId)
			joinRoom(r.roomId);
		})
	})

	cardboard.on("login", () => {
		if (!Antenna.world) return;
		let id = Antenna.world.player.playerId
		Antenna.log("Logging in as", id)
		Antenna.emit("login", id)
	});

	function beforeLoad() {
		Antenna.socket.close();
	}
	window.addEventListener("unload", beforeLoad);
	window.addEventListener("beforeunload", beforeLoad);

	TumbleMod.onDocumentLoaded()
		.then(() => {
			Antenna.log("Setting up Microphone")
			Antenna.audioContext.resume();
			let outputDestination = Antenna.audioContext.createMediaStreamDestination();
			Antenna.audio.output.srcObject = outputDestination.stream;

			//Media Constaints
			const constraints = {
				audio: true
			}


			navigator.mediaDevices
				.getUserMedia(constraints)
				.then(stream => {
					Antenna.log("Connected to Microphone Stream", stream)
					Antenna.audio.input.srcObject = stream
				})
				.catch(error => console.error(error))

		})

	window.Antenna = Antenna;
})();