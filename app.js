//const app = require('express')();
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const static = require('node-static');
const port = process.env.PORT || 3000;


class RoomController{
  constructor(players, playerScore, currentThingToGuess, amountOfPlayers, gameHasStarted, currentPlayerTurn, wordList){

    this.players = players;
    this.playerScore = playerScore;
    this.currentThingToGuess = currentThingToGuess;
    this.amountOfPlayers = amountOfPlayers;
    this.gameHasStarted = gameHasStarted;
    this.currentPlayerTurn = currentPlayerTurn;
    this.wordList = wordList;

    /*this.players = new Array();
    this.playerScore = new Object();
    this.currentThingToGuess = "";
    this.amountOfPlayers = 1;
    this.gameHasStarted = false;
    this.currentPlayerTurn = 0;
    this.wordList = new Array();*/
  }
}

var roomDict = new Object();
var maxPlayers = 2;

app.use(express.static(__dirname + '/assets'));

app.get('/', (req, res) => {
  //req.addListener('end', function (){fileServer.serve(request, response);})
  res.sendFile(__dirname + '/index.html');
});

app.get('/game.html', (req, res) => {
  res.sendFile(__dirname + '/game.html');
});

io.on('connection', (socket) => {

  console.log('a user connected');

  //joining room
  socket.on('join', roomName => {

    var success = false;

    if(roomDict[roomName] == null){
      roomDict[roomName] = new RoomController(new Array(), new Object(), "", 1, false, 0, new Array());
      success = true;
    }else{
      if (roomDict[roomName].amountOfPlayers != maxPlayers){
        roomDict[roomName].amountOfPlayers += 1;
        success = true;
      }else{
        io.to(socket.id).emit('full', true);
      }
    }

    if (success){
      console.log(roomName + " " + roomDict[roomName]);
      socket.join(roomName);

      io.to(socket.id).emit('onJoinSuccess', true);

      socket.to(roomName).emit('user joined', socket.id);
    }

  });

  socket.on('disconnect', () => {

  });

  socket.on('disconnecting', function(){
    console.log("disconnecting...");
    console.log(socket.rooms); // the Set contains at least the socket ID
    console.log("socket id: " + socket.id);
    const iterator = socket.rooms.values();
    iterator.next();

    var roomName = iterator.next().value;
    console.log("room: " + roomName);

    if (roomDict[roomName] != undefined && roomDict[roomName] != null){
      roomDict[roomName].amountOfPlayers -= 1;
      if (roomDict[roomName].amountOfPlayers == 0)delete roomDict[roomName];
    }

  });

  socket.on('chat message', (data) => {
    console.log('message: ' + data.msg);
    io.to(data.room).emit('chat message', data.msg);
  });

  socket.on('start', data => {
    var room = data.room;
    var countdown = 10;
    var interval = setInterval(function() {
      countdown--;
      io.to(room).emit('timer', { countdown: countdown });
      if (countdown == 0){
        clearInterval(interval);
        //Emit 'nextTurn' and let server handle the upcoming users' turn
      }
    }, 1000);
  });

  socket.on('mousemove', data => {
    var room = data.room;
    io.to(room).emit('moving',data);
    //io.emit('moving', data);
  });

});

http.listen(port, () => {
  console.log(`Socket.IO server running at http://localhost:${port}/`);
});

io.sockets.on('connection', function (socket) {
  socket.on('reset', function (data) {
    countdown = 1000;
    io.sockets.emit('timer', { countdown: countdown });
  });
});