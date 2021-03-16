import { AntennaClient } from "./AntennaClient.js";
import { displayMessage } from "./displayMessage.js";
import { getFormData } from "./helpers.js";

const
	GETMIC_BTN = document.getElementById("vc-getMic"),
	ROOM_FORM = document.getElementById("room-form"),
	JOINROOM_BTN = document.getElementById("room-join"),
	CREATE_MSG_CONTENT = document.getElementById("createMsg-content");

let client = new AntennaClient;

client.setupSocket();

GETMIC_BTN.addEventListener("click", () => {
	GETMIC_BTN.disabled = true;
	client.setMicrophone();
});
JOINROOM_BTN.addEventListener("click", () => {
	const ROOM_SETTINGS = getFormData(ROOM_FORM);
	console.log("Joining room", ROOM_SETTINGS);
	// TODO: setup ip and username selection
	client.joinRoom(ROOM_SETTINGS.roomId);
});

window.onunload = window.onbeforeunload = () => {
	client.close();
};

CREATE_MSG_CONTENT.addEventListener("keypress", function _eventSendMessage(event) {
	if (event.key == "Enter" && !(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
		event.preventDefault();
		const MESSAGE = CREATE_MSG_CONTENT.value;
		CREATE_MSG_CONTENT.value = "";
		sendTextMessage(MESSAGE);
		displayMessage(MESSAGE);
	}
});

// TODO: these functions aren't designed well, client should have multiple data channels each for different purposes and different functions for each
function sendTextMessage(text) {
	client.send("text",text);
}
client.onDataRecived("text",function (msg) {
	console.debug(`recieved text message`, msg);
	displayMessage(msg);
});

window.client = client;