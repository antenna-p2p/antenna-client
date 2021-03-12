/**
 * create random base64 string
 * @param {number} [len] length of id
 * @param {string[]} [existing] blacklist of ids (to prevent same id multiple times)
 * @returns {string}
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

/**
 * Get settings from a form and convert to an Object
 * @param {HTMLFormElement} form
 * @returns {Object} form data
 */
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

export { makeId, getFormData };