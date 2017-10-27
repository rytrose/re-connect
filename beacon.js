var _ = require('lodash');
var Bleacon = require('bleacon');
var groove = require('groove');

var uuid = 'b9407f30f5f8466eaff925556b57fe6d';
Bleacon.startScanning(uuid);
var beacons = {
	'12424': {
			'color': 'lemon', 
			'song' : 'birds.mp3',
			'proximity_buffer' : [],
			'proximity' : 0,
			'gain' : 0,
			'playlist' : groove.createPlaylist(),
			'player' : groove.createPlayer()
		 },
	'51679': {
			'color': 'candy', 
			'song' : 'ocean.mp3',
			'proximity_buffer' : [],
			'proximity' : 0,
			'gain' : 0,
			'playlist' : groove.createPlaylist(),
			'player' : groove.createPlayer()
		 },
	'27465': {
			'color': 'beetroot', 
			'song' : 'rain.mp3',
			'proximity_buffer' : [],
			'proximity' : 0,
			'gain' : 0,
			'playlist' : groove.createPlaylist(),
			'player' : groove.createPlayer()
		 }
}

var devices = groove.getDevices();
var defaultDevice = devices[0];

var playAudio = function(player, playlist) {
	player.attach(playlist, function(err){
		if(err) console.log(err);
	});
}

var loadAudio = function() {
	_.forEach(beacons, function(beacon){
		beacon.player.device = defaultDevice;
		groove.open(beacon.song, function(err, file) {
			if(err) return console.log(err);
			beacon.playlist.insert(file);
			console.log('Loaded song ' + beacon.song + ' for ' + beacon.color);
		});
		beacon.playlist.setGain(0.0);
		playAudio(beacon.player, beacon.playlist);
	});
}

loadAudio();

var setVolume = function(beacon, proximity){
	var gain = 1.3 - proximity;
	beacon.playlist.setGain(Math.max(0,gain));
}

Bleacon.on('discover', function(bleacon) {
	const AVG_SIZE = 10;
	const PROX_THRESH = 0.2;
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
		var newProximity = _.sum(beacon.proximity_buffer) / beacon.proximity_buffer.length;
		var newProximity = (ALPHA * newProximity) + ((1-ALPHA) * oldProximity);
		var del = newProximity - oldProximity;

		if(Math.abs(del) < PROX_THRESH) setVolume(beacon, newProximity)		
		// console.log('Gain for ' + beacon.color + ': ' + beacon.playlist.gain);

		beacon.proximity = newProximity;
		console.log('Found beacon: ' + beacon.color + ' at proximity ' + bleacon.accuracy + 'm away.');
	}
});