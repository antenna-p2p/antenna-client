// ==UserScript==
// @name         EchoLocation
// @description  VCs per Room
// @author       Tumble
// @version      0.0.2.3
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
// ==/UserScript==

cardboard.register("ECHO_LOCATION");
console.log("[Echo Location] By TumbleGamer")
console.log = (...p) => {
	p.unshift("[EL]");
	console.debug(...p)
};

var macroPack = BCMacros.CreateMacroPack("Echo Location")
macroPack.createMacro({
	name:"Mute",
	action:() =>{

	},
	key:"m"
})

var EchoLocation = {
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
		console.log("Logging in as", id)
		this.emit("login", id)
	}
};

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
		console.log(blob);
		EchoLocation.emit('voice', blob);

		
		EchoLocation.mediaRecorder.start();
		setTimeout(()=>{
			EchoLocation.mediaRecorder.stop()
		},500)
	};
	mediaRecorder.start();
	setTimeout(()=>{
		EchoLocation.mediaRecorder.stop()
	},EchoLocation.delay)
	EchoLocation.mediaRecorder = mediaRecorder;
}

function setupMicrophone() {
	console.log("setting up mic");
	navigator.getUserMedia({ audio: true }, setupStream, console.log);
}

setupMicrophone();



cardboard.on("runScripts", function () {
	if (io) console.log("Socket.io's 'io' variable has been found.");
	var url = "tumble-room-vc.herokuapp.com"
	//var url = "ws://localhost:3000"
	EchoLocation.socket = io(url)

	EchoLocation.on("connect", function () {
		console.log("Connected to", url)
	})
	EchoLocation.on("voice",function({bcid,arrayBuffer})  {
		playBuffer(arrayBuffer);
	})
})
cardboard.on("worldCreated", (world) => {
	console.log("World Created")
	EchoLocation.world = world;
})
cardboard.on("worldSocketCreated", (world, socket) => {
	socket.on("joinRoom", (r) => {
		console.log("Joined Room: " + r.roomId)
		EchoLocation.emit("joinRoom", r.roomId)
	})
})
cardboard.on("login", EchoLocation.login)

unsafeWindow.EchoLocation = EchoLocation;