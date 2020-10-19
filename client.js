var client = new AntennaClient({})

client.setupSockets();
var startBtn =  document.querySelector("button")

startBtn.addEventListener("click", () => {
	startBtn.remove();
	client.setupMic();
	client.joinRoom("test");
})
window.onunload = window.onbeforeunload = () => {
	client.close();
};