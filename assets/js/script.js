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

	//var socket = io.connect(url);
	var socket = io();

	//Getting room name
	var textFromIndex = window.location.search;
	var textArray = textFromIndex.split("=");
	var room = textArray[1];
	socket.emit('join', room);

	var myTurn = false;

	var currentWord = null;


	socket.on('onJoinSuccess', function (e) {
		console.log("Join successfull");

		//hiding cursor
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
			
			// Draw a line on the canvas. clients[data.id] holds
			// the previous position of this user's mouse pointer

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
		// Hide the instructions
		//instructions.fadeOut();
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
			
			//drawLine(prev.x, prev.y, e.pageX, e.pageY);
			prev.x = e.pageX;
			prev.y = e.pageY;
		}
	});

	// Remove inactive clients after inactivity
	setInterval(function(){

		for(ident in clients){
			if($.now() - clients[ident].updated > 10000){
				
				// Last update was more than 10 seconds ago. 
				// This user has probably closed the page
				
				cursors[ident].remove();
				delete clients[ident];
				delete cursors[ident];
			}
		}
		
	},10000);

	function drawLine(fromx, fromy, tox, toy){
		ctx.beginPath();
		ctx.moveTo(fromx, fromy);
		ctx.lineTo(tox, toy);
		ctx.stroke();
		ctx.closePath();

	}

	var form = document.getElementById('form');
	var input = document.getElementById('input');

	form.addEventListener('submit', function(e) {
		e.preventDefault();
		if (input.value) {

			socket.emit('chat message',{
				'msg': input.value,
				'room':room
			});



			//socket.emit('chat message', input.value);
			input.value = '';
		}
	});

	socket.on('chat message', function(msg) {
		createChatMessage(msg);
	});

	socket.on('timer', function (counter) {
		$('#countDown').html(counter.countdown);
	});

	socket.on('onStartSuccess', function (e) {
		var button = document.getElementById("startGame");
		button.style.display = "none"; //hiding button
	});

	socket.on('onStartFail', function () {
		alert("Failed, room has to be full before starting.");
	});

	socket.on('full', function(e){
	   //display alert
		alert("Join failed: The room is full. You will be sent back to the previous page");
		window.location.href = "http://130.225.170.90/"; //go to main page

    });

	socket.on('user joined', (data) => {
		var message = "User joined: " + data.id;
		createChatMessage(message);
		updatePlayerCount(data.playerCount, data.maxPlayers);

	});

	socket.on('user left', (data) => {
		if (data.gameHasStarted){
			alert("Someone has left the game. You will be returned to the main screen.");
			window.location.href = "http://130.225.170.90/"; //go to main page
		}else{
			var message = "User Left: " + data.id;
			createChatMessage(message);
			updatePlayerCount(data.playerCount, data.maxPlayers);
		}
	});

	socket.on('onNewTurn', (data) => {
		var currentPlayerID = data.currentPlayer;
		currentWord = data.word;
		isItMyTurn(currentPlayerID, currentWord);
		ctx.clearRect(0, 0, canvas[0].width, canvas[0].height);
	});

	socket.on('updateScore', (data) =>{
		updatePlayerScore(data);
	});


	$('#startGame').click(function() {
		ctx.fillStyle = "red";
		socket.emit('start',{
			'room':room
		});
	});

	function createChatMessage(msg) {
		var item = document.createElement('li');
		item.textContent = msg;
		messages.appendChild(item);
		//window.scrollTo(0, document.body.scrollHeight);
		//this line caused problems on some computers where the whole page would jump up.
		//removing it didn't change any behaviour of the program.
	}

	function updatePlayerScore(data){
		var scoreContainer = document.getElementById('playerScores');

		var objectArray = data.playerScores;

		for (var i = 0; i < objectArray.length; i++) {
			var obj = objectArray[i];
			if (document.getElementById(obj.id) == null || document.getElementById(obj.id) == undefined ){
				var item = document.createElement('li');
				item.textContent = obj.id + ": " + obj.score;
				item.setAttribute('id', obj.id);
				scoreContainer.appendChild(item);
			}else{
				document.getElementById(obj.id).textContent = obj.id + ": " + obj.score;
			}
		}
	}

	function updatePlayerCount(playerCount, maxPlayers){
		var item = document.getElementById("numberOfPlayers");
		item.textContent = playerCount + "/" + maxPlayers;
	}

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

