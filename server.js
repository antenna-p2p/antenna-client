var webServer = require("tn-webserver")
var socketIo = require("socket.io")

function createBinder(instance) {
	return (function(a,...p){
		return this[a].bind(this,...p);
	}).bind(instance);
}


var server = webServer(_=>{},{},3001)
var io = socketIo(server);
io.on("connect",socket=>{
	new Client(socket)
})

class Client {
	constructor(socket) {
		this.bind = createBinder(this);
		this.socket = socket;

		this.emit("connect");
		this.bindSocket("disconnect")
		this.bindSocket("joinRoom")
		this.bindSocket("offer")
		this.bindSocket("answer")
		this.bindSocket("candidate")
		console.debug("Client Connected:", this.id);
	}
	
	get id() {
		return this.socket.id;
	}
	bindSocket(name) {
		var t = this;
		this.socket.on(name,(...p)=>{
			console.log(t.id,name,...p)
			this.bind(name)(...p)
		});
	}
	join(room) {
		if(this.room) {
			console.log(this.id + " is leaving room " + this.room)
			this.socket.leave(this.room)
		}
		this.room = room||"test";
		console.log(this.id + " is joining room " + this.room)
		this.socket.join(this.room)
	}
	emit(...a) {
		this.socket.emit(...a);
	}

	peerEmit(peer,...a) {
		this.socket.to(peer).emit(...a);
	}

	roomEmit(...a) {
		this.peerEmit(this.room,...a);
	}

	disconnect() {
		console.debug("Client Disconnected:",this.id);
		this.roomEmit("peerDisconnect",this.id);
	}
	joinRoom({room,bcid}) {
		if(this.room) this.roomEmit("peerDisconnect",this.id);
		console.log("ddsfs")
		this.join(room);
		this.roomEmit("peerConnect",{id:this.id,bcid});
	}

	offer({id, message}) {
		this.peerEmit(id,"offer", {id:this.id, message})
	}

	answer({id, message}) {
		this.peerEmit(id,"answer", {id:this.id, message})
	}

	candidate({id, message}) {
		this.peerEmit(id,"candidate", {id:this.id, message})
	}
}