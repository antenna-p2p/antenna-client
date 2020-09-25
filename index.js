const Discord = require("discord.js");
const webServer = require("tn-webserver");
const socketIo = require("socket.io");
const { Dir } = require("fs");

const token = process.env.DISCORD_TOKEN || require('./config/token.js').token;
const client = new Discord.Client(token);
var server = webServer(function(){},{},19132);

var guildId = "567030108003631104";
var categoryId = "758816018436456469";
var memberId="567032362810998824";

var rooms = {};

var onDM = function(message){}

function createBinder(instance) {
	return (function(a,...p){
		return this[a].bind(this,...p);
	}).bind(instance);
}

/**
 * @returns {Discord.Guild}
 */
function getServer () {
	return client.guilds.cache.get(guildId);
}

function getCategory() {
	var bcmc = getServer();
	return  bcmc.channels.cache.get(categoryId)
}

async function createChannel(name,perms= {allow: ["SPEAK","VIEW_CHANNEL"],deny:["CONNECT"]}) {
	var server = getServer();
	var category = getCategory();

	var channel = await server.channels.create(name,{parent:category,type:"voice",permissionOverwrites: [
		Object.assign({
		  id: memberId
		},perms),{
		   id:client.user.id,
		   allow:["MANAGE_CHANNELS","MOVE_MEMBERS"]
	   }
	 ]});
	return channel;
}

async function setupCategory() {
	var category = getCategory()
	category.children.forEach(async c =>await c.delete() );
	await createChannel("Start",{
		allow:["CONNECT",'VIEW_CHANNEL'],
		deny:["SPEAK"]
	})
}

async function moveRoom(userId,roomName) {
	console.log(userId,roomName)
	var bcmc = getServer();
	var member = bcmc.members.cache.get(userId);
	var voiceChannel;
	if(rooms[roomName]) {
		voiceChannel = bcmc.channels.cache.get(rooms[roomName]);
	} else {
		voiceChannel = await createChannel(roomName);
		rooms[roomName] = voiceChannel.id;
	}
	member.voice.setChannel(voiceChannel, "room change")
}

client.on('ready', async () => {
	client.user.setPresence({ game: { name: 'Room Changes', type: "Watching", }, status: 'online' });
	console.log(`Logged in as ${client.user.tag}!`);
	await setupCategory();

});

client.on("message",function(message) {
	if(message.author.id != client.user.id) {
		return;
	}
	if(message.channel.type=="dm"){
		onDM(message)
	};
})


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
		console.log("Client Connected:", this.name);
	}
	getID() {
		return this.socket.id;
	}
	emit(...a) {
		this.socket.emit(...a);
	}

	disconnect() {
		console.log("Client Disconnected:",this.name);(this)
	}
	bindSocket(name) {
		var t = this;
		this.socket.on(name,(...p)=>{
			console.log(t.getID(),name,...p)
			this.bind(name)(...p)
		});
	}

	login({discord,code}) {
		if(!discord)return;
		var user = client.users.cache.find(u=>u.tag==discord);
		user.send("Thnak you!");
		this.discord = user.id;
	}

	joinRoom(room) {
		console.log("Join room " + room);
		moveRoom(this.discord,room);
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

new Server(server)
client.login(token);