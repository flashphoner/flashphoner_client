$(document).ready(function () {
    loadChatFieldSet();
});

// Include Filed Set HTML
function loadChatFieldSet(){
    $("#chatFieldSet").load("include/Chat-fieldset.html",loadCallControls);
}

// Include Chat Controls HTML
function loadCallControls(){
    $("#chatControls").load("include/Chat-controls.html", initOnLoad);
}

function initOnLoad() {
    if (!$("#roomChat").length) {
        $("#showRoom").hide();
    } else {
        $("#showTo").hide();
    }

    $("#connectBtn").click(function () {
            if ($(this).text() == "Connect") {
                connect();
            } else {
                disconnect();
            }
        }
    );

    $("#sendBtn").prop('disabled', true);

    // Set websocket URL
    setURL();
}

//Get API instance
var f = Flashphoner.getInstance();

function initAPI() {
    //add listeners
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);
    f.addListener(WCSEvent.OnDataEvent, dataEventListener);
    f.init();
}



function disconnect() {
    f.disconnect();
}

///////////////////////////////////////////
//////////////Listeners////////////////////
function connectionStatusListener(event) {
    if (event.status == ConnectionStatus.Established) {
        console.log('Connection has been established.');
        $("#connectBtn").text("Disconnect");
        $("#sendBtn").prop('disabled', false);
    } else if (event.status == ConnectionStatus.Disconnected) {
        console.log("Disconnected");
        $("#connectBtn").text("Connect");
        $("#sendBtn").prop('disabled', true);
    } else if (event.status == ConnectionStatus.Failed) {
        $("#connectBtn").text("Connect");
        f.disconnect();
        $("#sendBtn").prop('disabled', true);
    }
    setConnectionStatus(event.status);
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


function dataEventListener(event) {
    var date = new Date();
    var time = date.getHours() + ":" + (date.getMinutes()<10?'0':'') + date.getMinutes();
    var message = event.payload;
    var newMessage = time + " " + message.from + " - " + message.body + '<br/>';
    var chat = document.getElementById("chat");
    chat.innerHTML = newMessage + chat.innerHTML;
}

// Set connection status and display corresponding view
function setConnectionStatus(status) {

    $("#connectionStatus").text(status);
    $("#connectionStatus").className='';

    if (status == "ESTABLISHED") {
        $("#connectionStatus").attr("class","text-success");
    }

    if (status == "DISCONNECTED") {
        $("#connectionStatus").attr("class","text-muted");
    }

    if (status == "FAILED") {
        $("#connectionStatus").attr("class","text-danger");
    }
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

//Get field
function field(name) {
    var field = document.getElementById(name).value;
    return field;
}