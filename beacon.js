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

const ZONE_BUFFER = 3;
var beacons = {
		'12424': {
				'color': 'lemon', 
				'song' : 'birds.mp3',
				'proximity_buffer' : [],
				'proximity' : 0,
				'lastDatapoint' : Date.now(),
				'zones' : [0, 0, 0, ZONE_BUFFER],
				'zone' : 3
			 },
		'51679': {
				'color': 'candy', 
				'song' : 'ocean.mp3',
				'proximity_buffer' : [],
				'proximity' : 0,
				'lastDatapoint' : Date.now(),
				'zones' : [0, 0, 0, ZONE_BUFFER],
				'zone' : 3
			 },
		'27465': {
				'color': 'beetroot', 
				'song' : 'rain.mp3',
				'proximity_buffer' : [],
				'proximity' : 0,
				'lastDatapoint' : Date.now(),
				'zones' : [0, 0, 0, ZONE_BUFFER],
				'zone' : 3
			 }
	};

sendOSCMessage("/setup", [JSON.stringify(beacons)]);

/*
	Beacon Scanning
*/
var startBeacons = function	() {
	console.log("Starting beacons.");

	var uuid = 'b9407f30f5f8466eaff925556b57fe6d';

	Bleacon.startScanning(uuid, 27465);

	Bleacon.on('discover', function(bleacon) {
		var beacon = beacons[bleacon.major];
		if(beacon) setProximity(beacon, bleacon);
		console.log(bleacon.accuracy);
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
	var newProximity = _.sum(beacon.proximity_buffer) / beacon.proximity_buffer.length;
	
	/*
		Exponential Smoothing
	*/
	// var newProximity = (ALPHA * bleacon.accuracy) + ((1-ALPHA) * oldProximity);

	if(beacon.proximity_buffer.length < AVG_SIZE && beacon.proximity_buffer.length != 0) beacon.proximity_buffer.push(bleacon.accuracy);
	else {
		beacon.proximity_buffer.shift();
		beacon.proximity_buffer.push(bleacon.accuracy);
	}

	beacon.proximity = newProximity;

	setVolume(bleacon.major, newProximity);
}

var setVolume = function (major, newProximity) {
	const TIMEOUT = 1000; // in milliseconds
	var zone0 = 0.5;
	var zone1 = 1.0;
	var zone2 = 1.5;
	var beacon = beacons[major];


	if(beacon.dataTimestamp - Date.now() > TIMEOUT) updateZones(major, beacon, 3);
	else if(newProximity <= zone0) updateZones(major, beacon, 0);
	else if(newProximity > zone0 && newProximity <= zone1) updateZones(major, beacon, 1);
	else if(newProximity > zone1 && newProximity <= zone2) updateZones(major, beacon, 2);
	else updateZones(major, beacon, 3);

	beacon.dataTimestamp = Date.now();
}

var updateZones = function(major, beacon, except) {
	for(var i = 0; i < beacon.zones.length; i++) {
		if(i != except) beacon.zones[i] = _.max([beacon.zones[i] - 1, 0]);
		else beacon.zones[i] = _.min([beacon.zones[i] + 1, ZONE_BUFFER]);
	}

	console.log(major, beacon.zones);

	if(beacon.zones[beacon.zone] == 0) {
		for(var i = 0; i < beacon.zones.length; i++) {
			if(beacon.zones[i] == ZONE_BUFFER) {
				switchZone(major, beacon, i);
				beacon.zone = i;
				beacon.zones = [0, 0, 0, 0];
				beacon.zones[i] = ZONE_BUFFER;
			}
		}
	}
}

var switchZone = function(major, beacon, zone) {
	const FADE_TIME = 2000; // in milliseconds
	const ZONE_VOLUMES = [40, 25, 10, 0];
	var fade_del = FADE_TIME / Math.abs(ZONE_VOLUMES[beacon.zone] - ZONE_VOLUMES[zone]); 
	var vol_del = Math.sign(ZONE_VOLUMES[zone] - ZONE_VOLUMES[beacon.zone]);

	var timeout = 0;
	for(var i = 0; i < (Math.abs(ZONE_VOLUMES[beacon.zone] - ZONE_VOLUMES[zone])); i++){
		setTimeout(function(){
			sendOSCMessage("/setGain", [major, vol_del]);
		}, timeout + fade_del);
		timeout += fade_del;
	}
}

var convertRange = function( value, r1, r2 ) { 
    return ( value - r1[ 0 ] ) * ( r2[ 1 ] - r2[ 0 ] ) / ( r1[ 1 ] - r1[ 0 ] ) + r2[ 0 ];
}
