'use strict';
const five = require("johnny-five");
const EtherSerial = require('etherserial');

const board = new five.Board({
    port: new EtherSerial({ port: 3333, host: "127.0.0.1" })
});

const FWD = 1, STOP = 0, BWD = -1;

board.on("ready", function() {

    const motors = {
        left  : {fwd: new five.Led(6), rev: new five.Led(5)},
        right : {fwd: new five.Led(7), rev: new five.Led(8)}
    };
    motors.left.switch = (dir) => switchMotors (motors.left, dir);
    motors.right.switch = (dir) => switchMotors (motors.right, dir);

    motors.testDrive = n => {
        (function fn(n) {
            console.log('>> testdrive #%s', n);
            if (n>0) {
                goFwd()
                    .then(stay)
                    .then(goBwd)
                    .then(stay)
                    .then( ()=>fn(--n) )
            }
        })(n)
    };

    function switchMotors(motor, dir) {
        switch (dir) {
            case FWD:
                motor.fwd.on();
                console.log('motor fwd pin %s switched on', 
motor.fwd.pin);
                motor.rev.off();
                console.log('motor rev pin %s switched off', 
motor.rev.pin);
                break;
            case BWD:
                motor.fwd.off();
                console.log('motor fwd pin %s switched off', 
motor.fwd.pin);
                motor.rev.on();
                console.log('motor rev pin %s switched on', 
motor.rev.pin);
                break;
            case STOP:
                motor.fwd.off();
                console.log('motor fwd pin %s switched off', 
motor.fwd.pin);
                motor.rev.off();
                console.log('motor rev pin %s switched off', 
motor.rev.pin);
                break;
        }
    }

    function goFwd() {
        motors.right.switch(1);
        motors.left.switch(1);
        return new Promise(
            resolve=> setTimeout( () => {
                motors.right.switch(0);
                motors.left.switch(0);
                resolve()
            }, 1000)
        )
    }
    function goBwd() {
        motors.right.switch(-1);
        motors.left.switch(-1);
        return new Promise(
            resolve=> setTimeout( () => {
                motors.right.switch(0);
                motors.left.switch(0);
                resolve()
            }, 1000)
        )
    }
    function stay() {
        return new Promise( resolve=> setTimeout(resolve, 1000))
    }

    let loadLed = new five.Led(11);
    loadLed.off();

    function toggleLoad() {
        loadLed.on();
        console.log('loadLed on');
        setTimeout(function() {
                loadLed.off();
                console.log('loadLed off');
            },
            300
        );
    }

    let loadIntervalId;
    board.enableLoad = function() {
        loadIntervalId = setInterval(toggleLoad, 5000);
    };
    board.disableLoad = function() {
        clearInterval(loadIntervalId);
    };
    board.enableLoad();

    this.repl.inject({
        board: board,
        motors: motors,
        loadLed: loadLed
    });
});

