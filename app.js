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

      var data = {'id':socket.id,'playerCount':roomDict[roomName].amountOfPlayers,'maxPlayers':maxPlayers};
      io.to(roomName).emit('user joined', data);

      roomDict[roomName].players.push(socket.id);
      roomDict[roomName].playerScore[socket.id] = 0;
    }

  });

  socket.on('disconnect', () => {
      console.log(roomDict);
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
      else{
        var data = {'id':socket.id,'playerCount':roomDict[roomName].amountOfPlayers,'maxPlayers':maxPlayers, 'gameHasStarted':roomDict[roomName].gameHasStarted};
        io.to(roomName).emit('user left', data);
      }
    }

  });

  socket.on('chat message', (data) => {
    console.log('message: ' + data.msg);
    io.to(data.room).emit('chat message', data.msg);
  });

  socket.on('start', data => {
    var room = data.room;
    if (roomDict[room].amountOfPlayers == maxPlayers && !roomDict[room].gameHasStarted){ //only run when the room is full and not already started
      roomDict[room].gameHasStarted = true;
      io.to(room).emit('onStartSuccess', true);
      startTimer(room);
    }else{
      io.to(socket.id).emit('onStartFail');
    }
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

function changeTurn(roomName){
    if (roomDict[roomName] == undefined || roomDict[roomName] == null) return;
    var currentTurn = roomDict[roomName].currentPlayerTurn;
    if (currentTurn != maxPlayers-1){
        currentTurn++;
    }else{
        currentTurn = 0;
    }
    roomDict[roomName].currentPlayerTurn = currentTurn;

    io.to(roomName).emit('onNewTurn', roomDict[roomName].players[currentTurn]);
}

function startTimer(room){
    if (roomDict[room] == undefined || roomDict[room] == null) return;
    var countdown = 10;
    var interval = setInterval(function() {
        if (roomDict[room] == undefined || roomDict[room] == null) clearInterval(interval); return;
        countdown--;
        io.to(room).emit('timer', { countdown: countdown });
        if (countdown == 0){
            clearInterval(interval);
            changeTurn(room);
            startTimer(room);
            //Emit 'nextTurn' and let server handle the upcoming users' turn
        }
    }, 1000);
}

