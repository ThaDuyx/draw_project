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
	var id = Math.round($.now()*Math.random());
	
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
	socket.emit('join', room)

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
		drawing = true;
		prev.x = e.pageX;
		prev.y = e.pageY;
		
		// Hide the instructions
		instructions.fadeOut();
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

	// Remove inactive clients after 10 seconds of inactivity
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
		ctx.moveTo(fromx, fromy);
		ctx.lineTo(tox, toy);
		ctx.stroke();
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
		var item = document.createElement('li');
		item.textContent = msg;
		messages.appendChild(item);
		window.scrollTo(0, document.body.scrollHeight);
	});

	socket.on('full', function(e){
	   //display alert
        print("the room is full");

    });



});