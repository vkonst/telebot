var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

var proxy = require('http-proxy-middleware');

app.use('/api/videofeed', proxy({
  target: 'http://127.0.0.1:8080',
    pathRewrite: {
      'api/videofeed' : 'videofeed'
    },
  changeOrigin: true
}));


app.use(express.static(__dirname + '/public'));
app.get('/', function(req, res, next) {
  res.sendFile(__dirname + '/public/index.html')
});

var client;
io.on('connection', function(client) {

  client.on('command', function(data) {
    app.emit('cmd', data);
    client.emit('ack', data);
    console.log('>>> cmd:', data);
  });

  client.on('disconnected', function() {
    app.emit('disconnected');
    console.log('>>> client disconected');
  });

  console.log('>>> client conected');
  app.emit('connected');
});

const port = process.env.PORT || 3000;

server.listen(port);
console.log(`Server listening on http://localhost:${port}`);
