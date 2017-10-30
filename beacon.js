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

var beacons = {
		'12424': {
				'color': 'lemon', 
				'song' : 'birds.mp3',
				'proximity_buffer' : [],
				'proximity' : 0,
				'gain' : 0
			 },
		'51679': {
				'color': 'candy', 
				'song' : 'ocean.mp3',
				'proximity_buffer' : [],
				'proximity' : 0,
				'gain' : 0
			 },
		'27465': {
				'color': 'beetroot', 
				'song' : 'rain.mp3',
				'proximity_buffer' : [],
				'proximity' : 0,
				'gain' : 0
			 }
	};

sendOSCMessage("/setup", [JSON.stringify(beacons)]);

/*
	Beacon Scanning
*/
var startBeacons = function	() {
	console.log("Starting beacons.");

	var uuid = 'b9407f30f5f8466eaff925556b57fe6d';
	Bleacon.startScanning(uuid);

	Bleacon.on('discover', function(bleacon) {
		const AVG_SIZE = 10;
		const PROX_THRESH = 0.3;
		const GAIN_DEL = 0.05;
		const ALPHA = 0.7;
		var beacon = beacons[bleacon.major];

		if(beacon){
			if(beacon.proximity_buffer.length < AVG_SIZE) beacon.proximity_buffer.push(bleacon.accuracy);
			else {
				beacon.proximity_buffer.shift();
				beacon.proximity_buffer.push(bleacon.accuracy);
			}
			var oldProximity = beacon.proximity;
			// var newProximity = _.sum(beacon.proximity_buffer) / beacon.proximity_buffer.length;
			var newProximity = (ALPHA * bleacon.accuracy) + ((1-ALPHA) * oldProximity);
			var del = newProximity - oldProximity;

			if(Math.abs(del) < PROX_THRESH) setVolume(bleacon.major, newProximity);		
			
			beacon.proximity = newProximity;
			//console.log('Found beacon: ' + beacon.color + ' at proximity ' + bleacon.accuracy + 'm away.'); 
		}
	});
}

var setVolume = function (major, newProximity) {
	var range1 = [0.3, 1.3];
	var range2 = [100, 20];
	var volume = 0;

	if(newProximity < range1[0]) volume = 100;
	else if(newProximity > range1[1]) volume = 0;
	else volume = convertRange(newProximity, range1, range2);

	console.log('Proximity', newProximity, 'Volume', volume);

	sendOSCMessage('/setGain', [major, volume]);
}

var convertRange = function( value, r1, r2 ) { 
    return ( value - r1[ 0 ] ) * ( r2[ 1 ] - r2[ 0 ] ) / ( r1[ 1 ] - r1[ 0 ] ) + r2[ 0 ];
}