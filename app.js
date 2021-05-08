
//This project is built upon the foundations laid by the following tutorial: https://tutorialzine.com/2012/08/nodejs-drawing-game
//Any code that we HAVEN'T made, is clearly labeled with TUTORIAL CODE STARTS/ENDS HERE.
//Any modifications of ours INSIDE the tutorial code is labelled with MODIFICATION


//TUTORIAL CODE STARTS HERE
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const static = require('node-static');
const port = process.env.PORT || 3000; //running on port 3000
//TUTORIAL CODE ENDS HERE


//This class represents a single room and its state.
class RoomController{
  constructor(players, playerScore, currentThingToGuess, amountOfPlayers, gameHasStarted, currentPlayerTurn, wordList, currentInterval, gameHasFinished){
    this.players = players; // A list of player ids in the room.
    this.playerScore = playerScore; // A list of objects where each object has a id->score pair.
    this.currentThingToGuess = currentThingToGuess;
    this.amountOfPlayers = amountOfPlayers;
    this.gameHasStarted = gameHasStarted;
    this.currentPlayerTurn = currentPlayerTurn;
    this.wordList = wordList;
    this.currentInterval = currentInterval; //The current countdown timer. This variable is used to ensure that we don't get to counters running at the same time.
    this.gameHasFinished = gameHasFinished;
  }
}

var roomDict = new Object(); //The data structure that manages all game rooms. Is a JSON.
var maxPlayers = 3; //The number of players needed to start a game.
var finishPoints = 20; //points required to win the game
var possibleWords = ["Elephant", "Airplane", "Pikachu", "House", "Stickman", "Beaver", "Piano", "Computer", "Bottle", "Watch", "Printer", "Witch", "Couch", "Chair", "Mouse", "Car", "Dinner", "Running", "Father", "Falling", "Mirror"];

app.use(express.static(__dirname + '/assets')); //Tells the app where our client side ressources are.

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html'); //Send index.html as the main page.
});

app.get('/game.html', (req, res) => {
  res.sendFile(__dirname + '/game.html');
});

//When a new client joins.
io.on('connection', (socket) => {

  //When the client wants to join a room.
  socket.on('join', roomName => {
    var success = false;

    //if no room with this name, then we create it.
    if(roomDict[roomName] == null){
      roomDict[roomName] = new RoomController(new Array(), new Array(), "", 1, false, 0, possibleWords, null,false);
      success = true;
    }else{
      //we increment the number of players in the room. The client has not been assigned the room yet. (Done a bit further down)
      if (roomDict[roomName].amountOfPlayers != maxPlayers){
        roomDict[roomName].amountOfPlayers += 1;
        success = true;
      }else{
          //the room is full
        io.to(socket.id).emit('full', true);
      }
    }

    if (success){
      socket.join(roomName); //This line is where we assign a room to the client.

      io.to(socket.id).emit('onJoinSuccess', true);

      //Updating the data of the room.
      roomDict[roomName].players.push(socket.id);
      roomDict[roomName].playerScore.push({'id':socket.id,'score':0});

      //Updating info on the client side.
      updateInfo(roomName, true);
    }

  });


  //When someone has disconnected completely.
  socket.on('disconnect', () => {
      console.log(roomDict);
  });

  //When someone is about to disconnect.
  socket.on('disconnecting', function(){
    //the room name is saved in a special way that requires us to use an interator to times to get the room name.
    const iterator = socket.rooms.values();
    iterator.next();

    var roomName = iterator.next().value;

    if (roomDict[roomName] != undefined && roomDict[roomName] != null){
      roomDict[roomName].amountOfPlayers -= 1;
      if (roomDict[roomName].amountOfPlayers == 0)delete roomDict[roomName]; //if room is empty we delete it.
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
          updateInfo(roomName, false);
      }
    }
  });

  //When server has received a chat message from a client.
  socket.on('chat message', (data) => {
    console.log('message: ' + data.msg);
    var msg = data.msg;
    var text = "";
    //currentDrawingPlayer is later used to check if the drawing player is trying guess the word which is not allowed as he already knows the word.
    var currentDrawingPlayer = roomDict[data.room].players[roomDict[data.room].currentPlayerTurn];
    var playerNumber = 0;
      for (var i = 0; i < roomDict[data.room].players.length; i++) {
          if (socket.id == roomDict[data.room].players[i]){
              playerNumber = i+1;
              break;
          }
      }


      if (msg.includes("/g")) { //the client is trying to guess.

          if (socket.id == currentDrawingPlayer){ //current drawing player shouldnt be able to guess
              io.to(socket.id).emit('chat message', "You can't guess when you are the one drawing!"); //Notice that this is only sent to one client and not all.
          }else{
              var guess = msg.substring(3);
              if (roomDict[data.room].currentThingToGuess != null) {
                  if (guess.toLowerCase() == roomDict[data.room].currentThingToGuess.toLowerCase()) { //guessed correct
                      text = "Player" + playerNumber + " Guessed the correct word!: " + guess;
                      text.fontcolor("green");
                      givePoints(socket.id, data.room);
                      changeTurn(data.room);

                  } else { //guessed wrong
                      text = "Player" + playerNumber + " Guessed the following: " + guess;
                      text.fontcolor("red");
                  }

                  io.to(data.room).emit('chat message', text);
                  checkFinishGame(data.room); //We check if the game has finished, in case the player has reached the max points.
              }
          }
      }else{ //the message is not a guess.
          text = "Player" + playerNumber + ": " + msg;
          io.to(data.room).emit('chat message', text);
      }

  });

    //Used to update info on the client
    function updateInfo(roomName, hasJoined){
        for (var i = 0; i < roomDict[roomName].players.length; i++) {
            var currentID = roomDict[roomName].players[i];
            var playerNumber = i + 1;
            var data;
            //handled slightly differently based on wether the update happens when someone joins or leaves.
            if (hasJoined){
                data = {'id':socket.id,'playerCount':roomDict[roomName].amountOfPlayers,'maxPlayers':maxPlayers, 'playerNumber': playerNumber};
                io.to(currentID).emit('user joined', data);
            }else{
                data = {'id':socket.id,'playerCount':roomDict[roomName].amountOfPlayers,'maxPlayers':maxPlayers, 'gameHasStarted':roomDict[roomName].gameHasStarted, 'playerNumber':playerNumber};
                io.to(currentID).emit('user left', data);
            }
        }
    }

  //Used to give points to a user when he guesses correctly
  function givePoints(idOfGuesser, room){
      for (var i = 0; i < roomDict[room].playerScore.length; i++) {
          if (roomDict[room].playerScore[i].id == idOfGuesser){
              roomDict[room].playerScore[i].score += 10; //the guesser gets 10 points
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

  //Checks if the game has ended. Often used right after givePoints()
  function checkFinishGame(room){
      if (roomDict[room].gameHasFinished){
          var currentMaxPoints = null;
          var currentChosenWinner = null;
          var winnerPlayerNumber = 0;

          for (var i = 0; i < roomDict[room].playerScore.length; i++) {
              if (currentMaxPoints == null || roomDict[room].playerScore[i].score > currentMaxPoints){
                  currentMaxPoints = roomDict[room].playerScore[i].score;
                  currentChosenWinner = roomDict[room].playerScore[i].id;
              }
          }

          for (var i = 0; i < roomDict[room].players.length; i++) {
              if (currentChosenWinner == roomDict[room].players[i]){
                  winnerPlayerNumber = i+1;
                  break;
              }
          }

          io.to(room).emit('gameFinished', winnerPlayerNumber);

      }
  }

  //When the game starts
  socket.on('start', data => {
    var room = data.room;
    if (roomDict[room].amountOfPlayers == maxPlayers && !roomDict[room].gameHasStarted){ //only run when the room is full and not already started
      roomDict[room].gameHasStarted = true;
      io.to(room).emit('onStartSuccess', true);
      changeTurn(room);
      var data1 = {'playerScores':roomDict[room].playerScore};
      io.to(room).emit('updateScore', data1);
    }else{
      io.to(socket.id).emit('onStartFail');
    }
  });


  //Handles showing all the clients cursors in real time.
  socket.on('mousemove', data => {
    var room = data.room;
    io.to(room).emit('moving',data);
  });

});

//TUTORIAL CODE START HERE
http.listen(port, () => {
  console.log(`Socket.IO server running at http://localhost:${port}/`);
});

io.sockets.on('connection', function (socket) {
  socket.on('reset', function (data) {
    countdown = 1000;
    io.sockets.emit('timer', { countdown: countdown });
  });
});
//TUTORIAL CODE ENDS HERE


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
        clearInterval(roomDict[roomName].currentInterval); //If there is already a count down happening (like when a correct guess happens), we stop it.
    }
    startTimer(roomName);

}

function pickRandomWord(){
    var word = possibleWords[Math.floor(Math.random() * possibleWords.length)];
    return word;
}

function startTimer(room){
    if (roomDict[room] == undefined || roomDict[room] == null){
        return;
    }
    var countdown = 45; //The max amount of time a turn may last.
    var interval = setInterval(function() {
        if (roomDict[room] == undefined || roomDict[room] == null)
        {
            clearInterval(interval);
            return;
        }
        countdown--;
        io.to(room).emit('timer', { countdown: countdown });
        if (countdown == 0){
            changeTurn(room);
        }
    }, 1000);
    roomDict[room].currentInterval = interval;
}

