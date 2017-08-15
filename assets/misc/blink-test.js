var five = require("johnny-five");
var EtherSerial = require('etherserial');

var board = new five.Board({
    port: new EtherSerial({ port: 3333, host: "192.168.1.33" })
});

board.on("ready", function() {
  var led = new five.Led(13);
  led.blink(500);
});

