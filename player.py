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
            self.beacons[beacon]['player'].audio_set_volume(0)
            
        self.beacons['27465']['mlp'].play()

        self.sendOSCMessage("/startBeacons", ["start"])

    def setGainResponder(self, addr, tags, stuff, source):
        beacon_major = stuff[0]
        gain = stuff[1]
        beacon = self.beacons[str(int(beacon_major))]
        beacon['gain'] = int(round(gain))
        print "Setting volume of", beacon['color'], "to:", str(beacon['player'].audio_get_volume() + int(round(gain)))
        beacon['player'].audio_set_volume(beacon['player'].audio_get_volume() + int(round(gain)))

if __name__ == "__main__":
    p = Player()
