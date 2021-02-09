"use strict";

const
	START_BTN = document.querySelector("button"),
	ROOM_FORM = document.getElementById("room-form");

let client = new AntennaClient;

client.setupSockets();

START_BTN.addEventListener("click", () => {
	START_BTN.remove();
	client.setMicrophone();
});

ROOM_FORM.querySelector("button").addEventListener("click", () => {
	let roomId = ROOM_FORM.querySelector("input#roomId").value;
	console.log("Joining room", roomId);
	client.joinRoom(roomId);
});

window.onunload = window.onbeforeunload = () => {
	client.close();
};