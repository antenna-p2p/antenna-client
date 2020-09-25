// ==UserScript==
// @name         EchoLocation
// @description  VCs per Room
// @author       Tumble
// @version      0.0.1.2
// @match        https://boxcritters.com/play/
// @match        https://boxcritters.com/play/?*
// @match        https://boxcritters.com/play/#*
// @match        https://boxcritters.com/play/index.html
// @match        https://boxcritters.com/play/index.html?*
// @match        https://boxcritters.com/play/index.html#*
// @run-at       document-start
// @require      https://github.com/SArpnt/joinFunction/raw/master/script.js
// @require      https://github.com/SArpnt/EventHandler/raw/master/script.js
// @require      https://github.com/SArpnt/cardboard/raw/master/script.user.js
// grant none
// ==/UserScript==

cardboard.register("ECHO_LOCATION");

var EchoLocation = {};

cardboard.on("runScripts",function() {
	console.log(io);
	var socket = io("tumble-room-vc.herokuapp.com")

	socket.on("connect",function() {
		console.log("server connnected")

		alert("Please join the voice channel in BCMC called start")

		while(!discord) {
		var discord = prompt("Discord Userame#1234")
		}
		var code = Math.floor(1000 + Math.random() * 9000);


		socket.emit("login",{discord,code})
		//alert("Your code is" + code);

	})

	EchoLocation.socket = socket;
})


cardboard.on("worldSocketCreated",(world,socket)=>{
	
cardboard.on("joinRoom",(r)=>{
	EchoLocation.socket.emit("joinRoom",r.room.roomId)
})

})