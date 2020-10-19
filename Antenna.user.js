// ==UserScript==
// @name         Antenna
// @description  3D Web based peer to peer voice chat
// @author       TumbleGamer
// @version      0.0.15.15
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
// @require      https://raw.githubusercontent.com/tumble1999/antenna/master/AntennaClient.js
// ==/UserScript==

(function () {
	"use strict";
	var Antenna = new TumbleMod({
		abriv: "Ant",
		cardboard: true,
		client: new AntennaClient()
	});
	Antenna.client.log = Antenna.log.bind(Antenna);

	cardboard.on("runScripts", function () {
		if (io) Antenna.log("Socket.io's 'io' variable has been found");
		Antenna.client.setupSockets();

	});
	cardboard.on("worldCreated", world => {
		Antenna.log("World created");
		Antenna.world = world;
	});

	cardboard.on("worldSocketCreated", (world, socket) => {
		socket.on("joinRoom", r => {
			Antenna.log("Joined Room: " + r.roomId);
			Antenna.client.joinRoom(r.roomId);
		});
		socket.on("X", info => {
			Antenna.log("Change Position:", info);
			Antenna.client.setPosition(info);
		});
	});

	cardboard.on("login", () => {
		if (!Antenna.world) return;
		let id = Antenna.world.player.playerId;
		Antenna.client.login(Antenna.world, id);
	});
	window.addEventListener("unload", Antenna.client.close);
	window.addEventListener("beforeunload", Antenna.client.close);

	TumbleMod.onDocumentLoaded()
		.then(() => {
			Antenna.log("Setting up Microphone");
			Antenna.client.setupMic();
		});

	window.Antenna = Antenna;
})();