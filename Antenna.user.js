// ==UserScript==
// @name         Antenna
// @description  VCs per Room
// @author       Tumble
// @version      0.0.7.7
// @match        https://boxcritters.com/play/
// @match        https://boxcritters.com/play/?*
// @match        https://boxcritters.com/play/#*
// @match        https://boxcritters.com/play/index.html
// @match        https://boxcritters.com/play/index.html?*
// @match        https://boxcritters.com/play/index.html#*
// @run-at       document-start
// @require      https://github.com/SArpnt/joinFunction/raw/master/script.js
// @require      https://github.com/SArpnt/EventHandler/raw/master/script.js
// @require      https://github.com/SArpnt/cardboard/raw/master/script.user.js
// @require      https://github.com/tumble1999/mod-utils/raw/master/mod-utils.js

// ==/UserScript==


var Antenna = new TumbleMod({
	name:"Antenna",
	abriv:"Ant",
	author:"TumbleGamer",
	delay: 100,
	emit: function (...p) {
		this.socket.emit(...p)
	},
	on: function (...p) {
		this.socket.on(...p)
	},
	login: function () {
		if (!this.world) return;
		let id = this.world.player.playerId;
		Antenna.log("Logging in as", id)
		this.emit("login", id)
	}
})
Antenna.register();

var macroPack = BCMacros.CreateMacroPack("Antenna")
macroPack.createMacro({
	name:"Mute",
	action:() =>{

	},
	key:"m"
})

async function playBuffer(arrayBuffer) {
	var audioContext = new AudioContext();
	//var arrayBuffer = await blob.arrayBuffer();
	var audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
	var bufferSource = audioContext.createBufferSource();
	bufferSource.buffer = audioBuffer;
	bufferSource.connect(audioContext.destination);
	bufferSource.start();
}

function setupStream(mediaStream) {
	var mediaRecorder = new MediaRecorder(mediaStream);
	mediaRecorder.onstart = function (e) {
		this.chunks = [];
	};
	mediaRecorder.ondataavailable = function (e) {
		this.chunks.push(e.data);
	};
	mediaRecorder.onstop = function (e) {
		var blob = new Blob(this.chunks, { 'type': 'audio/ogg; codecs=opus' });
		Antenna.log(blob);
		Antenna.emit('voice', blob);

		
		Antenna.mediaRecorder.start();
		setTimeout(()=>{
			Antenna.mediaRecorder.stop()
		},500)
	};
	mediaRecorder.start();
	setTimeout(()=>{
		Antenna.mediaRecorder.stop()
	},Antenna.delay)
	Antenna.mediaRecorder = mediaRecorder;
}

function setupMicrophone() {
	Antenna.log("setting up mic");
	navigator.getUserMedia({ audio: true }, setupStream, Antenna.log);
}

setupMicrophone();


cardboard.on("runScripts", function () {
	if (io) Antenna.log("Socket.io's 'io' variable has been found.");
	var url = "tumble-room-vc.herokuapp.com"
	//var url = "ws://localhost:3000"
	Antenna.socket = io(url)

	Antenna.on("connect", function () {
		Antenna.log("Connected to", url)
	})
	Antenna.on("voice",function({bcid,arrayBuffer})  {
		playBuffer(arrayBuffer);
	})
})
cardboard.on("worldCreated", (world) => {
	Antenna.log("World Created")
	Antenna.world = world;
})
cardboard.on("worldSocketCreated", (world, socket) => {
	socket.on("joinRoom", (r) => {
		Antenna.log("Joined Room: " + r.roomId)
		Antenna.emit("joinRoom", r.roomId)
	})
})
cardboard.on("login", Antenna.login)

unsafeWindow.Antenna = Antenna;
