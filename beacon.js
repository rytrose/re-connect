var _ = require('lodash');
var Bleacon = require('bleacon');
var osc = require("osc");

/*
	Setup OSC connection to python
*/

// Port listening on 7400
var udp = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 7400
});

// Listen for incoming OSC messages.
udp.on("message", function (oscMsg) {
    console.log("An OSC message was received!", oscMsg);
    if(oscMsg.address == '/startBeacons') startBeacons();
});

udp.open();

var sendOSCMessage = function (address, args) {
	udp.send({
        address: address,
        args: args
    }, "127.0.0.1", 7500); // Send to python at 7500
};

const PLAYING_BUFFER = 3;
const FADE_TIME = 2000; // in milliseconds
const ON_VOLUME = 30;
var beacons = {
		'12424': {
				'color': 'lemon', 
				'song' : 'birds.wav',
				'proximity_buffer' : [],
				'proximity' : 0,
				'lastDatapoint' : Date.now(),
                'playing' : 0
			 },
		'51679': {
				'color': 'candy', 
				'song' : 'ocean.wav',
				'proximity_buffer' : [],
				'proximity' : 0,
				'lastDatapoint' : Date.now(),
                'playing' : 0
			 },
		'27465': {
				'color': 'beetroot', 
				'song' : 'rain.wav',
				'proximity_buffer' : [],
				'proximity' : 0,
				'lastDatapoint' : Date.now(),
                'playing' : 0
			 }
	};

sendOSCMessage("/setup", [JSON.stringify(beacons)]);

var playing = undefined;
var playing_key = undefined;

/*
	Beacon Scanning
*/
var startBeacons = function	() {
	console.log("Starting beacons.");

	var uuid = 'b9407f30f5f8466eaff925556b57fe6d';

	Bleacon.startScanning(uuid);

	Bleacon.on('discover', function(bleacon) {
		var beacon = beacons[bleacon.major];
		if(beacon) setProximity(beacon, bleacon);
	});
}

var setProximity = function (beacon, bleacon){
	const AVG_SIZE = 10;
	const ALPHA = 0.7;

	var oldProximity = beacon.proximity;

	/*
		Moving Average Smoothing
	*/
	if(beacon.proximity_buffer.length == 0) beacon.proximity_buffer.push(bleacon.accuracy);
	// var newProximity = _.sum(beacon.proximity_buffer) / beacon.proximity_buffer.length;
	
	/*
		Exponential Smoothing
	*/
	var newProximity = (ALPHA * bleacon.accuracy) + ((1-ALPHA) * oldProximity);

	if(beacon.proximity_buffer.length < AVG_SIZE && beacon.proximity_buffer.length != 0) beacon.proximity_buffer.push(bleacon.accuracy);
	else {
		beacon.proximity_buffer.shift();
		beacon.proximity_buffer.push(bleacon.accuracy);
	}

	beacon.lastDatapoint = Date.now();
	beacon.proximity = newProximity;

	checkPlaying();
}

var checkPlaying = function () {
    var closest_prox = Infinity;
    var closest = undefined;
    var closest_key = undefined;
    _.each(beacons, function(beacon, key){
        if(beacon.proximity < closest_prox && beacon.proximity != 0){
            closest_prox = beacon.proximity;
            closest = beacon;
            closest_key = key;
        }
    });

    if (closest_prox < 1) {
        if (playing) {
            if (playing == closest) closest.playing = _.min([closest.playing + 1, PLAYING_BUFFER]);
            else {
                playing.playing = _.max([playing.playing - 1, 0]);
                if (playing.playing == 0) {
                    closest.playing = PLAYING_BUFFER;

                    // Fade out the previous beacon
					sendOSCMessage("/stopGenerative", ["stop"]);
                    fadeVolume(playing_key, "out");

                    // Switch to new playing beacon
                    playing = closest;
                    playing_key = closest_key;

                    sendOSCMessage("/switchPlayingBeacon", [closest_key]);
                    setTimeout(function(){
						console.log("Playing " + closest_key);
                    	fadeVolume(playing_key, "in");
					}, FADE_TIME);
					setTimeout(function(){
						sendOSCMessage("/playGenerative", ["play"]);
					}, FADE_TIME * 2);
                }
            }
        }
        else {
            closest.playing = PLAYING_BUFFER;
            playing = closest;
            playing_key = closest_key;
            console.log("Playing " + closest_key);
            sendOSCMessage("/switchPlayingBeacon", [closest_key]);
            fadeVolume(playing_key, "in");
			setTimeout(function(){
				sendOSCMessage("/playGenerative", ["play"]);
			}, FADE_TIME);
        }
    }
}

var fadeVolume = function(major, direction) {
	var fade_del = FADE_TIME / (ON_VOLUME - 1);
	var vol_del;
	if(direction == "in") vol_del = 1;
	else vol_del = -1;

	var timeout = 0;
	for(var i = 0; i < (ON_VOLUME - 1); i++){
		setTimeout(function(){
			sendOSCMessage("/setVolume", [major, vol_del]);
		}, timeout + fade_del);
		timeout += fade_del;
	}
}

var timeoutBeacons = function() {
    if (playing) {
        _.each(beacons, function (beacon, key) {
			if(playing == beacon && (Date.now() - beacon.lastDatapoint) > 10000) stopPlaying(key);
        });
    }
}

var stopPlaying = function(major) {
	console.log("Stopping " + major + " due to timeout.");
	playing = undefined;
	playing_key = undefined;
	beacons[major].proximity = 0;
	beacons[major].playing = 0;

	// Fade out the previous beacon
	sendOSCMessage("/stopGenerative", ["stop"]);
	fadeVolume(major, "out");
	setTimeout(function(){
		sendOSCMessage("/switchPlayingBeacon", ["None"]);
	}, FADE_TIME);
}

// Check for timeouts every 500s
setInterval(timeoutBeacons, 500);
