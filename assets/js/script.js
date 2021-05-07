$(function(){

	// This demo depends on the canvas element
	if(!('getContext' in document.createElement('canvas'))){
		alert('Sorry, it looks like your browser does not support canvas!');
		return false;
	}

	// The URL of your web server (the port is set in app.js)
	var url = 'http://130.225.170.90';

	var doc = $(document),
		win = $(window),
		canvas = $('#paper'),
		ctx = canvas[0].getContext('2d'),
		instructions = $('#instructions');
	
	// Generate an unique ID
	const id = Math.round($.now()*Math.random());

	// A flag for drawing activity
	var drawing = false;

	var clients = {};
	var cursors = {};

	var socket = io();

	//Getting room name
	var textFromIndex = window.location.search;
	var textArray = textFromIndex.split("=");
	var room = textArray[1];
	socket.emit('join', room);

	var myTurn = false;

	var currentWord = null; //the current word to guess

	var timeoutTime = 100000; //time of inactivity that leads to exit


	socket.on('onJoinSuccess', function (e) {
		console.log("Join successfull");

		//hiding the real cursor to prevent having 2 cursors. (We use our own cursor which is visible to all players.)
		document.body.style.cursor = 'none';
	});

	socket.on('moving', function (data) {
		if(! (data.id in clients)){
			// a new user has come online. create a cursor for them
			cursors[data.id] = $('<div class="cursor">').appendTo('#cursors');
		}
		
		// Move the mouse pointer
		cursors[data.id].css({
			'left' : data.x,
			'top' : data.y
		});
		
		// Is the user drawing?
		if(data.drawing && clients[data.id]){
			console.log(canvas[0].offsetLeft + " and " + canvas[0].offsetTop);
			drawLine(clients[data.id].x-canvas[0].offsetLeft, clients[data.id].y-canvas[0].offsetTop, data.x-canvas[0].offsetLeft, data.y-canvas[0].offsetTop);
		}
		
		// Saving the current client state
		clients[data.id] = data;
		clients[data.id].updated = $.now();
	});

	var prev = {};
	
	canvas.on('mousedown',function(e){
		e.preventDefault();
		if (myTurn){
			drawing = true;
			prev.x = e.pageX;
			prev.y = e.pageY;
		}
	});
	
	doc.bind('mouseup mouseleave',function(){
		drawing = false;
	});

	var lastEmit = $.now();

	doc.on('mousemove',function(e){
		if($.now() - lastEmit > 30){
			socket.emit('mousemove',{
				'x': e.pageX,
				'y': e.pageY,
				'drawing': drawing,
				'id': id,
				'room': room
			});
			lastEmit = $.now();
		}
		
		// Draw a line for the current user's movement, as it is
		// not received in the socket.on('moving') event above
		
		if(drawing){
			prev.x = e.pageX;
			prev.y = e.pageY;
		}
	});

	// Remove inactive clients after inactivity
	setInterval(function(){

		for(ident in clients){
			if($.now() - clients[ident].updated > timeoutTime){
				
				// Last update was more than the specified timeoutTime in seconds ago.
				// This user has probably closed the page
				
				cursors[ident].remove();
				delete clients[ident];
				delete cursors[ident];
			}
		}
		
	},timeoutTime);

	function drawLine(fromx, fromy, tox, toy){
		ctx.beginPath();
		ctx.moveTo(fromx, fromy);
		ctx.lineTo(tox, toy);
		ctx.stroke();
		ctx.closePath();
	}

	var form = document.getElementById('form');
	var input = document.getElementById('input');

	//Sending chat messages
	form.addEventListener('submit', function(e) {
		e.preventDefault();
		if (input.value) {

			socket.emit('chat message',{
				'msg': input.value,
				'room':room
			});

			input.value = '';
		}
	});

	//receiving chat messages
	socket.on('chat message', function(msg) {
		createChatMessage(msg);
	});

	//Updating the count down timer
	socket.on('timer', function (counter) {
		$('#countDown').html(counter.countdown);
	});

	//When the game starts successfully
	socket.on('onStartSuccess', function (e) {
		var button = document.getElementById("startGame");
		button.style.display = "none"; //hiding button
	});

	//when start has failed because there arent enough players
	socket.on('onStartFail', function () {
		alert("Failed, room has to be full before starting.");
	});

	//When someone joins and the room is already full
	socket.on('full', function(e){
	   //display alert
		alert("Join failed: The room is full. You will be sent back to the previous page");
		window.location.href = "http://130.225.170.90/"; //go to main page
    });

	//When someone joins
	socket.on('user joined', (data) => {
		var message = "User joined: " + data.id;
		updatePlayerNumber(data.playerNumber);
		createChatMessage(message);
		updatePlayerCount(data.playerCount, data.maxPlayers);
	});

	//When someone leaves
	socket.on('user left', (data) => {
		if (data.gameHasStarted){
			//if game has already started when someone leaves, the game is cancelled for all player.
			alert("Someone has left the game. You will be returned to the main screen.");
			window.location.href = "http://130.225.170.90/"; //go to main page
		}else{
			var message = "User Left: " + data.id;
			createChatMessage(message);
			updatePlayerCount(data.playerCount, data.maxPlayers);
			updatePlayerNumber(data.playerNumber);
		}
	});

	//When it is the next turn
	socket.on('onNewTurn', (data) => {
		var currentPlayerID = data.currentPlayer;
		currentWord = data.word;
		isItMyTurn(currentPlayerID, currentWord);
		ctx.clearRect(0, 0, canvas[0].width, canvas[0].height); //clearing canvas
	});

	//Used to update score
	socket.on('updateScore', (data) =>{
		updatePlayerScore(data);
	});

	//Used when someone leaves, before game has started, to remove his score ui.
	socket.on('removeScore', function(id){
		document.getElementById(id).remove();
	});

	//When game finishes
	socket.on('gameFinished', function (chosenWinner) {
		alert("The game has finished! The winner is: " + "Player" + chosenWinner);
		window.location.href = "http://130.225.170.90/"; //go to main page
	});


	//When start-game button is pressed
	$('#startGame').click(function() {
		socket.emit('start',{
			'room':room
		});
	});


	//Used to create a chat message in the scrollable chat window.
	function createChatMessage(msg) {
		var item = document.createElement('li');
		item.textContent = msg;
		messages.appendChild(item);
	}

	//Used to update the number that is used to identify a player.
	function updatePlayerNumber(number){
		document.getElementById("playerNumber").textContent = "Player" + number;
	}

	//Used to update all player scores.
	function updatePlayerScore(data){
		var scoreContainer = document.getElementById('playerScores');

		//The scores are saved as an array of json object. Each object has a id->score pair.
		var objectArray = data.playerScores;

		for (var i = 0; i < objectArray.length; i++) {
			var obj = objectArray[i];
			//if we cant find an element with the object id, then we create it.
			if (document.getElementById(obj.id) == null || document.getElementById(obj.id) == undefined ){
				var item = document.createElement('li');
				item.textContent = "Player" + (i+1) + " Score: " + obj.score;
				item.setAttribute('id', obj.id);
				scoreContainer.appendChild(item);
			}else{
				document.getElementById(obj.id).textContent = "Player" + (i+1) + ": " + obj.score;
			}
		}
	}

	//Used to update the number that represents the current amount of players in the game.
	function updatePlayerCount(playerCount, maxPlayers){
		var item = document.getElementById("numberOfPlayers");
		item.textContent = playerCount + "/" + maxPlayers;
	}

	//Used to check if current turn is mine.
	function isItMyTurn(id, word) {
		var turnText = document.getElementById("turn");
		var wordText = document.getElementById("word");
		if (id == socket.id){
			myTurn = true;
			turnText.textContent = "It is your turn. Draw the shown word below!";
			wordText.textContent= "Word to draw: " + word;
		}else{
			myTurn = false;
			drawing = false; //in case you are still drawing when your turn end.
			turnText.textContent = "It is not your turn. You can try and guess the current word by using the chat.";
			wordText.textContent = "Word to draw: hidden";
		}
	}

});

