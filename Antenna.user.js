// ==UserScript==
// @name         Antenna
// @description  3D Web based peer to peer voice chat
// @author       TumbleGamer
// @version      0.0.18.18
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
// @require      file:///E:/dev/boxcritters/mods/antenna/AntennaClient.js
// @require      https://github.com/tumble1999/popper/raw/master/popper.js
// ==/UserScript==
// @require      https://raw.githubusercontent.com/tumble1999/antenna/master/AntennaClient.js

(function () {
	"use strict";
	var Antenna = new TumbleMod({
		abriv: "Ant",
		cardboard: true,
		client: new AntennaClient(),
		testDots: () => {
			Object.values(Antenna.world.stage.children[0].children[0].players).forEach(player => {
				var margin = 3;
				var circleRadius = 6;
				var circle = new createjs.Shape();
				circle.graphics.beginFill("green").drawCircle(0, 20, circleRadius);
				var name = player.nickname;
				var textWidth = name.children[0].getMeasuredWidth();
				name.addChild(circle);
				circle.x = -textWidth / 2 - circleRadius - margin;
			});
		},
		createDot
	});
	Antenna.client.log = Antenna.log.bind(Antenna);

	function createDot(id) {
		var players = Antenna.world.stage.children[0].children[0].players;
		var player = players[id];
		var margin = 3;
		var circleRadius = 6;
		var circle = new createjs.Shape();
		var circleGraphics = circle.graphics;
		var colorCommand = circleGraphics.beginFill("green").command;
		circleGraphics.drawCircle(0, 20, circleRadius);
		var name = player.nickname;
		var textWidth = name.children[0].getMeasuredWidth();
		name.addChild(circle);
		circle.x = -textWidth / 2 - circleRadius - margin;
		return {
			shape: circle,
			setColor: (color) => {
				colorCommand.style = color;
			}
		};
	}

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
			Antenna.client.joinRoom(r);
			//setTimeout((Antenna.testDots),0)

		});
		socket.on("X", info => {
			//Antenna.log("Change Position:", info);
			Antenna.client.setPosition(info);
		});
	});

	cardboard.on("login", () => {
		if (!Antenna.world) return;
		let id = Antenna.world.player.playerId;
		Antenna.log("Logged in as " + id);
		Antenna.client.login(Antenna.world, id);
	});
	window.addEventListener("unload", _ => Antenna.client.close());
	window.addEventListener("beforeunload", _ => Antenna.client.close());
	{
		var settingsModel = new Popper();
		settingsModel.setContent("Antenna Settings" + Popper.closeButton, "", `Antenna created by <a href="https://boxcrittersmods.ga/authors/tumblegamer/" target="_blank">TumbleGamer</a>`);
		var body = settingsModel.getBodyNode();
		var gainSlider = createSlider("gain", "Gain");
		gainSlider.input.addEventListener("input", () => {
			console.log("gain changed " + gainSlider.input.value);
			var value = -3 + (gainSlider.input.value * 6);
			Antenna.client.setGain(value);
		});
		gainSlider.input.value = 200 / 3;
		body.appendChild(gainSlider.container);
	}

	function createSlider(id, title) {
		var container = document.createElement("div");
		var label = document.createElement("label");
		container.appendChild(label);
		label.innerText = title;
		var input = document.createElement("input");
		container.appendChild(input);
		input.type = "range";
		input.id = id;
		input.class = "custom-range";
		return { container, input };
	}

	/**
	 * 
	 * @param {AudioParam} audioParam 
	 */
	function createSliderFromAudioParam(id, title, audioParam) {
		id = "antenna-setting-" + id;
		var slider = createSlider(id, title);
		slider.input.addEventListener("input", () => {
			var range = audioParam.maxValue - audioParam.maxValue;
			var value = audioParam.minValue + slider.input.value * range;
			audioParam.value = value;
		});
		slider.input.value = audioParam.value;
		return slider.container;
	}
	function DisplaySettings() {
		settingsModel.show();
	}

	TumbleMod.onDocumentLoaded()
		.then(() => {
			Antenna.log("Setting up Microphone");
			Antenna.client.setupMic();
		});

	if (typeof BCMacros !== "undefined") {
		var macroPack = BCMacros.createMacroPack("Antenna");
		Antenna.settingsMacro = macroPack.createMacro({
			name: "Antenna",
			action: () => { DisplaySettings(); },
			button: { text: "Antenna" }
		});
	}



	window.Antenna = Antenna;
})();