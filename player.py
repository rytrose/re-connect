import threading
import OSC

class Player:
    def __init__(self):
        self.beaconServer = OSC.OSCServer(('127.0.0.1', 7500))
        self.beaconServerThread = threading.Thread(target=self.beaconServer.serve_forever)
        self.beaconServerThread.daemon = False
        self.beaconServerThread.start()

        self.beaconClient = OSC.OSCClient()
        self.beaconClient.connect(('127.0.0.1', 7400))

        self.beaconServer.addMsgHandler("/test", self.testResponder)

    def sendOSCMessage(self, addr, *msgArgs):
        msg = OSC.OSCMessage()
        msg.setAddress(addr)
        msg.append(*msgArgs)
        self.beaconClient.send(msg)
        print "Sent message. -python"

    def testResponder(self, addr, tags, stuff, source):
        print stuff
        self.sendOSCMessage('/test', ['Did you get this message?', 'Didja?'])

if __name__ == "__main__":
	p = Player()