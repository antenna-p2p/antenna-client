"use strict";

const DEFAULT_OPTIONS = {
	//ip: "ws://localhost:3001",
	ip: "antennatest.herokuapp.com",
	config: {
		iceServers: [
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
			let audioStream = new MediaStream(event.streams[0].getAudioTracks()),
				videoStream = new MediaStream(event.streams[0].getVideoTracks());
			//event.streams[0].getAudioTracks().forEach(track => audioStream.addTrack(track));
			//event.streams[0].getVideoTracks().forEach(track => videoStream.addTrack(track));
			// for some reason you have to stream peer connections to an audio element before you can do anything else to it


			if (videoStream.getTracks().length > 0) {
				let video = document.createElement("video");
				video.srcObject = videoStream;
				video.play();


				Object.assign(this, {
					videoStream,
					video
				});
			}

			if (audioStream.getTracks().length > 0) {
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
					destination = audioContext.createMediaStreamDestination(),
					audio = new Audio;

				gain.gain.value = client.settings.gain;

				source.connect(gain);
				gain.connect(destination);

				audio.srcObject = destination.stream;
				//audio.src = URL.createObjectURL(destination.stream)
				audio.play();
				/* // the communications device only exists on windows
				if (audio.setSinkId && client.settings.outputId) // TODO: better support check
					audio.setSinkId(client.settings.outputId);
				*/

				Object.assign(this, {
					audioStream,
					source,
					gain,
					audioContext,
					destination,
					audio
				});
			}


		};

		connection.oniceconnectionstatechange = e => console.log("ICE Connection state:" + connection.iceConnectionState);

		this.connection = connection;
		this.client = client;
		/**
		 * @property {Array<RTCDataChannel>}
		 */
		this.channels = {};
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
	 * @param {MediaStream} audio
	 * @param {MediaStream} video
	 */
	setInputStream(audio, video) {
		// TODO: Remove any previous input streams
		// Add new input stream

		let stream = new MediaStream([...(audio ? audio.getAudioTracks() : []), ...(video ? video.getVideoTracks() : [])]);

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

		this.log = options.log;
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
		this.input = {
			audio: new Audio,
			video: document.createElement("video"),
		};
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
			this.log(`Connected to ${this.ip}`);
			if (this.room) {
				this.log(`Rejoining ${this.room.roomId}`);
				this.joinRoom();
			}
		});
		this.on("peerConnect", async ({ id }) => {
			this.log(`Peer ${id} has joined the room. Sending a peer to peer connection request to the new peer.`);
			let peer = this.createPeer(id);
			await peer.setupRequest();
			this.emit("request", { id, description: peer.localDescription });
		});
		this.on("request", async ({ id, description }) => {
			this.log(`Incoming connection request from ${id}`, description);
			let peer = this.createPeer(id);
			await peer.answerRequest(description);
			this.emit("answer", { id, description: peer.localDescription });
			this.emit("status", this.settings);
		});

		// From New Peer to existing Peers
		this.on("answer", ({ id, description }) => {
			this.log(`Connection request to ${id} has been answered:`, description);
			this.peers[id].setRemoteDescription(description);
			this.emit("status", this.settings);
		});

		this.on("candidate", ({ id, candidate }) => {
			this.peers[id].addIceCandidate(candidate);
		});

		this.on("peerDisconnect", id => {
			if (this.peers[id]) {
				this.log(`Peer ${id} has left the room`);
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
		peer.setInputStream(this.input.audio.srcObject, this.input.video.srcObject);
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

	async setMicrophone(deviceId) {
		//this.settings.inputId = deviceId;
		// Media Constraints
		const CONSTRAINTS = { audio: true };
		let stream = await navigator.mediaDevices
			.getUserMedia(CONSTRAINTS);
		this.log("Connected to Microphone", stream);

		let audioContext = new AudioContext,
			micOutput = audioContext.createMediaStreamSource(stream),
			/*micDB = monitorDB(micOutput, audioContext, db => {
				this.input.db = db;
				this.settings.onMicDB(db);
			}),*/
			destination = audioContext.createMediaStreamDestination();

		micOutput.connect(destination);
		this.devices.input = destination.stream;

		//Object.values(this.peers).forEach(peer => peer.setInputStream(stream));*/
		this.input.audio.srcObject = stream;
	}

	async setWebcam() {
		// Media Constraints
		const CONSTRAINTS = { video: { facingMode: "user" } };
		let stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
		this.log("Connected to Webcam");

		this.input.video.srcObject = stream;
	}

	async setScreenshare() {
		const CONSTRAINTS = {
			video: {
				cursor: "always"
			},
			audio: false/*{
			echoCancellation: true,
			noiseSuppression: true,
			sampleRate: 44100
		  }*/};
		let stream = await navigator.mediaDevices.getDisplayMedia(CONSTRAINTS);
		//let video = document.createElement("video");
		//video.srcObject = stream;
		//document.body.appendChild(video)
		this.input.video.srcObject = stream;
	}

	async getDevices(kind = "input") {
		let devices = await navigator.mediaDevices.enumerateDevices();
		return devices.filter(device => device.kind == "audio" + kind);
	}
};

export { AntennaClient };