import { AntennaClient } from "./AntennaClient.js";
import { createMessage as displayMessage } from "./createMessage.js";
import { getFormData } from "./helpers.js";

const
	ROOM_FORM = document.getElementById("vc-form"),
	GETMIC_BTN = document.getElementById("vc-getMic"),
	ROOMID_INPUT = document.getElementById("vc-roomId"),
	JOINROOM_BTN = document.getElementById("vc-joinRoom");

let client = new AntennaClient;

client.setupSocket();

client.onMessageRecived(displayMessage());

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
	console.log(FORM_DATA);
	sendTextMessage(FORM_DATA.msgContent)
	displayMessage(FORM_DATA.msgContent, FORM_DATA.sandboxType);
});

// TODO: this functions should be moved
function sendTextMessage(text) {
	client.sendMessage({ type: "textMessage", text });
}
client.onMessageRecived(function (msg) {
	switch (msg.type) {
		case "textMessage":
			displayMessage(msg.text);
		default:
			console.warn(`Invalid server message`, msg);
	}
});

window.client = client;
window.createMessage = displayMessage; // TODO: for testing, delete this later