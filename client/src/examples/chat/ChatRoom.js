//Get API instance
var f = Flashphoner.getInstance();

//Current stream
var currentStream = {};

function initOnLoad() {
    //add listeners
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    f.addListener(WCSEvent.OnDataEvent, dataEventListener);
    var configuration = new Configuration();
    configuration.localMediaElementId = 'localVideo';
    configuration.remoteMediaElementId = 'remoteVideo';
    f.init(configuration);
}

function login() {

    document.getElementById("loginButton").disabled = true;
    document.getElementById("login").disabled = true;
    document.getElementById("room").disabled = true;

    var useRTCSessions, useWsTunnel;
    useRTCSessions = true;
    useWsTunnel = false;

    //connect to server
    f.connect({
        login: document.getElementById("login").value,
        room: document.getElementById("room").value,
        urlServer: document.getElementById("server").value,
        appKey: "chatRoomApp",
        useRTCSessions: useRTCSessions,
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
        document.getElementById("publishButton").disabled = false;
        document.getElementById("playButton").disabled = false;
        document.getElementById("sendButton").disabled = false;
    } else if (event.status == ConnectionStatus.Disconnected) {
        currentStream = {};
        console.log("Disconnected");
        document.getElementById("logoutButton").disabled = true;
        document.getElementById("loginButton").disabled = false;
        document.getElementById("login").disabled = false;
        document.getElementById("room").disabled = false;
        document.getElementById("publishButton").disabled = true;
        document.getElementById("unpublishButton").disabled = true;
        document.getElementById("playButton").disabled = true;
        document.getElementById("sendButton").disabled = true;
        document.getElementById("stopButton").disabled = true;
    } else if (event.status == ConnectionStatus.Failed) {
        currentStream = {};
        console.log("Connection failed");

        f.disconnect();

        document.getElementById("logoutButton").disabled = true;
        document.getElementById("loginButton").disabled = false;
        document.getElementById("login").disabled = false;
        document.getElementById("room").disabled = false;
        document.getElementById("publishButton").disabled = true;
        document.getElementById("unpublishButton").disabled = true;
        document.getElementById("playButton").disabled = true;
        document.getElementById("sendButton").disabled = true;
        document.getElementById("stopButton").disabled = true;
    }
}

//Connection Status
function streamStatusListener(event) {
    console.log("Stream " + event.status);
    if (event.status == StreamStatus.Failed) {
    } else if (event.status == StreamStatus.Stoped) {
    }
    currentStream.status = event.status;
}

//Error
function errorEvent(event) {
    console.log(event.info);
}
//////////////////////////////////////////

//Publish stream
function publishStream(){
    var streamName = "stream-" + document.getElementById("login").value;
    f.publishStream({name:streamName, hasVideo:true});
}

//Stop stream publishing
function unPublishStream(){
    var streamName = "stream-" + document.getElementById("login").value;
    f.unPublishStream({name:streamName});
}

function playWebRTCStream() {
    var stream = new Stream();
    stream.name = "stream-" + document.getElementById("to").value;
    stream.hasVideo = true;

    currentStream = f.playStream(stream);
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

        playWebRTCStream();

        document.getElementById("playButton").disabled = true;
        document.getElementById("stopButton").disabled = false;
    });

    $("#stopButton").click(function () {
        f.stopStream(currentStream);
        document.getElementById("playButton").disabled = false;
        document.getElementById("stopButton").disabled = true;
    });

    $("#publishButton").click(function () {
        publishStream();
        document.getElementById("publishButton").disabled = true;
        document.getElementById("unpublishButton").disabled = false;
    });

    $("#unpublishButton").click(function () {
        unPublishStream();
        document.getElementById("publishButton").disabled = false;
        document.getElementById("unpublishButton").disabled = true;
    });

    $("#logoutButton").click(function () {
        f.disconnect();
    });

});
