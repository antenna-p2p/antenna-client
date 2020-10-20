var webServer = require("tn-webserver");
var socketIo = require("socket.io");

function createBinder(instance) {
	return (function (a, ...p) {
		return this[a].bind(this, ...p);
	}).bind(instance);
}


var server = webServer(_ => { }, {}, 3001);
var io = socketIo(server);
io.on("connect", socket => {
	new Client(socket);
});

class Client {
	constructor(socket) {
		this.bind = createBinder(this);
		this.socket = socket;

		this.emit("connect");
		this.bindSocket("disconnect");
		this.bindSocket("login");
		this.bindSocket("joinRoom");
		this.bindSocket("request");
		this.bindSocket("answer");
		this.bindSocket("candidate");
		console.debug("Client Connected:", this.id);
	}

	get id() {
		return this.socket.id;
	}
	bindSocket(name) {
		var t = this;
		this.socket.on(name, (...p) => {
			console.log(t.id, name, ...p);
			this.bind(name)(...p);
		});
	}
	login(bcid) {
		this.bcid = bcid;
	}
	join(room) {
		if (this.room) {
			console.log(this.id + " is leaving room " + this.room);
			this.socket.leave(this.room);
		}
		this.room = room || "test";
		console.log(this.id + " is joining room " + this.room);
		this.socket.join(this.room);
	}
	emit(...a) {
		this.socket.emit(...a);
	}

	peerEmit(peer, ...a) {
		this.socket.to(peer).emit(...a);
	}

	roomEmit(...a) {
		this.peerEmit(this.room, ...a);
	}

	disconnect() {
		console.debug("Client Disconnected:", this.id);
		this.roomEmit("peerDisconnect", this.id);
	}
	joinRoom(room) {
		if (this.room) this.roomEmit("peerDisconnect", this.id);
		this.join(room);
		this.roomEmit("peerConnect", {id:this.id,bcid:this.bcid});
	}

	status(status) {
		this.roomEmit("status",{id:this.id,status})
	}

	request({ id, description }) {
		this.peerEmit(id, "request", { id: this.id, bcid: this.bcid, description });
	}

	answer({ id, description }) {
		this.peerEmit(id, "answer", { id: this.id, description });
	}

	candidate({ id, candidate }) {
		this.peerEmit(id, "candidate", { id: this.id, candidate });
	}
}