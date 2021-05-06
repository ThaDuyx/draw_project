//const app = require('express')();
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const static = require('node-static');
const port = process.env.PORT || 3000;

//EOW vi er nået hertil: Vi var igang med gætte systemet. Vi nåede et punkt hvor vi tænkte: er det clienten som skal checke om gættet er korrekt?
// eller er det serveren? Vi testede derefter hvad der ville ske når clienten redigerede i javascriptet. Resultat: Clienten kunne få
// serveren til at crashe ved at lave sine egne emits. Vi skal nu beslutte hvor meget vi skal lave om sådan at clienten ikke kan crashe serveren mere.
//

//EOW!! Næste gang skal vi spørge læreren om at det er nødvendigt at gå ind i så meget security som vi var ved.
//Vil det være nok blot at nævne det til eksamen at man skal passe på med kode på client? Eller skal man rent faktisk
// gå in og imlpementere en mere sikker kode for at få flere point????????



class RoomController{
  constructor(players, playerScore, currentThingToGuess, amountOfPlayers, gameHasStarted, currentPlayerTurn, wordList, currentInterval, gameHasFinished){

    this.players = players;
    this.playerScore = playerScore;
    this.currentThingToGuess = currentThingToGuess;
    this.amountOfPlayers = amountOfPlayers;
    this.gameHasStarted = gameHasStarted;
    this.currentPlayerTurn = currentPlayerTurn;
    this.wordList = wordList;
    this.currentInterval = currentInterval;
    this.gameHasFinished = gameHasFinished;
  }
}

var roomDict = new Object();
var maxPlayers = 3;

var finishPoints = 20; //points required to win the game

var possibleWords = ["Elephant", "Airplane", "Pikachu", "House", "Stickman"];

app.use(express.static(__dirname + '/assets'));

app.get('/', (req, res) => {
  //req.addListener('end', function (){fileServer.serve(request, response);})
  res.sendFile(__dirname + '/index.html');
});

app.get('/game.html', (req, res) => {
  res.sendFile(__dirname + '/game.html');
});

io.on('connection', (socket) => {

  //console.log('a user connected');

  //joining room
  socket.on('join', roomName => {

    var success = false;

    if(roomDict[roomName] == null){
      roomDict[roomName] = new RoomController(new Array(), new Array(), "", 1, false, 0, possibleWords, null,false);
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
      //console.log(roomName + " " + roomDict[roomName]);
      socket.join(roomName);

      io.to(socket.id).emit('onJoinSuccess', true);
      
      roomDict[roomName].players.push(socket.id);
      roomDict[roomName].playerScore.push({'id':socket.id,'score':0});
      
      //getting player number
      var playerNumber = roomDict[roomName].players.indexOf(socket.id) + 1;

      var data = {'id':socket.id,'playerCount':roomDict[roomName].amountOfPlayers,'maxPlayers':maxPlayers, 'playerNumber': playerNumber};
      io.to(roomName).emit('user joined', data);

      var data1 = {'playerScores':roomDict[roomName].playerScore};
      io.to(roomName).emit('updateScore', data1);
    }

  });

  socket.on('disconnect', () => {
      console.log(roomDict);
      //console.log(roomDict["rr"]);
  });

  socket.on('disconnecting', function(){
    //console.log("disconnecting...");
    //console.log(socket.rooms); // the Set contains at least the socket ID
    //console.log("socket id: " + socket.id);
    const iterator = socket.rooms.values();
    iterator.next();

    var roomName = iterator.next().value;
    //console.log("room: " + roomName);

    if (roomDict[roomName] != undefined && roomDict[roomName] != null){
      roomDict[roomName].amountOfPlayers -= 1;
      if (roomDict[roomName].amountOfPlayers == 0)delete roomDict[roomName];
      else{
          //removing from room
          //first removing from player array
          var index = roomDict[roomName].players.indexOf(socket.id);
          if (index > -1) {
              roomDict[roomName].players.splice(index, 1);
          }
          //then removing from score array
          for (var i = 0; i < roomDict[roomName].playerScore.length; i++) {
              var obj = roomDict[roomName].playerScore[i];
              if (socket.id == obj.id){
                  roomDict[roomName].playerScore.splice(i, 1);
                  io.to(roomName).emit('removeScore', socket.id);
              }
          }

          var data = {'id':socket.id,'playerCount':roomDict[roomName].amountOfPlayers,'maxPlayers':maxPlayers, 'gameHasStarted':roomDict[roomName].gameHasStarted};
          io.to(roomName).emit('user left', data);
      }
    }

  });

  socket.on('chat message', (data) => {
    console.log('message: ' + data.msg);
    var msg = data.msg;
    var text = "";
    var currentDrawingPlayer = roomDict[data.room].players[roomDict[data.room].currentPlayerTurn];
      if (msg.includes("/g")) {

          if (socket.id == currentDrawingPlayer){ //current drawing player shouldnt be able to guess
              io.to(socket.id).emit('chat message', "You can't guess when you are the one drawing!");
          }else{
              var guess = msg.substring(3);
              if (roomDict[data.room].currentThingToGuess != null) {
                  if (guess.toLowerCase() == roomDict[data.room].currentThingToGuess.toLowerCase()) { //guessed correct
                      text = socket.id + " Guessed the correct word!: " + guess;
                      text.fontcolor("green");
                      givePoints(socket.id, data.room);
                      changeTurn(data.room);

                  } else { //guessed wrong
                      text = socket.id + " Guessed the following: " + guess;
                      text.fontcolor("red");
                  }

                  io.to(data.room).emit('chat message', text);
                  checkFinishGame(data.room);
              }
          }
      }else{
          text = msg;
          io.to(data.room).emit('chat message', text);
      }

  });

  function givePoints(idOfGuesser, room){
      for (var i = 0; i < roomDict[room].playerScore.length; i++) {
          if (roomDict[room].playerScore[i].id == idOfGuesser){
              roomDict[room].playerScore[i].score += 10;
          }

          var currentDrawingPlayer = roomDict[room].players[roomDict[room].currentPlayerTurn];
          if(roomDict[room].playerScore[i].id == currentDrawingPlayer){
              //the one who was drawing gets half the points to encourage him to draw good
              roomDict[room].playerScore[i].score += 5;
          }

          if (roomDict[room].playerScore[i].score >= finishPoints) roomDict[room].gameHasFinished = true;
      }

      var data = {'playerScores':roomDict[room].playerScore};
      io.to(room).emit('updateScore', data);
  }

  function checkFinishGame(room){
      if (roomDict[room].gameHasFinished){
          var currentMaxPoints = null;
          var currentChosenWinner = null;

          for (var i = 0; i < roomDict[room].playerScore.length; i++) {
              if (currentMaxPoints == null || roomDict[room].playerScore[i].score > currentMaxPoints){
                  currentMaxPoints = roomDict[room].playerScore[i].score;
                  currentChosenWinner = roomDict[room].playerScore[i].id;
              }
          }

          io.to(room).emit('gameFinished', currentChosenWinner);

      }
  }


  socket.on('start', data => {
    var room = data.room;
    if (roomDict[room].amountOfPlayers == maxPlayers && !roomDict[room].gameHasStarted){ //only run when the room is full and not already started
      roomDict[room].gameHasStarted = true;
      io.to(room).emit('onStartSuccess', true);
      changeTurn(room);
      //startTimer(room);
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
  //console.log(`Socket.IO server running at http://localhost:${port}/`);
});

io.sockets.on('connection', function (socket) {
  socket.on('reset', function (data) {
    countdown = 1000;
    io.sockets.emit('timer', { countdown: countdown });
  });
});

function changeTurn(roomName){
    if (roomDict[roomName] == undefined || roomDict[roomName] == null){
        return;
    }
    var currentTurn = roomDict[roomName].currentPlayerTurn;
    if (currentTurn != maxPlayers-1){
        currentTurn++;
    }else{
        currentTurn = 0;
    }
    roomDict[roomName].currentPlayerTurn = currentTurn;
    var newWord = pickRandomWord();

    roomDict[roomName].currentThingToGuess = newWord;

    var data = {"currentPlayer": roomDict[roomName].players[currentTurn], "word": newWord}

    io.to(roomName).emit('onNewTurn', data);
    if (roomDict[roomName].currentInterval != null){
        clearInterval(roomDict[roomName].currentInterval);
    }
    startTimer(roomName);
    //io.to(roomName).emit('onNewTurn', roomDict[roomName].players[currentTurn]);
}

function pickRandomWord(){
    var word = possibleWords[Math.floor(Math.random() * possibleWords.length)];
    return word;
}

function startTimer(room){
    if (roomDict[room] == undefined || roomDict[room] == null){
        return;
    }
    var countdown = 45;
    var interval = setInterval(function() {
        if (roomDict[room] == undefined || roomDict[room] == null)
        {
            clearInterval(interval);
            return;
        }
        countdown--;
        io.to(room).emit('timer', { countdown: countdown });
        if (countdown == 0){
            //clearInterval(interval);
            changeTurn(room);
            //startTimer(room);
        }
    }, 1000);
    roomDict[room].currentInterval = interval;
}

