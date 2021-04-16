//const app = require('express')();
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const static = require('node-static');
const port = process.env.PORT || 3000;

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
    console.log(roomName);
    socket.join(roomName);
    socket.to(roomName).emit('user joined', socket.id);
  });

  socket.on('disconnect', () => {
    //var rooms = Object.keys(socket.rooms);
    //console.log('user disconnected at room: ' + rooms[0]);
  });


  socket.on('disconnecting', function(){
    console.log(socket.rooms); // the Set contains at least the socket ID
    console.log("socket id: " + socket.id);

    for (const [key, value] of Object.entries(socket.rooms)) {
      console.log(value);
    }

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
