const webServer = require("tn-webserver");
const socketIo = require("socket.io");


function createBinder(instance) {
	return (function(a,...p){
		return this[a].bind(this,...p);
	}).bind(instance);
}


class Client {
	constructor(game,socket) {
		this.bind = createBinder(this);
		this.socket = socket;
		this.game = game;
		this.name = this.getID();

		this.emit("connect");
		this.bindSocket("disconnect")
		this.bindSocket("login")
		this.bindSocket("joinRoom")
		this.bindSocket("voice")
		console.debug("Client Connected:", this.name);
	}
	getID() {
		return this.socket.id;
	}
	emit(...a) {
		this.socket.emit(...a);
	}

	roomEmit(...a) {
		this.socket.to(this.room).emit(...a);
	}

	disconnect() {
		console.debug("Client Disconnected:",this.name);(this)
	}
	bindSocket(name) {
		var t = this;
		this.socket.on(name,(...p)=>{
			console.log(t.getID(),name,...p)
			this.bind(name)(...p)
		});
	}

	login(bcid) {
		console.debug("Client " + this.getID() + " has loogged in with Box Critters Id of " + bcid)
		this.bcid = bcid;
	}

	joinRoom(room) {
		console.debug()
		this.socket.join(room);
		this.room = room;
	}

	move({x,y}) {
		this.x = x;
		this.y = y
	}

	voice(data) {
		var bcid = this.bcid;
		this.roomEmit("voice",{bcid,data});
	}
}

class Server {
	constructor(httpServer) {
		this.name = require('os').hostname();
		this.io = socketIo.listen(httpServer);
		
		this.io.on('connect',this.joinServer.bind(this));
		console.log("Created Server",this.name);
	}

	joinServer(socket) {
		var client = new Client(this,socket);
		console.log(client.getID(),"has joined the server")
	}
}


var server = webServer(function(){},{});
new Server(server)