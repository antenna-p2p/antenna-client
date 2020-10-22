var client = new AntennaClient({});

client.setupSockets();
var startBtn = document.querySelector("button");

startBtn.addEventListener("click", () => {
	startBtn.remove();
	client.setMicrophone();
});
var roomForm = document.getElementById("room-form");
roomForm.querySelector("button").addEventListener("click", () => {
	var roomId = roomForm.querySelector("input#roomId").value;
	console.log("Joining room", roomId);
	client.joinRoom(roomId);
});
window.onunload = window.onbeforeunload = () => {
	client.close();
};