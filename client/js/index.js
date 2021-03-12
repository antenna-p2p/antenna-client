import { AntennaClient } from "./AntennaClient.js";
import { createMessage } from "./createMessage.js";
import { getFormData } from "./helpers.js";

const
	ROOM_FORM = document.getElementById("vc-form"),
	GETMIC_BTN = document.getElementById("vc-getMic"),
	ROOMID_INPUT = document.getElementById("vc-roomId"),
	JOINROOM_BTN = document.getElementById("vc-joinRoom");

let client = new AntennaClient;

client.setupSocket();

client.onMessageRecived(createMessage());

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
createMsgForm.addEventListener("submit", function _eventCreateMessage(event) {
	event.preventDefault();
	const FORM_DATA = getFormData(event.target);
	console.log(FORM_DATA);
	createMessage(FORM_DATA.msgContent, FORM_DATA.sandboxType);
});

window.client = client;
window.createMessage = createMessage; // TODO: for testing, delete this later