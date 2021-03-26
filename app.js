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

io.on('connection', (socket) => {
  socket.on('mousemove', data => {
    io.emit('moving', data);});
});

http.listen(port, () => {
  console.log(`Socket.IO server running at http://localhost:${port}/`);
});
