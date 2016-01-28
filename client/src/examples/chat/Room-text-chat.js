//Get API instance
var f = Flashphoner.getInstance();

function initOnLoad() {
    setURL();
    //add listeners
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    f.addListener(WCSEvent.OnDataEvent, dataEventListener);
    f.init();
}

function connect() {
    f.connect({
        login: document.getElementById("login").value,
        room: document.getElementById("room").value,
        urlServer: document.getElementById("urlServer").value,
        appKey: "chatRoomApp"
    });
}

function disconnect() {
    f.disconnect();
}

///////////////////////////////////////////
//////////////Listeners////////////////////
function connectionStatusListener(event) {
    console.log("connectionStatus >> " + event.status);
    if (event.status == ConnectionStatus.Established) {
        console.log('Connection has been established.');
        $("#connectBtn").hide();
        $("#disconnectBtn").show();
    } else if (event.status == ConnectionStatus.Disconnected) {
        console.log("Disconnected");
        $("#connectBtn").show();
        $("#disconnectBtn").hide();
    } else if (event.status == ConnectionStatus.Failed) {
        $("#connectBtn").show();
        $("#disconnectBtn").hide();
        f.disconnect();
    }
    $("#connectionStatus").text(event.status);
}

//Connection Status
function streamStatusListener(event) {
    console.log(event.status);
}

//Error
function errorEvent(event) {
    console.log(event.info);
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
    document.getElementById("message").value = "";
}

function dataEventListener(event) {
    var date = new Date();
    var time = date.getHours() + ":" + (date.getMinutes()<10?'0':'') + date.getMinutes();
    var message = event.payload;
    $("#chat").val(time + " " + message.from + " - " + message.body + "\n" + $("#chat").val());
}

//Set WCS URL
function setURL() {
    var proto;
    var url;
    var port;
    if (window.location.protocol == "http:") {
        proto = "ws://"
        port = "8080"
    } else {
        proto = "wss://"
        port = "8443"
    }

    url = proto + window.location.hostname + ":" + port;
    document.getElementById("urlServer").value = url;
}

