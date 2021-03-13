import { AntennaClient } from "./AntennaClient.js";
import { displayMessage } from "./displayMessage.js";
import { getFormData } from "./helpers.js";

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

const createMsgForm = document.getElementById("createMsgForm");
createMsgForm.addEventListener("submit", function _eventSendMessage(event) {
	event.preventDefault();
	const FORM_DATA = getFormData(event.target);
	sendTextMessage(FORM_DATA.msgContent);
	displayMessage(FORM_DATA.msgContent, FORM_DATA.sandboxType);
});

// TODO: these functions aren't designed well, client should have multiple data channels each for different purpouses and different functions for each
function sendTextMessage(text) {
	client.sendMessage(text);
}
client.onMessageRecived(function (msg) {
	console.debug(`recieved text message`, msg);
	displayMessage(msg);
});

window.client = client;
window.displayMessage = displayMessage; // TODO: for testing, delete this later