const
	createMsgForm = document.getElementById("createMsgForm"),
	msgContainer = document.getElementById("msgContainer");

/**
 * create random base64 string
 * @param {number} [len] length of id
 * @param {string[]} [existing] blacklist of ids (to prevent same id multiple times)
 */
function makeId(len = 12, existing) {
	const CHARS = "0123456789qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM-_";
	let id;
	while (!id || existing && existing.includes(id)) {
		id = "";
		for (let i = 0; i < len; i++)
			id += CHARS[Math.floor(Math.random() * CHARS.length)];
	}
	return id;
}

function getFormData(form) {
	let data = {},
		inputs = form.querySelectorAll("[name]:not([type=radio])"),
		radios = form.querySelectorAll("[name][type=radio]");

	for (let elem of inputs)
		data[elem.name] = elem.value;

	for (let elem of radios)
		if (elem.checked)
			data[elem.name] = elem.dataset.value;

	return data;
}

window.addEventListener("message", function getWindowMessage(event) {
	let frame = msgIframes[event.data.id];
	if (frame) {
		console.log(event.data);
		frame.height = event.data.height;
	}
});

let msgIframes = {};

function createMessage(msgText, sandboxType = FORM_DATA.msgContent) { // TODO: edit sandboxType default paramter when frontend is worked on
	let msg = document.createElement("div");
	msg.className = "msg";
	switch (sandboxType) {
		case "none": {
			msg.innerText = msgText;
			msgContainer.append(msg);
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
			msgContainer.append(msg);
			frame.addEventListener("load", function () {
				frame.contentWindow.postMessage({ id, msg: msgText }, "*");
			});
		} break;
		default:
			throw `Invalid sandbox type "${sandboxType}"`;
	}
}

createMsgForm.addEventListener("submit", function _eventCreateMessage(event) {
	event.preventDefault();
	const FORM_DATA = getFormData(event.target);
	console.log(FORM_DATA);
	createMessage(FORM_DATA.sandboxType);
});

window.createMessage = createMessage; // TODO: for testing, delete this later
export { createMessage };