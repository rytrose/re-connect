import threading
import OSC
import vlc
import json


class Player:
    def __init__(self):
        self.beaconServer = OSC.OSCServer(('127.0.0.1', 7500))
        self.beaconServerThread = threading.Thread(target=self.beaconServer.serve_forever)
        self.beaconServerThread.daemon = False
        self.beaconServerThread.start()

        self.beaconClient = OSC.OSCClient()
        self.beaconClient.connect(('127.0.0.1', 7400))
        self.beaconServer.addMsgHandler("/setup", self.setupResponder)
        self.beaconServer.addMsgHandler("/setGain", self.setGainResponder)

        self.beacons = {}
        self.playing = ''

    def sendOSCMessage(self, addr, *msgArgs):
        msg = OSC.OSCMessage()
        msg.setAddress(addr)
        msg.append(*msgArgs)
        self.beaconClient.send(msg)

    def setupResponder(self, addr, tags, stuff, source):
        beacs = json.loads(stuff[0])  # dictionary of beacon information

        for beacon in beacs:
            self.beacons[beacon] = beacs[beacon]
            vlc_instance = vlc.Instance()
            player = vlc_instance.media_player_new()
            media = vlc_instance.media_list_new([self.beacons[beacon]['song']])
            mlp = vlc_instance.media_list_player_new()
            mlp.set_media_player(player)
            mlp.set_media_list(media)
            mlp.set_playback_mode(vlc.PlaybackMode.loop)
            self.beacons[beacon]['mlp'] = mlp
            self.beacons[beacon]['player'] = player
            self.playing = beacon

        self.beacons[self.playing]['mlp'].play()
        self.beacons[self.playing]['player'].audio_set_volume(0)
        self.sendOSCMessage("/startBeacons", ["start"])

    def setGainResponder(self, addr, tags, stuff, source):
        beacon_major = stuff[0]
        gain = stuff[1]
        self.beacons[str(int(beacon_major))]['gain'] = gain

        toPlay = ''
        maxGain = -1

        for major, beacon in self.beacons.iteritems():
            if beacon['gain'] > maxGain:
                toPlay = major
                maxGain = beacon['gain']

        if self.playing == toPlay:
            print "Gain of " + self.beacons[self.playing]['song'] + ': ' + str(int(maxGain))
            self.beacons[self.playing]['player'].audio_set_volume(int(maxGain))
        else:
            self.beacons[self.playing]['mlp'].pause()
            self.beacons[self.playing]['player'].audio_set_volume(0)
            self.playing = toPlay
            self.beacons[self.playing]['player'].audio_set_volume(int(maxGain))
            self.beacons[self.playing]['mlp'].play()
            print "Gain of " + self.beacons[self.playing]['song'] + ': ' + str(int(maxGain))

if __name__ == "__main__":
    p = Player()
