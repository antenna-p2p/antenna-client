// ==UserScript==
// @name         Antenna
// @description  3D Web based peer to peer voice chat
// @author       TumbleGamer
// @version      0.2.0.26
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
// @require      https://github.com/tumble1999/modial/raw/master/modial.js
// @require      https://github.com/tumble1999/critterguration/raw/master/critterguration.user.js
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

	function createSlider(id, value, oninput) {
		let input = document.createElement("input");
		input.type = "range";
		input.id = id;
		input.class = "custom-range";
		input.value = value;
		input.oninput = () => oninput(input);
		return input;
	}

	function createDropdown(id, options, selected, onchange) {

		let input = document.createElement("select");
		input.id = id;
		input.classList.add("custom-select");
		for (let option of options) {
			let optionElement = document.createElement("option");
			optionElement.value = option.value;
			optionElement.innerText = option.text;
			optionElement.style.whiteSpace = "none";
			if (selected(option)) optionElement.selected = true;
			input.appendChild(optionElement);
		}
		input.onchange = () => onchange(input, input.selectedOptions);
		return input;
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
	async function RegenerateSettings() {
		settingsPage.innerHTML = "";
		let gainSettings = createInputGroup("Gain");
		settingsPage.appendChild(gainSettings);
		let gainSlider = createSlider("gain", Antenna.client.gain, input => {
			console.log("gain changed " + input.value);
			//let value = -3 + (input.value / 100 * 6);
			Antenna.client.setGain(input.value);
		});
		gainSlider.classList.add("col-sm");
		gainSettings.appendChild(gainSlider);


		let deviceSettings = createInputGroup("Devices");
		settingsPage.appendChild(deviceSettings);

		let inputDevices = await Antenna.client.getDevices("input");
		let inputDeviceSelector = createDropdown("select-input",
			inputDevices.map(device => ({ value: device.deviceId, text: device.label })),
			option => option.value == Antenna.client.settings.inputId,
			(input, selected) => {
				let option = selected[0];
				Antenna.client.setMicrophone(option.value);
			}
		);
		inputDeviceSelector.classList.add("col-sm");
		deviceSettings.appendChild(inputDeviceSelector);

		let outputDevices = await Antenna.client.getDevices("output");
		let outputDeviceSelector = createDropdown("select-output",
			outputDevices.map(device => ({ value: device.deviceId, text: device.label })),
			option => option.value == Antenna.client.settings.inputId,
			(input, selected) => {
				let option = selected[0];
				//Antenna.client.setMicrophone(option.value);
			}
		);

		outputDeviceSelector.classList.add("col-sm");
		deviceSettings.appendChild(outputDeviceSelector);
	}

	/*function DisplaySettings() {
		settingsModal.show();
		RegenerateSettings();
	}*/

	TumbleMod.onDocumentLoaded()
		.then(() => {
			Antenna.log("Setting up Microphone");
			Antenna.client.setMicrophone();
		});

	/*if (typeof BCMacros !== "undefined") {
		let macroPack = BCMacros.createMacroPack("Antenna");
		Antenna.settingsMacro = macroPack.createMacro({
			name: "Antenna",
			action: () => { DisplaySettings(); },
			button: { text: "Antenna" }
		});
	}*/



	window.Antenna = Antenna;
})();