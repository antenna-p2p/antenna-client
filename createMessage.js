const
	createMsgForm = document.getElementById('createMsgForm'),
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
		inputs = createMsgForm.querySelectorAll('[name]:not([type=radio])'),
		radios = createMsgForm.querySelectorAll('[name][type=radio]');

	for (let elem of inputs)
		data[elem.name] = elem.value;

	for (let elem of radios)
		if (elem.checked)
			data[elem.name] = elem.dataset.value;

	return data;
}

window.addEventListener('message', function getWindowMessage(event) {
	let frame = msgIframes[event.data.id];
	if (frame) {
		console.log(event.data);
		frame.height = event.data.height;
	}
});

let msgIframes = {};

createMsgForm.addEventListener("submit", function createMessage(event) {
	event.preventDefault();

	const FORM_DATA = getFormData(event.target);
	console.log(FORM_DATA);

	let msg = document.createElement('div');
	msg.className = 'msg';
	if (FORM_DATA.sandboxType == "none") {
		msg.innerText = FORM_DATA.msgContent;
		msgContainer.append(msg);
	} else if (FORM_DATA.sandboxType == "noStyle")
		throw "unsupported";
	else if (FORM_DATA.sandboxType == "inlineStyle")
		throw "unsupported";
	else if (FORM_DATA.sandboxType == "allStyle") {
		throw "unsupported";
	} else if (FORM_DATA.sandboxType == "all") {
		let frame = document.createElement('iframe');
		frame.className = 'msg-frame';
		frame.height = 0;
		frame.sandbox = "allow-scripts allow-forms";
		frame.src = "messageInject.html";
		let id = makeId(undefined, Object.keys(msgIframes));
		msgIframes[id] = frame;

		msg.append(frame);
		msgContainer.append(msg);
		frame.addEventListener('load', function () {
			frame.contentWindow.postMessage({ id, msg: FORM_DATA.msgContent }, '*');
		});
	} else
		throw `Invalid sandbox type '${FORM_DATA.sandboxType}'`;
});