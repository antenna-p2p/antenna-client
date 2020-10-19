// ==UserScript==
// @name         Antenna
// @description  VCs per Room
// @author       Tumble
// @version      0.0.9.9
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
	var mute = true;
	var deaf = false;
	var Antenna = new TumbleMod({
		name: "Antenna",
		abriv: "Ant",
		author: "TumbleGamer",
		delay: 1000,
		emit: function (...p) {
			this.socket.emit(...p);
		},
		on: function (...p) {
			this.socket.on(...p);
		},
		login: function () {
			if (!this.world) return;
			let id = this.world.player.playerId;
			Antenna.log("Logging in as", id);
			this.emit("login", id);
		},
		toggleMute: () => {
			mute ^= true;
			startRecorder();
			if (mute) {
				disableMicrophone();
				delete Antenna.recorder;
			}
			if (Antenna.muteMacro && Antenna.muteMacro.button) {
				var button = Antenna.muteMacro.getButton().querySelector("button");
				button.innerHTML = getMuteText();
				button.classList.replace(...btnClasses) || button.classList.replace(...btnClasses.reverse());
			}
		},
		toggleDeaf: () => {
			deaf ^= true;
			if (Antenna.deafMacro && Antenna.deafMacro.button) {
				var button = Antenna.deafMacro.getButton().querySelector("button");
				button.innerHTML = getDeafText();
				button.classList.replace(...btnClasses) || button.classList.replace(...btnClasses.reverse());
			}
		},
		audioContext: new AudioContext,
		microphone: null,
		recorder: null
	});
	Antenna.register();

	var btnColors = ["secondary", "danger"];
	var btnClasses = btnColors.map(c => "btn-" + c);
	var getMuteText = _ => "🎤";
	var getDeafText = _ => "🎧";

	if (typeof BCMacros !== "undefined") {
		var macroPack = BCMacros.CreateMacroPack("Antenna");
		Antenna.muteMacro = macroPack.createMacro({
			name: "Mute",
			action: Antenna.toggleMute,
			button: { text: getMuteText(), color: btnColors[+mute] }
		});
		Antenna.deafMacro = macroPack.createMacro({
			name: "Deafen",
			action: Antenna.toggleDeaf,
			button: { text: getDeafText(), color: btnColors[+deaf] }
		});
	}
	async function playBlob(blob) {
		if (deaf) return;
		var arrayBuffer = await blob.arrayBuffer();
		playBuffer(arrayBuffer);
	}

	async function playBuffer(arrayBuffer) {
		if (deaf) return;
		//var audioBuffer = await Antenna.audioContext.decodeAudioData(arrayBuffer);
		var bufferSource = Antenna.audioContext.createBufferSource();
		//bufferSource.buffer = audioBuffer;
		bufferSource.buffer = arrayBuffer;
		bufferSource.connect(Antenna.audioContext.destination);
		bufferSource.start();
	}

	/*function update(){
		if(!Antenna.recorder)  return clearInterval(Antenna.updateID)
		if(Antenna.recorder.state=="recording")	Antenna.recorder.requestData()
	}*/

	function startRecorder() {
		if (mute) return;
		if (!Antenna.recorder) return setupMicrophone();
		Antenna.recorder.start(Antenna.delay);
		//Antenna.updateID = setInterval(update, Antenna.delay)
	}


	function disableMicrophone() {
		Antenna.log("Disabling mic");
		if (Antenna.microphone) {
			Antenna.microphone.getAudioTracks()[0].stop();
			delete Antenna.recorder;
		}
	}

	function EnableMicrophone(microphone = Antenna.microphone) {
		if (!Antenna.microphone) Antenna.microphone = microphone;
		var mediaRecorder = new MediaRecorder(microphone);
		mediaRecorder.ondataavailable = function (e) {
			var blob = e.data;
			blob.arrayBuffer().then(Antenna.log.bind(Antenna, "outgoing"));
			//Antenna.log("outgoing",blob.arrayBuffer);
			playBlob(blob);
		};
		mediaRecorder.onwarning = Antenna.log.bind(Antenna, "Warning");
		mediaRecorder.onerror = Antenna.log.bind(Antenna, "Error");
		mediaRecorder.onpause = Antenna.log.bind(Antenna, "Pause");
		mediaRecorder.onresume = Antenna.log.bind(Antenna, "Resume");
		mediaRecorder.onstart = Antenna.log.bind(Antenna, "Start");
		mediaRecorder.onstop = Antenna.log.bind(Antenna, "Stop");

		Antenna.recorder = mediaRecorder;
		startRecorder();
	}

	function setupMicrophone() {
		Antenna.log("setting up mic");
		navigator.getUserMedia({ audio: true }, EnableMicrophone, Antenna.log);
	}


	cardboard.on("runScripts", function () {
		if (io) Antenna.log("Socket.io's 'io' variable has been found.");
		var url = "tumble-room-vc.herokuapp.com";
		//var url = "ws://localhost:3000"
		Antenna.socket = io(url);

		Antenna.on("connect", function () {
			Antenna.log("Connected to", url);
		});
		Antenna.on("voice", function ({ bcid, data }) {
			Antenna.log("incoming", data);
			playBuffer(data);
		});
	});
	cardboard.on("worldCreated", (world) => {
		Antenna.log("World Created");
		Antenna.world = world;
	});
	cardboard.on("worldSocketCreated", (world, socket) => {
		socket.on("joinRoom", (r) => {
			Antenna.log("Joined Room: " + r.roomId);
			Antenna.emit("joinRoom", r.roomId);
		});
	});
	cardboard.on("login", Antenna.login);

	window.Antenna = Antenna;

})();