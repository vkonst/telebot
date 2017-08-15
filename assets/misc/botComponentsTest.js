'use strict';
var five = require("johnny-five");
var EtherSerial = require('etherserial');

var board = new five.Board({
    port: new EtherSerial({ port: 3333, host: "127.0.0.1" })
});

board.on("ready", function() {

    var motors = {
        left  : {fwd: new five.Led(6), rev: new five.Led(5)},
        right : {fwd: new five.Led(7), rev: new five.Led(8)}
    };

    var servo = new five.Servo({
        pin: 10
        // range: [3, 177]
        // startAt: 90
    });

   // var led = new five.Led(9);
   // led.on();

   var loadLed = new five.Led(11);
   loadLed.off();

   function toggleLoad() {
      loadLed.on();
      if (debugLevel > 2) console.log('loadLed on');
      setTimeout(function() {
          loadLed.off();
          if (debugLevel > 2) console.log('loadLed off');
        },
        300
      );
    }

    var loadIntervalId;
    board.enableLoad = function() {
      loadIntervalId = setInterval(toggleLoad, 5000);
    };
    board.disableLoad = function() {
      clearInterval(loadIntervalId);
    }
    board.enableLoad();

    var scanningIsEnabled = true;
    function doScaning() {
        if (debugLevel > 2) console.log(">>> %s doScanning curPosInd:", (new Date).toString(), curPosInd);
        if (scanningIsEnabled)
            setTimeout(nextScan, 300);
    }

    var proximityIsEnabled = true;
    var proximity;
    var prevCm;

    board.enableScaning = function() {
        scanningIsEnabled = true;
        doScaning();
    };
    board.disableScaning = function() { scanningIsEnabled = false };

    board.enableProximity = function() {
        proximityIsEnabled = true;
        proximity = new five.Proximity({
            controller: "HCSR04I2CBACKPACK"
        });

        this.repl.inject({
            proximity: proximity
        });

        proximity.on("change", function(data) {
            if ( prevCm !== undefined ) {
                var varCm = prevCm - data.cm;
                if (varCm < 0) varCm = varCm * -1;
                if (varCm > 1) {
                    prevCm = data.cm;
                    if (debugLevel) log(data);
                }
            } else {
                prevCm = data.cm;
            }

            function log(data) {
                console.log(">>> %s distance is %s cm", (new Date).toString(), data.cm);
            }
        });

    };
    board.disableProximity = function() {
        proximityIsEnabled = false
    };
    board.enableProximity();

    var debugLevel;
    board.enableDebug = function(level) {
      if (!level) level = 1;
      debugLevel = level;
    };
    board.disableDebug = function() { debugLevel = 0 };
    board.disableDebug();

    function nextScan() {
        var nextPosition = getNextPosition();
        setPosition(nextPosition);
        doScaning();
    }
    var curPosInd;
    const positions = [25, 45, 65, 45];
    const lastPosInd = positions.length - 1;

    function getNextPosition() {
        var nextPosInd;
        if ( curPosInd === undefined ) curPosInd = lastPosInd;
        if ( curPosInd >= lastPosInd )
            nextPosInd = 0;
        else
            nextPosInd = curPosInd + 1;
        return nextPosInd;
    }

    function setPosition(posInd) {
        if (debugLevel > 2)
          console.log(">>> %s set to ind, pos: ", (new Date).toString(), posInd, positions[posInd]);
        curPosInd = posInd;
        servo.to(positions[posInd]);
    }

    var sensors = {
        rev:  new five.Sensor({pin: 2, type: "digital"}),
        fwdL: new five.Sensor({pin: 3, type: "digital"}),
        fwdR: new five.Sensor({pin: 4, type: "digital"})
    }

    sensors.rev.on("change", function() {
        if (debugLevel) console.log(">>> %s rev  sensor: ", (new Date).toString(), this.value);
    });
    sensors.fwdL.on("change", function() {
        if (debugLevel) console.log(">>> %s fwdL sensor: ", (new Date).toString(), this.value);
    });
    sensors.fwdR.on("change", function() {
        if (debugLevel) console.log(">>> %s fwdR sensor: ", (new Date).toString(), this.value);
    });

/*
    board.testMotor = function (motor, sec) {
        if (debugLevel) console.log('%s>>>> switched on pin %s', (new Date).toString(), motor.pin);
        motor.on();
        return new Promise( resolve => {
            setTimeout( () => {
                if (debugLevel) console.log('%s>>>> switched off pin %s', (new Date).toString(), motor.pin);
                motor.off();
                resolve();
            }, sec*1000)
        })
    };
    board.testDrive = () => {
        fn(3);
        function fn(n) {
            if (n<0) return;
            board.testMotor(motors.left.fwd, 1);
            board.testMotor(motors.right.fwd, 1)
                .then( ()=>{ return new Promise( resolve=>setTimeout(resolve, 2000))})
                .then( ()=>fn(--n));
        }
    };
*/
    this.repl.inject({
        board: board,
        motors: motors,
        servo: servo,
        proximity: proximity,
        sensors: sensors,
        // led: led,
	loadLed: loadLed
    });

    // servo.sweep()
});
