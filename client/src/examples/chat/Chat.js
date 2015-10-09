//Get API instance
var f = Flashphoner.getInstance();

//get player instance
var wsPlayer;

//Current stream
var currentStream = {};
var currentPublishStream = {};

var mediaProvider;

function initOnLoad() {
    //add listeners
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    f.addListener(WCSEvent.OnBinaryEvent, binaryListener);
    f.addListener(WCSEvent.OnDataEvent, dataEventListener);
    var configuration = new Configuration();
    configuration.remoteMediaElementId = 'remoteVideo';
    configuration.localMediaElementId = 'localVideo';
    configuration.elementIdForSWF = "flashVideoDiv";
    configuration.pathToSWF = "../../dependencies/flash/MediaManager.swf";
    f.init(configuration);

    var mediaProviderEl = document.getElementById("mediaProvider");

    var isOpera = !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
    if (isOpera) {
        mediaProviderEl.remove(0);
    } else if (Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0) {
        mediaProviderEl.remove(0);
    } else if (/*@cc_on!@*/false || !!document.documentMode) {
        mediaProviderEl.remove(0);
    }
}

function login() {
    var mediaProviderEl = document.getElementById("mediaProvider");
    mediaProvider = mediaProviderEl.options[mediaProviderEl.selectedIndex].value;
    mediaProviderEl.disabled = true;
    document.getElementById("loginButton").disabled = true;

    var useWsTunnel;

    if (MediaProvider.WebRTC == mediaProvider) {
        useWsTunnel = false;
        document.getElementById('remoteVideo').style.visibility = "visible";
        document.getElementById('flashVideoWrapper').style.visibility = "hidden";
        document.getElementById('flashVideoDiv').style.visibility = "hidden";
        document.getElementById('remoteVideoCanvas').style.visibility = "hidden";
    } else if (MediaProvider.Flash == mediaProvider) {
        useWsTunnel = false;
        document.getElementById('remoteVideo').style.visibility = "hidden";
        document.getElementById('flashVideoWrapper').style.visibility = "visible";
        document.getElementById('remoteVideoCanvas').style.visibility = "hidden";
    } else {
        useWsTunnel = true;
        document.getElementById('remoteVideo').style.visibility = "hidden";
        document.getElementById('flashVideoWrapper').style.visibility = "hidden";
        document.getElementById('flashVideoDiv').style.visibility = "hidden";
        document.getElementById('remoteVideoCanvas').style.visibility = "visible";
    }

    //connect to server
    f.connect({
        login: document.getElementById("login").value,
        urlServer: document.getElementById("server").value,
        appKey: "websocketChatApp",
        useWsTunnel: useWsTunnel,
        useBase64BinaryEncoding: false
    });
}

///////////////////////////////////////////
//////////////Listeners////////////////////
function connectionStatusListener(event) {
    console.log(event.status);
    if (event.status == ConnectionStatus.Established) {
        console.log('Connection has been established.');
        document.getElementById("logoutButton").disabled = false;
        document.getElementById("playButton").disabled = false;
        document.getElementById("publishButton").disabled = false;
        document.getElementById("sendButton").disabled = false;
    } else if (event.status == ConnectionStatus.Disconnected) {
        if (wsPlayer) {
            wsPlayer.stop();
        }
        currentStream = {};
        console.log("Disconnected");
        document.getElementById("logoutButton").disabled = true;
        document.getElementById("loginButton").disabled = false;
        document.getElementById("playButton").disabled = true;
        document.getElementById("sendButton").disabled = true;
        document.getElementById("stopButton").disabled = true;
        document.getElementById("publishButton").disabled = true;
        document.getElementById("unpublishButton").disabled = true;
    } else if (event.status == ConnectionStatus.Failed) {
        if (wsPlayer != null) {
            wsPlayer.stop();
        }
        currentStream = {};
        writeInfo("CONNECTION FAILED");
        f.disconnect();

        document.getElementById("logoutButton").disabled = true;
        document.getElementById("loginButton").disabled = false;
        document.getElementById("playButton").disabled = true;
        document.getElementById("publishButton").disabled = true;
        document.getElementById("sendButton").disabled = true;
        document.getElementById("stopButton").disabled = true;
    }
}

function binaryListener(event) {
    if (wsPlayer) {
        wsPlayer.onDataReceived(event);
    }
}

//Connection Status
function streamStatusListener(event) {
    console.log(event.status);
    var isPublishStream = currentPublishStream.name != undefined && currentPublishStream.name == event.name;
    if (event.status == StreamStatus.Failed) {
        if (wsPlayer && !isPublishStream) {
            wsPlayer.stop();
        }
    } else if (event.status == StreamStatus.Stoped) {
        if (wsPlayer && !isPublishStream) {
            wsPlayer.stop();
        }
    }
    writeInfo("Stream " + event.status);
    if (isPublishStream) {
        currentPublishStream.status = event.status;
    } else {
        currentStream.status = event.status;
    }
}

//Error
function errorEvent(event) {
    console.log(event.info);
    if (wsPlayer) {
        wsPlayer.stop();
    }
}
//////////////////////////////////////////

function playWSStream() {
    var canvas = document.getElementById('remoteVideoCanvas');
    wsPlayer = new WebsocketPlayer(canvas, function (e) {
            if (e.unmute != undefined) {
                if (currentStream.status == StreamStatus.Paused) {
                    f.playStream(currentStream);
                    console.log("Request stream back");
                }
            } else if (e.mute != undefined) {
                if (currentStream.status == StreamStatus.Playing) {
                    f.pauseStream(currentStream);
                    console.log("pauseStream")
                }
            }
        }.bind(this),
        function (str) {
            this.writeInfo(str);
        }.bind(this)
    );

    var config = new Configuration();
    config.videoWidth = 320;
    config.videoHeight = 240;
    wsPlayer.init(config);

    wsPlayer.playFirstSound();

    var stream = new Stream();
    stream.name = "stream-" + document.getElementById("to").value;
    stream.hasVideo = true;
    stream.sdp = "v=0\r\n" +
        "o=- 1988962254 1988962254 IN IP4 0.0.0.0\r\n" +
        "c=IN IP4 0.0.0.0\r\n" +
        "t=0 0\r\n" +
        "a=sdplang:en\r\n" +
        "m=video 0 RTP/AVP 32\r\n" +
        "a=rtpmap:32 MPV/90000\r\n" +
        "a=recvonly\r\n" +
        "m=audio 0 RTP/AVP 0\r\n" +
        "a=rtpmap:0 PCMU/8000\r\n" +
        "a=recvonly\r\n";
    currentStream = f.playStream(stream);
}

function playStream() {
    var stream = new Stream();
    stream.name = "stream-" + document.getElementById("to").value;
    stream.hasVideo = true;

    currentStream = f.playStream(stream);
}

function writeInfo(str) {
    console.log(str);
}

function sendMessage() {
    var message = {to: document.getElementById("to").value, body: document.getElementById("message").value};
    f.sendData({
        operationId: createUUID(),
        payload: message
    });
    var chat = document.getElementById("chat");
    chat.value += "I: " + message.body + "\n";
}

function dataEventListener(event) {
    var message = event.payload;
    var chat = document.getElementById("chat");
    chat.value += message.from + ": " + message.body + "\n";
}

$(document).ready(function () {
    $("#loginButton").click(function () {
        login();
    });

    $("#sendButton").click(function () {
        sendMessage();
    });

    $("#playButton").click(function () {
        if (currentStream.status != undefined && currentStream.status != StreamStatus.Stoped && currentStream.status != StreamStatus.Failed && currentStream.status != StreamStatus.Paused) {
            return;
        }
        if (MediaProvider.WebRTC == mediaProvider || MediaProvider.Flash == mediaProvider) {
            playStream();
        } else {
            playWSStream();
        }
        document.getElementById("playButton").disabled = true;
        document.getElementById("stopButton").disabled = false;
    });

    $("#stopButton").click(function () {
        f.stopStream(currentStream);
        document.getElementById("playButton").disabled = false;
        document.getElementById("stopButton").disabled = true;
    });

    $("#logoutButton").click(function () {
        f.disconnect();
    });

    $("#publishButton").click(function () {
        if (currentPublishStream.status != undefined && currentPublishStream.status != StreamStatus.Stoped && currentPublishStream.status != StreamStatus.Failed && currentPublishStream.status != StreamStatus.Unpublished) {
            return;
        }
        var streamName = "stream-" + document.getElementById("login").value;
        currentPublishStream.name = streamName;
        f.publishStream({name: streamName, hasVideo: true});
        document.getElementById("publishButton").disabled = true;
        document.getElementById("unpublishButton").disabled = false;
    });

    $("#unpublishButton").click(function () {
        var streamName = "stream-" + document.getElementById("login").value;
        f.unPublishStream({name: streamName});
        document.getElementById("publishButton").disabled = false;
        document.getElementById("unpublishButton").disabled = true;
    });

});
