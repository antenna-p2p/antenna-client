import { makeId, getFormData } from "./helpers.js";

const
	MSG_CONTAINER = document.getElementById("msgContainer"),
	MSG_DISPLAY_FORM = document.getElementById("msgDisplay-form");

window.addEventListener("message", function getWindowMessage(event) {
	let frame = msgIframes[event.data.id];
	if (frame) {
		console.log(event.data);
		frame.height = event.data.height;
	}
});

let msgIframes = {};

function displayMessage(msgText, sandboxType = getFormData(MSG_DISPLAY_FORM).sandboxType) { // TODO: edit sandboxType default paramter when frontend is worked on, remove getFormData if it's no longer needed
	let msg = document.createElement("div");
	msg.className = "msg";
	switch (sandboxType) {
		case "none": {
			msg.innerText = msgText;
			MSG_CONTAINER.append(msg);
		} break;
		case "noStyle":
		case "inlineStyle":
		case "allStyle":
			throw `Unfinished sandbox type "${sandboxType}"`;
		case "all": {
			let frame = document.createElement("iframe");
			frame.className = "msg-frame";
			frame.height = 0;
			frame.sandbox = "allow-scripts allow-forms";
			frame.src = "messageInject.html";
			let id = makeId(undefined, Object.keys(msgIframes));
			msgIframes[id] = frame;

			msg.append(frame);
			MSG_CONTAINER.append(msg);
			frame.addEventListener("load", function () {
				frame.contentWindow.postMessage({ id, msg: msgText }, "*");
			});
		} break;
		default:
			throw `Invalid sandbox type "${sandboxType}"`;
	}
}

export { displayMessage };