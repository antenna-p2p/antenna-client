"use strict";

const DEFAULT_OPTIONS = {
	//ip: "ws://localhost:3001",
	ip: "antennatest.herokuapp.com",
	config: {
		iceServers: [{ urls: ["stun:stun.l.google.com:19302"] },],
	},
	static: false,
};



/**
 * monitors volume of audio node
 * @param {AudioNode} audioNode
 * @param {AudioContext} [audioContext]
 * @param {function (number)} callback
 */
function monitorDB(audioNode, audioContext = new AudioContext, callback) {
	let analyser = audioContext.createAnalyser(),
		jsNode = audioContext.createScriptProcessor(2048, 1, 1);

	analyser.smoothingTimeConstant - 0.8;
	analyser.fftSize = 1024;

	audioNode.connect(analyser);
	analyser.connect(jsNode);

	jsNode.addEventListener("audioprocess", () => {
		let freq = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(freq);
		callback(freq.reduce((a, b) => a + b) / freq.length);
	});
	return jsNode;
}

class AntennaPeer {
	constructor(id, client) {
		let connection = new RTCPeerConnection(client.config);

		connection.onicecandidate = event => {
			if (event.candidate)
				client.emit("candidate", { id, candidate: event.candidate });
		};
		connection.ontrack = event => {
			console.log(event);
			let track = event.track, stream;

			switch (track.kind) {
				case "audio":
					stream = new MediaStream([track]);
					this.streams.audio.push(stream);
					//document.body.appendChild(client.createAudioElement(stream));
					break;
				case "video":
					stream = new MediaStream([track]);
					this.streams.video.push(stream);
					//document.body.appendChild(clienrcreateVideoElement(stream));
					break;
				default:
					console.log("Unknown track type: ", track.kind);
			}

			/*if (audioStream.getTracks().length > 0) {
				{
					let audio = new Audio;
					audio.muted = true;
					audio.srcObject = audioStream;
					audio.play();
				}
				let audioContext = new AudioContext,
					source = audioContext.createMediaStreamSource(audioStream),
					gain = audioContext.createGain(),
					//dbMeasurer = monitorDB(gain, audioContext, db => client.peerOutputs[id].db = db),
					destination = audioContext.createMediaStreamDestination()

				gain.gain.value = client.settings.gain;

				source.connect(gain);
				gain.connect(destination);


				Object.assign(this, {
					audioStream,
					source,
					gain,
					audioContext,
					destination
				});
			}*/
		};

		connection.oniceconnectionstatechange = e => console.log("ICE Connection state:" + connection.iceConnectionState);

		this.connection = connection;
		this.client = client;
		/**
		 * @property {Array<RTCDataChannel>}
		 */
		this.channels = {};
		this.streams = { video: [], audio: [] };
	}

	async setupRequest() {
		let sdp = await this.connection.createOffer();
		await this.setLocalDescription(sdp);
	}

	async answerRequest(description) {
		await this.setRemoteDescription(description);
		let sdp = await this.connection.createAnswer();
		await this.setLocalDescription(sdp);
	}

	async setLocalDescription(sdp) {
		await this.connection.setLocalDescription(sdp);
	}

	get localDescription() {
		return this.connection.localDescription;
	}

	async setRemoteDescription(description) {
		await this.connection.setRemoteDescription(description);
	}
	async addIceCandidate(candidate) {
		try {
			await this.connection.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
		} catch (e) {
			console.log(e);
		}
	}

	async createChannel(name, options = {}) {
		console.log(`Creating channel: ${name}...`);
		Object.assign(options, {
			negotiated: true,
			id: Object.keys(this.channels).length
		});
		let channel = await this.connection.createDataChannel(name, options);
		this.channels[name] = channel;
		await this.setupChannel(channel);
		return channel;
	}

	deleteChannel(name) {
		this.channels[name].close();
		delete channels[name];
	}

	/**
	 * 
	 * @param {RTCDataChannel} channel 
	 */
	setupChannel(channel) {
		return new Promise((resolve, request) => {
			let statusCB = () => {
				switch (channel.readyState) {
					case "opening":
						console.log(`${channel.label} Opening`);
						break;
					case "open":
						console.log(`${channel.label} Opened`);
						resolve();
						break;
					case "closing":
					case "closed":
						console.log(`${channel.label} Closed`);
						break;
				}
			};
			// Setup channel Events
			channel.onerror = e => console.log(`${channel.label} Error: `, e);
			channel.onopen = channel.onclose = statusCB;
			channel.onmessage = e => this.client.settings.onDataChannel[channel.label](e);
		});
	}

	/**
	 * 
	 * @param {MediaStream[]} streams
	 */
	setInputStreams(streams) {
		let stream = new MediaStream(streams.map(s => s.getTracks()).flat());
		stream.getTracks().forEach(track => this.connection.addTrack(track, stream));
	}

	async send(channel, data) {
		if (!this.channels[channel])
			await this.createChannel(channel);
		this.channels[channel].send(data);
	}

	close() {
		Object.values(this.channels).forEach(channel => channel.close());
		this.connection.close();
	}
}

class AntennaClient {
	constructor(options) {
		options = Object.assign(DEFAULT_OPTIONS, options);

		this.config = options.config;
		this.ip = options.ip;

		this.peers = {};

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
			onMessage: _ => 0,
			onDataChannel: {}
		};
		this.streams = [];
	}

	/*
	 * Socket
	 */
	emit(...p) {
		if (this.socket)
			this.socket.emit(...p);
		else
			console.warn("Tried to use socket when it doesn't exist!");
	}
	on(...p) {
		if (this.socket)
			this.socket.on(...p);
		else
			console.warn("Tried to use socket when it doesn't exist!");
	}
	close() {
		if (this.socket)
			this.socket.close();
		else
			console.warn("Tried to use socket when it doesn't exist!");
	}
	setupSocket() {
		this.socket = io.connect(this.ip);
		this.on("connect", () => {
			console.log(`Connected to ${this.ip}`);
			if (this.room) {
				console.log(`Rejoining ${this.room.roomId}`);
				this.joinRoom();
			}
		});
		this.on("peerConnect", async ({ id }) => {
			console.log(`Peer ${id} has joined the room. Sending a peer to peer connection request to the new peer.`);
			let peer = this.createPeer(id);
			await peer.setupRequest();
			this.emit("request", { id, description: peer.localDescription });
		});
		this.on("request", async ({ id, description }) => {
			console.log(`Incoming connection request from ${id}`, description);
			let peer = this.createPeer(id);
			await peer.answerRequest(description);
			this.emit("answer", { id, description: peer.localDescription });
			this.emit("status", this.settings);
		});

		// From New Peer to existing Peers
		this.on("answer", ({ id, description }) => {
			console.log(`Connection request to ${id} has been answered:`, description);
			this.peers[id].setRemoteDescription(description);
			this.emit("status", this.settings);
		});

		this.on("candidate", ({ id, candidate }) => {
			this.peers[id].addIceCandidate(candidate);
		});

		this.on("peerDisconnect", id => {
			if (this.peers[id]) {
				console.log(`Peer ${id} has left the room`);
				this.disconnectFromPeer(id);
			}
		});

		this.on("status", ({ id, status }) => {
			this.updateStatus({ id, status });
		});
	}

	createPeer(id) {
		let peer = new AntennaPeer(id, this);
		peer.createChannel("text");
		peer.setInputStreams(this.streams);
		this.peers[id] = peer;
		return peer;
	}

	joinRoom(room = this.room.roomId) {
		if (!room.roomId)
			room = { roomId: room };

		this.disconnectFromAllPeers();
		this.emit("joinRoom", room.roomId);
		this.room = room;
	}

	updateStatus({ id, status } = {}) {
		let target;
		if (id) {
			target = this.peers[id];
		} else {
			target = this;
			status = this.settings;
		}
	}

	disconnectFromPeer(id) {
		if (this.peers[id]) {
			this.peers[id].close();
			delete this.peers[id];
		}
	}
	disconnectFromAllPeers() {
		for (let id in this.peers)
			this.disconnectFromPeer(id);
	}

	send(channel, data) {
		Object.values(this.peers).forEach(peer => peer.send(channel, data));
	}

	setGain(value) {
		this.settings.gain = value;
		Object.values(this.peer).forEach(peer => {
			if (peer.gain)
				peer.gain.gain.value = value;
		});
		this.updateStatus();
		this.emit("status", this.settings);
	}

	/*
	 * Callbacks
	 */
	// TODO: generic on function, multiple callbacks at once (probably should extend sarpnt EventHandler class)
	onMicDB(callback) {
		this.settings.onMicDB = callback;
	}
	onSpeakerDB(callback) {
		this.settings.onSpeakerDB = _ =>
			callback(this.peers.reduce((s, p) => s + p.db, 0) / this.peers.length);
	}
	onDataRecived(channel, callback) {
		this.settings.onDataChannel[channel] = callback;
	}

	setSpeaker(deviceId) {
		this.settings.outputId = deviceId;
		Object.values(this.peers).forEach(peer => {
			console.log(peer.audio, deviceId);
			if (!audio.setSinkId) // TODO: better support check
				throw "setSinkId not supported on this browser";
			peer.audio.setSinkId(deviceId);
		});
	}

	async addMicrophone(deviceId) {
		// Media Constraints
		const CONSTRAINTS = { audio: { deviceId } };
		let stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
		console.log("Connected to Microphone", stream);
		this.streams.push(stream);
		//document.body.appendChild(createAudioElement(stream));
	}

	async addCamera(deviceId) {
		// Media Constraints
		const CONSTRAINTS = { video: { facingMode: "user", deviceId } };
		let stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
		console.log("Connected to Camera", stream);
		this.streams.push(stream);
		//document.body.appendChild(createVideoElement(stream));
	}

	async addScreen() {
		const CONSTRAINTS = { video: { cursor: "always", logicalSurface: true }, audio: true };
		let stream = await navigator.mediaDevices.getDisplayMedia(CONSTRAINTS);
		console.log("Connected to Screen", stream);
		this.streams.push(stream);
		//document.body.appendChild(createVideoElement(stream));
	}

	async getDevices(kind = "input") {
		let devices = await navigator.mediaDevices.enumerateDevices();
		return;
		devices.filter(device => device.kind == "audio" + kind);
	}

	createAudioElement(stream) {
		let audio = new Audio();
		audio.srcObject = stream;
		audio.play();
		return audio;
	}
	createVideoElement(stream) {
		let video = document.createElement("video");
		video.srcObject = stream;
		video.play();
		return video;
	}

};
export { AntennaClient };