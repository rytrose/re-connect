import threading
import OSC
import vlc
import json
import urllib2, urllib
import random
import time

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
        self.pdClient = OSC.OSCClient()
        self.pdClient.connect(('127.0.0.1', 5000))

        self.beacons = {}

        self.play = False;

    def sendOSCMessage(self, addr, client=0, *msgArgs):
        msg = OSC.OSCMessage()
        msg.setAddress(addr)
        msg.append(*msgArgs)
        if client == 0:
            self.beaconClient.send(msg)
        else:
            self.pdClient.send(msg)

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
            self.beacons[beacon]['player'].audio_set_volume(10)

        self.beacons['27465']['mlp'].play()

        self.sendOSCMessage("/startBeacons", 0, ["start"])

    def setGainResponder(self, addr, tags, stuff, source):
        beacon_major = stuff[0]
        gain = stuff[1]
        beacon = self.beacons[str(int(beacon_major))]
        beacon['gain'] = int(round(gain))
        print "Setting volume of", beacon['color'], "to:", str(beacon['player'].audio_get_volume() + int(round(gain)))
        beacon['player'].audio_set_volume(beacon['player'].audio_get_volume() + int(round(gain)))

    def getWeather(self):
        baseurl = "https://query.yahooapis.com/v1/public/yql?"
        yql_query = "select * from weather.forecast where woeid=2357024"
        yql_url = baseurl + urllib.urlencode({'q': yql_query}) + "&format=json"
        result = urllib2.urlopen(yql_url).read()
        data = json.loads(result)
        temp = data['query']['results']['channel']['item']['condition']['temp']
        wind_speed = data['query']['results']['channel']['wind']['speed']
        humidity = data['query']['results']['channel']['atmosphere']['humidity']
        return temp, wind_speed, humidity

    def playGenerative(self):
        temp, wind_speed, humidity = self.getWeather()
        self.genThread = GenThread(temp, wind_speed, humidity)
        self.genThread.daemon = True
        self.genThread.start()

    def stopGenerative(self):
        self.genThread.stop()

class GenThread(threading.Thread):
    def __init__(self, temp, wind_speed, humidity):
        threading.Thread.__init__(self)
        self.pdClient = OSC.OSCClient()
        self.pdClient.connect(('127.0.0.1', 5000))
        self.temp = temp
        self.wind_speed = wind_speed
        self.humidity = humidity
        self.play = True

    def sendOSCMessage(self, addr, *msgArgs):
        msg = OSC.OSCMessage()
        msg.setAddress(addr)
        msg.append(*msgArgs)
        self.pdClient.send(msg)

    def run(self):
        scale = self.getScale(80, 12)
        speeds = self.getSpeeds(30)
        # scale = self.getScale(self.temp, self.humidity)
        # speeds = self.getSpeeds(self.wind_speed)

        while self.play:
            note = random.choice(scale)
            speed = random.choice(speeds)
            self.sendOSCMessage("/play", note)
            time.sleep(speed)

    def stop(self):
        self.play = False

    def getScale(self, temp, hum):
        temperature = int(temp)
        humidity = int(hum)

        if temperature < 21:
            # Octotonic
            scale = [0, 1, 3, 4, 6, 7, 9, 10, 12]
        elif temperature > 20 and temperature < 32:
            # Harmonic minor
            scale = [0, 2, 3, 5, 7, 8, 10, 12]
        elif temperature > 31 and temperature < 61:
            # Major
            scale = [0, 2, 4, 5, 7, 9, 11, 12]
        elif temperature > 60 and temperature < 81:
            # Pentatonic
            scale = [0, 2, 4, 7, 9, 12]
        else:
            # Wholetone
            scale = [0, 2, 4, 6, 8, 10, 12]

        if humidity < 33:
            start = random.choice(range(36, 49))
        elif humidity > 32 and humidity < 66:
            start = random.choice(range(48, 61))
        else:
            start = random.choice(range(60, 83))

        finalScale = [note + start for note in scale]
        return finalScale

    def getSpeeds(self, wind_speed):
        initial_speed = float(4) / int(wind_speed)
        speed_del = initial_speed / 20
        speeds = [initial_speed + (i * speed_del) for i in range(-5, 6)]
        return speeds

if __name__ == "__main__":
    p = Player()
    p.playGenerative()
