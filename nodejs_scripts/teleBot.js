/* global require */
'use strict';

const express = require('express'),
    helmet = require('helmet'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io')(server),
    proxy = require('http-proxy-middleware'),
    five = require("johnny-five"),
    EtherSerial = require('etherserial');

app.use(helmet());
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

io.on('connection', function(client) {

    client.on('cmd', function(data) {
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

const FWD = 1, STOP = 0, BWD = -1,
    COURSE_REVERSED_EVENT = 'course.reversed',
    COURSE_STOP_EVENT = 'course.stop',
    COURSE_START_EVENT = 'course.start',
    COURSE_CHANGED_EVENT = 'course.changed';

const board = new five.Board({
    port: new EtherSerial({ port: 3333, host: "127.0.0.1" })
});


if (process.env.debug) {
  board.io.transport.on('data', v=> console.log("board.io.transport.on data", v));
  board.io.transport.on('open', v=>console.log("board.io.transport.on open", v));
  board.io.transport.on('close', v=>console.log("board.io.transport.on close", v));
  board.io.transport.on('error', v=>console.log("board.io.transport.on error", v));
  board.io.transport.on('disconnect', v=>console.log("board.io.transport.on diconnect", v));
  board.io.on('digital-read', v=>console.log("digital-read:[%s] ", (new Date()), v));
}

board.on("ready", function() {
    const motors = {
        left  : {fwd: new five.Led(6), rev: new five.Led(5)},
        right : {fwd: new five.Led(7), rev: new five.Led(8)}
    };
    const servo = new five.Servo({ pin: 10 });
    const sensors = {
        rev:  new five.Sensor({pin: 2, type: "digital", mode: board.MODES.PULLUP}),
        fwdL: new five.Sensor({pin: 3, type: "digital", mode: board.MODES.PULLUP}),
        fwdR: new five.Sensor({pin: 4, type: "digital", mode: board.MODES.PULLUP})
    };
    const loadLed = new five.Led(11);

    function querySensor(n) {
      if (n===undefined) n = 60;
      if ( n <= 0 ) return;
      setTimeout( () => {
        board.io.reportDigitalPin(sensors.rev.value, 1);
        querySensor(--n);
      }, 1000);
    }
    querySensor();
    board.querySensor = querySensor;

    let debugLevel;
    board.enableDebug = function(level) {
        if (!level) level = 1;
        debugLevel = level;
    };
    board.disableDebug = function() { debugLevel = 0 };
    board.disableDebug();

    let loadIntervalId;
    board.enableLoad = () => {
        toggleLoad();
        loadIntervalId = setInterval(toggleLoad, 5000);
    };
    board.disableLoad = () => {
        clearInterval(loadIntervalId);
    };
    board.enableLoad();

    let course = 's', direction = STOP;
    app.on('cmd', driveController);

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
    board.testDrive = (n) => {
        if (!n) n = 3;
        fn(n);
        function fn(n) {
            if (n<0) return;
            if (debugLevel) console.log('%s>>>> testDrive run %s', (new Date).toString(), n);
            board.testMotor(motors.left.fwd, 1);
            board.testMotor(motors.right.fwd, 1)
                .then( ()=>{ return new Promise( resolve=>setTimeout(resolve, 2000))})
                .then( ()=>fn(--n));
        }
    };

    let scanningIsEnabled, proximityIsEnabled;
    let proximity, prevCm;
    let curPosInd;
    const positions = [25, 45, 65, 45, 45];
    const lastPosInd = positions.length - 1;

    board.enableScaning = () => { scanningIsEnabled = true; doScaning()};
    board.disableScaning = () => scanningIsEnabled = false;
    board.enableScaning();

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
                let varCm = prevCm - data.cm;
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
    board.disableProximity = () => proximityIsEnabled = false;
    board.enableProximity();

    sensors.rev.on("change", function() {
        if (debugLevel) console.log(">>> %s rev  sensor: ", (new Date).toString(), this.value);
    });
    sensors.fwdL.on("change", function() {
        if (debugLevel) console.log(">>> %s fwdL sensor: ", (new Date).toString(), this.value);
    });
    sensors.fwdR.on("change", function() {
        if (debugLevel) console.log(">>> %s fwdR sensor: ", (new Date).toString(), this.value);
    });

    board.on(COURSE_START_EVENT, () => {
        board.disableLoad();
        board.enableScaning();
    });
    board.on(COURSE_STOP_EVENT,  () => {
        board.disableScaning();
        board.enableLoad();
    });

    this.repl.inject({
        board: board,
        motors: motors,
        servo: servo,
        // proximity: proximity,
        sensors: sensors,
        loadLed: loadLed
    });

    let nextCmd, motorsAreBusy = false;
    function driveController(driveCmd) {
        let cmd;
        if (driveCmd) {
            switch (driveCmd) {
                case "stop":    cmd = takeStop; break;
                case "forward": cmd = takeForward; break;
                case "reverse": cmd = takeBackward; break;
                case "right":   cmd = takeRight; break;
                case "left":    cmd = takeLeft; break;
            }
            if (cmd) { execOrQueue(cmd) }
        }

        function execOrQueue(cmd) {
            if (motorsAreBusy) {
                nextCmd = cmd;
            }
            else { execCmd(cmd) }

            function execCmd(cmd) {
                motorsAreBusy = true;
                process.nextTick(execThenProcessNext);

                function execThenProcessNext() {
                    let prevCmd = cmd;
                    cmd().then( ()=> {
                        motorsAreBusy = false;
                        processNext(prevCmd);
                    })
                }
                function processNext(prevCmd) {
                    if (nextCmd) {
                        let cmd = nextCmd;
                        nextCmd = undefined;
                        if (prevCmd !== cmd) execCmd(cmd);
                    }
                }
            }
        }
    }

    function getTimeoutPromise(millis) {
        return new Promise( resolve => setTimeout(resolve, millis) );
    }

    function takeStop() {
        let busyMillis = 300;
        stopMotors();
        return getTimeoutPromise(busyMillis);
    }

    function takeForward() {
        let busyMillis = 300;
        if (course.match(/lb|b|rb/)) {
            stopMotors();
            setTimeout(forward, 300);
            busyMillis += 300;
        }
        else forward();
        return getTimeoutPromise(busyMillis);
    }

    function takeBackward() {
        let busyMillis = 300;
        if (course.match(/lf|f|rf/)) {
            stopMotors();
            setTimeout(reverse, 300);
            busyMillis += 300;
        }
        else reverse();
        return getTimeoutPromise(busyMillis);
    }

    function takeLeft() {
        let busyMillis = 300;
        switch (course) {
            case 'll':
            case 'lf':
            case 'lb':
                leftFast(); break;
            case 'rf':
                forward(); break;
            case 'rb':
                stopMotors();
                setTimeout(FWD ? leftFwd : leftBwd, 300);
                busyMillis += 300;
                break;
            case 'rr':
                direction === FWD ? rightFwd() : rightBwd();
                break;
            case 'f':
                leftFwd(); break;
            case 's':
                direction === FWD ? leftBwd() : leftFwd();
                break;
            case 'b':
                rightBwd(); break;
        }
        return getTimeoutPromise(busyMillis);
    }

    function takeRight() {
        let busyMillis = 300;
        switch (course) {
            case 'rr':
            case 'rf':
            case 'rb':
                rightFast(); break;
            case 'lf':
                forward(); break;
            case 'lb':
                stopMotors();
                setTimeout(FWD ? rightFwd : rightFwd, 300);
                busyMillis += 300;
                break;
            case 'll':
                direction === FWD ? leftFwd() : leftBwd();
                break;
            case 'f':
                rightFwd(); break;
            case 's':
                direction === FWD ? rightBwd() : rightFwd();
                break;
            case 'b':
                leftBwd(); break;
        }
        return getTimeoutPromise(busyMillis);
    }

    function leftFwd() {
        return switchMotors(STOP, FWD);
    }

    function leftBwd() {
        return switchMotors(BWD, STOP);
    }

    function leftFast() {
        return switchMotors(BWD, FWD);
    }

    function rightFwd() {
        return switchMotors(FWD, STOP);
    }

    function rightBwd() {
        return switchMotors(STOP, BWD);
    }

    function rightFast() {
        return switchMotors(FWD, BWD);
    }

    function forward() {
        return switchMotors(FWD, FWD);
    }

    function reverse() {
        return switchMotors(BWD, BWD);
    }

    function stopMotors() {
        return switchMotors(STOP, STOP);
    }

    function switchMotors(leftDir, rightDir) {
        switchMotor(motors.left, leftDir);
        switchMotor(motors.right, rightDir);
        return getCourse(leftDir, rightDir);

    }

    function switchMotor(motor, dir) {
        switch (dir) {
            case FWD:
                motor.fwd.on();
                if (debugLevel > 2) console.log('motor fwd pin %s switched on', motor.fwd.pin);
                motor.rev.off();
                if (debugLevel > 2) console.log('motor rev pin %s switched off', motor.rev.pin);
                break;
            case BWD:
                motor.fwd.off();
                if (debugLevel > 2) console.log('motor fwd pin %s switched off', motor.fwd.pin);
                motor.rev.on();
                if (debugLevel > 2) console.log('motor rev pin %s switched on', motor.rev.pin);
                break;
            default:
                motor.fwd.off();
                if (debugLevel > 2) console.log('motor fwd pin %s switched off', motor.fwd.pin);
                motor.rev.off();
                if (debugLevel > 2) console.log('motor rev pin %s switched off', motor.rev.pin);
                break;
        }
    }
    function getCourse(leftDir, rightDir) {
        let prevDirection = direction;
        let prevCourse = course;
        if ( (leftDir === FWD) && (rightDir === FWD) ) {
            course = 'f';
            direction = FWD;
        } else if ( (leftDir === FWD) && (rightDir === STOP) ) {
            course = 'rf';
            direction = FWD;
        } else if ( (leftDir === FWD) && (rightDir === BWD) )  {
            course = 'rr';
            direction = BWD;
        } else if ( (leftDir === STOP) && (rightDir === FWD) ) {
            course = 'lf';
            direction = FWD;
        } else if ( (leftDir === STOP) && (rightDir === STOP) ) {
            course = 's';
        } else if ( (leftDir === STOP) && (rightDir === BWD) ) {
            course = 'rb';
            direction = BWD;
        } else if ( (leftDir === BWD) && (rightDir === FWD) ) {
            course = 'll';
        } else if ( (leftDir === BWD) && (rightDir === STOP) ) {
            course = 'lb';
            direction = BWD;
        } else if ( (leftDir === BWD) && (rightDir === BWD) ) {
            course = 'b';
            direction = BWD;
        }

        if (prevDirection !== direction) {
            board.emit(COURSE_REVERSED_EVENT, {cur: direction, prev: prevDirection});
        }

        if (prevCourse !== course) {
            if (prevCourse === 's') {
                board.emit(COURSE_START_EVENT, {cur: course, prev: prevCourse});
            } else if (course === 's') {
                board.emit(COURSE_STOP_EVENT, {cur: course, prev: prevCourse});
            } else {
                board.emit(COURSE_CHANGED_EVENT, {cur: course, prev: prevCourse});
            }
        }

        return course;
    }

    function toggleLoad() {
        loadLed.on();
        if (debugLevel) console.log('loadLed on');
        setTimeout(function() {
                loadLed.off();
                if (debugLevel) console.log('loadLed off');
            },
            300
        );
    }

    function doScaning() {
        if (debugLevel > 2) console.log(">>> %s doScanning curPosInd:", (new Date).toString(), curPosInd);
        if (scanningIsEnabled)
            setTimeout(nextScan, 300);
    }

    function nextScan() {
        let nextPosition = getNextPosition();
        setPosition(nextPosition);
        doScaning();
    }

    function getNextPosition() {
        let nextPosInd;
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

});

server.listen(port);
console.log("Server listening on http://localhost:%s", port);
