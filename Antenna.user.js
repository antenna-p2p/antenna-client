// ==UserScript==
// @name         Antenna
// @description  3D Web based peer to peer voice chat
// @author       TumbleGamer
// @namespace    https://boxcrittersmods.ga/authors/tumblegamer/
// @icon         https://github.com/tumble1999/antenna/raw/master/icon.png
// @supportURL   http://discord.gg/D2ZpRUW
// @version      0.4.2.32
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
// @require      https://github.com/SArpnt/ctrl-panel/raw/master/script.user.js
// @require      https://github.com/tumble1999/modial/raw/master/modial.js
// @require      https://github.com/tumble1999/critterguration/raw/master/critterguration.user.js
// @require      https://github.com/tumble1999/antenna/raw/master/AntennaClient.js
// ==/UserScript==
// @require      file:///E:/dev/boxcritters/mods/antenna/AntennaClient.js

(function () {
	"use strict";
	let Antenna = new TumbleMod({
		abriv: "Ant",
		cardboard: true,
		client: new AntennaClient(),
		testDots: () => {
			Object.values(Antenna.world.stage.children[0].children[0].players).forEach(player => {
				let margin = 3;
				let circleRadius = 4;
				let circle = new createjs.Shape();
				circle.graphics.beginFill("green").drawCircle(0, 20, circleRadius);
				let name = player.nickname;
				let textWidth = name.children[0].getMeasuredWidth();
				name.addChild(circle);
				circle.x = -textWidth / 2 - circleRadius - margin;
			});
		}
	});
	Antenna.client.log = Antenna.log.bind(Antenna);

	if (typeof cardboard !== undefined) {

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
	}
	window.addEventListener("unload", _ => Antenna.client.close());
	window.addEventListener("beforeunload", _ => Antenna.client.close());

	function createLabal(text, idFor) {
		let label = document.createElement("label");
		label.innerText = text;
		label.htmlFor = idFor;
		return label;
	}

	function createSlider(id, value = "", oninput) {
		let input = document.createElement("input");
		input.type = "range";
		input.id = id;
		input.class = "custom-range";
		input.value = value.toString();
		input.oninput = () => oninput(input);
		return input;
	}

	function createProgress(value, max, color = "primary") {
		let progress = document.createElement("div");
		progress.classList.add("progress", "w-100");
		let progressBar = document.createElement("div");
		progressBar.setAttribute("role", "progressbar");
		progressBar.setAttribute("aria-valuemin", 0);
		progressBar.setAttribute("aria-valuemax", max);
		progress.appendChild(progressBar);

		progress.setColor = c => {
			color = c;
			progressBar.classList.value = `progress-bar "bg-${color}`;
		};

		progress.setValue = v => {
			value = v;
			progressBar.setAttribute("aria-valuenow", value);
			progressBar.style.width = Math.round(value / max * 100) + "%";
		};
		progress.setValue(value);
		progress.setColor(color);

		return progress;
	}

	/**
	 * 
	 * @param {AudioParam} audioParam 
	 */
	function createSliderFromAudioParam(id, audioParam) {
		id = "antenna-setting-" + id;
		let slider = createSlider(id, input => {
			let range = audioParam.maxValue - audioParam.maxValue;
			let value = audioParam.minValue + input.value * range;
			audioParam.value = value;
		});
		slider.value = audioParam.value;
		return slider.container;
	}

	function createInputGroup(name) {
		let group = document.createElement("div");
		group.classList.add("input-group", "mb-3", "row");

		let prepend = document.createElement("div");
		prepend.classList.add("input-group-prepend", "col-sm");
		group.appendChild(prepend);
		let title = document.createElement("label");
		title.innerText = name;
		title.classList.add("input-group-text");
		prepend.appendChild(title);
		return group;
	}

	let settingsPage = Critterguration.registerSettingsMenu(Antenna, RegenerateSettings);

	/*let settingsModal = new Modial();
	settingsModal.element.querySelector(".modal-dialog").style["max-width"] = "1000px";
	settingsModal.setContent("Antenna Settings" + Modial.closeButton, "", `Antenna created by <a href="https://boxcrittersmods.ga/authors/tumblegamer/" target="_blank">TumbleGamer</a>`);*/
	let micVisual;
	let speakerVisual;
	async function RegenerateSettings() {
		settingsPage.innerHTML = "";
		let gainSettings = createInputGroup("Volume");
		settingsPage.appendChild(gainSettings);
		let gainSlider = createSlider("gain", Antenna.client.settings.gain, input => {
			console.log("gain changed " + input.value);
			//let value = -3 + (input.value / 100 * 6);
			Antenna.client.setGain(input.value);
		});
		gainSlider.classList.add("col-sm");
		gainSettings.appendChild(gainSlider);

		let inputDevices = await Antenna.client.getDevices("input");
		let outputDevices = await Antenna.client.getDevices("output");
		let devGroup = settingsPage.createInputRow("Devices");
		devGroup.createDropdown("Input Device",
			inputDevices.map(device => ({ value: device.deviceId, text: device.label })),
			value => value == Antenna.client.settings.inputId,
			value => {
				Antenna.client.setMicrophone(value);
			});
		devGroup.createDropdown("Out Device",
			outputDevices.map(device => ({ value: device.deviceId, text: device.label })),
			value => value == Antenna.client.settings.outputId,
			value => {
				Antenna.client.setSpeaker(value);
			});
		let progGroup = settingsPage.createInputRow("Visual");
		micVisual = createProgress(Antenna.client.input.db, 100);
		speakerVisual = createProgress(0, 10);
		progGroup.appendChild(micVisual);
		progGroup.appendChild(speakerVisual);

	}

	function update() {
		if (micVisual) {
			micVisual.setValue(Antenna.client.input.db);
		}
		if (speakerVisual) {

		}
		requestAnimationFrame(update);
	}
	update();

	TumbleMod.onDocumentLoaded()
		.then(() => {
			Antenna.log("Setting up Microphone");
			Antenna.client.setMicrophone();
		});


	window.Antenna = Antenna;
})();