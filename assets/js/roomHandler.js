$('#createRoom').click(function() {
    var socket = io();
    var roomName = $('#fname').val();
    socket.emit('join', roomName)
});