import { AntennaClient } from "./AntennaClient.js";

const
	ROOM_FORM = document.getElementById("vc-form"),
	GETMIC_BTN = document.getElementById("vc-getMic"),
	ROOMID_INPUT = document.getElementById("vc-roomId"),
	JOINROOM_BTN = document.getElementById("vc-joinRoom");

let client = new AntennaClient;

client.setupSocket();

GETMIC_BTN.addEventListener("click", () => {
	GETMIC_BTN.disabled = true;
	client.setMicrophone();
});
JOINROOM_BTN.addEventListener("click", () => {
	let roomId = ROOMID_INPUT.value;
	console.log("Joining room", roomId);
	client.joinRoom(roomId);
});

window.onunload = window.onbeforeunload = () => {
	client.close();
};

window.client = client;