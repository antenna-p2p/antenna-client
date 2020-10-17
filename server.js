var webServer = require("tn-webserver")
var socketIo = require("socket.io")

let room;

function emitToRoom(socket,room,...p) {
	socket.to(room).emit(...p)
}

var server = webServer(_=>{},{},3001)
var io = socketIo(server);
io.on("connect",socket=>{
	socket.emit("connect");
	console.log("Client Connected: " + socket.id);

	socket.on("disconnect",_=>{
		emitToRoom(socket,room,"peerDisconnect",socket.id);
		console.log("Client Disconnected:",socket.id);
	})

	socket.on("joinRoom",_=>{
		console.log(socket.id,"joinRoom")
		//if(room) emitToRoom(socket,room,"peerDisconnect",socket.id)
		socket.join(room);
		emitToRoom(socket,room,"peerConnect",socket.id);
	})

	socket.on("offer",(id, message)=> {
		console.log(socket.id,"offer",message)
		emitToRoom(socket,id,"offer", socket.id, message)
	});
	socket.on("answer",(id, message)=> {
		console.log(socket.id,"answer",message)
		emitToRoom(socket,id,"answer", socket.id, message)
	});
	socket.on("candidate",(id, message)=> {
		console.log(socket.id,"candidate",message)
		emitToRoom(socket,id,"candidate", socket.id, message)
	});
})