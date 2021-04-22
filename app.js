//const app = require('express')();
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const static = require('node-static');
const port = process.env.PORT || 3000;


class RoomController{
  var players = [];
  var playerScore = new Object();
  var currentThingToGuess = "";
  var amountOfPlayers = 1;
  var gameHasStarted = false;
  var currentPlayerTurn = 0;
  var wordList = [];
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
      roomDict[roomName] = new RoomController();
      success = true;
    }else{
      if (roomDict[roomName].amountOfPlayers != maxPlayers){
        roomDict[roomName].amountOfPlayers += 1;
        success = true;
      }else{
        //implement room full
      }
    }

    if (success){
      console.log(roomName + " " + roomDict[roomName]);
      socket.join(roomName);
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

    roomDict[roomName].amountOfPlayers -= 1;

    if (roomDict[roomName].amountOfPlayers == 0){
      //delete or reset
      delete roomDict[roomName];
    }

    console.log("Remaining rooms: " + roomDict);

    /*for (const [key, value] of Object.entries(socket.rooms)) {
      console.log(value);
    }*/

  });

  socket.on('chat message', (data) => {
    console.log('message: ' + data.msg);
    io.to(data.room).emit('chat message', data.msg);
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
