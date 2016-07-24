//Get API instance
var f = Flashphoner.getInstance();
var clientId;
var login;
var roomName;
$(document).ready(function () {
    $("#connectionFieldSet").load("connect-fieldset.html", initOnLoad);
});

function retrieveRoomName() {
    var address = window.location.toString();
    var pattern = /https?:\/\/.*\?roomName\=(.*)/;
    var match = address.match(pattern);
    if (match) {
        return match[1];
    } else {
        return null;
    }
}

function initOnLoad() {
    if (detectBrowser() == "Android" || detectBrowser() == "iOS") {
        for (var i = 0; i < 3; i++) {
            $("#mobile").append("<div class=\"row-space\">&nbsp</div>");
        }
    }

    $("#connectBtn").click(function () {
            if ($(this).text() == "Connect") {
                if (connect()) {
                    $(this).prop('disabled',true);
                }
            } else {
                disconnect();
                $(this).prop('disabled',true);
            }

        }
    );

    $("#publishBtn").prop('disabled', true).click(function () {
            var state = $("#publishBtn").text();
            if (state == "Start") {
                publishStream();
            } else {
                unPublishStream();
            }
            $(this).prop('disabled', true);
        }
    );

    // Set websocket URL
    setURL();

    //add listeners
    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.StreamStatusEvent, streamStatusListener);

    if (detectIE()) {
        detectFlash();
    }
    // Configure remote and local video elements
    var configuration = new Configuration();
    configuration.remoteMediaElementId = 'remoteVideo';
    configuration.localMediaElementId = 'localVideo';
    configuration.elementIdForSWF = "flashVideoDiv";
    configuration.pathToSWF = "../../../dependencies/flash/MediaManager.swf";
    configuration.flashBufferTime = 0.0;

    f.init(configuration);

    // Hide WebRTC elements for IE and Flash based browsers. Hide flash elements for WebRTC based browsers.
    if (webrtcDetectedBrowser) {
        document.getElementById('remoteVideo').style.visibility = "visible";
        document.getElementById('flashVideoWrapper').style.visibility = "hidden";
        document.getElementById('flashVideoDiv').style.visibility = "hidden";
    } else {
        document.getElementById('remoteVideo').style.visibility = "hidden";
        document.getElementById('flashVideoWrapper').style.visibility = "visible";
        document.getElementById('localVideo').style.visibility = "hidden";
    }
}


function connect() {
    if (!checkForEmptyField('#login', '#loginForm')) {
        return false;
    }
    login = field("login").replace(/\s+/g, '');
    clientId = createUUID();
    f.connect({
        clientId: clientId,
        login: login,
        urlServer: field("urlServer"),
        appKey: 'defaultApp',
        width:0,
        height:0
    });
}

var currentStream;

//Publish stream
function publishStream() {
    $("#downloadDiv").hide();
    var streamName = "stream-" + clientId;
    currentStream = {name: streamName};
    f.publishStream(currentStream);
}

//Stop stream publishing
function unPublishStream() {
    var streamName = "stream-" + clientId;
    f.unPublishStream(currentStream);
    currentStream = null;
}


function disconnect() {
    f.disconnect();
}

function mute() {
    if (currentStream) {
        f.mute(currentStream.mediaProvider);
    }
}

// Unmute audio in the call
function unmute() {
    if (currentStream) {
        f.unmute(currentStream.mediaProvider);
    }
}

// Mute video in the call
function muteVideo() {
    if (currentStream) {
        f.muteVideo(currentStream.mediaProvider);
    }
}

// Unmute video in the call
function unmuteVideo() {
    if (currentStream) {
        f.unmuteVideo(currentStream.mediaProvider);
    }
}

///////////////////////////////////////////
//////////////Listeners////////////////////
function connectionStatusListener(event) {
    if (event.status == ConnectionStatus.Established) {
        console.log('Connection has been established.');
        $("#connectBtn").text("Disconnect").prop('disabled', false);
        $("#publishBtn").prop('disabled', false);
        roomName = retrieveRoomName();
        if (!roomName) {
            roomName = createUUID();
        }
        setInviteLink();

        f.subscribeRoom(roomName, roomStatusEventListener, this);
    } else if (event.status == ConnectionStatus.Disconnected || event.status == ConnectionStatus.Failed) {
        $("#connectBtn").text("Connect").prop('disabled', false);
        $("#publishBtn").text("Start").prop('disabled', true);
        setPublishStatus("");
        $("#muteAudioToggle").prop('checked',false).attr('disabled','disabled').trigger('change');
        $("#muteVideoToggle").prop('checked',false).attr('disabled','disabled').trigger('change');
        currentStream = null;
        var participantEl = $(".participant").first();
        if (participantEl) {
            participantEl.find(".p-login").text("Offline");
            participantEl.find(".fp-userState").removeClass("online").removeClass("streaming");
            participantEl.addClass("free").removeAttr("login").removeAttr("stream");
            var video = participantEl.find("video").get(0);
            video.pause();
            video.src = '';
        }
    }
    if (event.status == ConnectionStatus.Failed) {

        f.disconnect();
    }
    setConnectionStatus(event.status);
}

function streamStatusListener(event) {
    if (event.published) {
        trace("streamStatusListener >> " + event.status);
        switch (event.status) {
            case StreamStatus.Publishing:
                setPublishStatus(event.status);
                $("#publishBtn").text("Stop").prop('disabled', false);
                var $muteAudioToggle = $("#muteAudioToggle");
                var $muteVideoToggle = $("#muteVideoToggle");
                $muteAudioToggle.removeAttr("disabled");
                $muteAudioToggle.trigger('change');
                $muteVideoToggle.removeAttr("disabled");
                $muteVideoToggle.trigger('change');
                break;
            case StreamStatus.Unpublished:
            case StreamStatus.Failed:
                setPublishStatus(event.status);
                $("#publishBtn").text("Start").prop('disabled', false);
                $("#muteAudioToggle").prop('checked',false).attr('disabled','disabled').trigger('change');
                $("#muteVideoToggle").prop('checked',false).attr('disabled','disabled').trigger('change');
                break;
            default:
                break;
        }
    }
}
//Error
function errorEvent(event) {
    console.log(event.info);
}

function writeInfo(str) {
    console.log(str);
}

function sendMessage() {
    var date = new Date();
    var time = date.getHours() + ":" + (date.getMinutes()<10?'0':'') + date.getMinutes();
    f.sendRoomData(roomName, {
        operationId: createUUID(),
        payload: field("message")
    });
    var newMessage = time + " " + field("login") + " - " + field("message").split('\n').join('<br/>') + '<br/>';
    var chat = document.getElementById("chat");
    chat.innerHTML += newMessage ;
    $("#chat").scrollTop(chat.scrollHeight);
    document.getElementById("message").value = "";
}


function roomStatusEventListener(event) {
    var date = new Date();
    var time = date.getHours() + ":" + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes();
    var message = event;
    var participantEl;
    if (message.owner.clientId != clientId) {
        switch (message.status) {

            case "JOINED":
                addMessage(time + " " + "<i>" + message.owner.login + " joined" + '<br/></i>');
                participantEl = $(".participant.free").first();
                if (participantEl) {
                    participantEl.find(".p-login").text(message.owner.login);
                    participantEl.find(".fp-userState").addClass("online");
                    participantEl.removeClass("free").attr("login", message.owner.login);
                }
                break;
            case "DISCONNECTED":
                addMessage(time + " " + "<i>" + message.owner.login + " disconnected" + '<br/></i>');
                participantEl = $(".participant[login='" + message.owner.login +"']").first();
                if (participantEl) {
                    participantEl.find(".p-login").text("Offline");
                    participantEl.find(".fp-userState").removeClass("online").removeClass("streaming");
                    participantEl.addClass("free").removeAttr("login").removeAttr("stream");
                    var video = participantEl.find("video").get(0);
                    video.pause();
                    video.src = '';
                }
                break;
            case "PUBLISHING":
                addMessage(time + " " + "<i>" + message.owner.login + " started a stream" + '<br/></i>');
                participantEl = $(".participant[login='" + message.owner.login +"']").first();
                if (participantEl) {
                    var remoteMediaElementId = participantEl.find("video").attr("id");
                    f.playStream({name: message.streamName, remoteMediaElementId: remoteMediaElementId});
                    participantEl.find(".fp-userState").addClass("streaming");
                    participantEl.attr("stream", message.streamName);
                }
                break;
            case "UNPUBLISHED":
                addMessage(time + " " + "<i>" + message.owner.login + " stopped a stream" + '<br/></i>');
                f.stopStream({name: message.streamName});
                participantEl = $(".participant[login='" + message.owner.login +"']").first();
                if (participantEl) {
                    var video = participantEl.find("video").get(0);
                    video.pause();
                    video.src = '';
                    participantEl.find(".fp-userState").removeClass("streaming");
                    participantEl.removeAttr("stream");

                }
                break;
            case "SENT_DATA":
                addMessage(time + " " + message.owner.login + " - " + message.data.payload.split('\n').join('<br/>') + '<br/>');
                break;
            default:
                break;

        }
    }

}

function addMessage(msg) {
    var chat = document.getElementById("chat");
    chat.innerHTML += msg;
    $("#chat").scrollTop(chat.scrollHeight);
}

// Set connection status and display corresponding view
function setConnectionStatus(status) {
    if (status == "ESTABLISHED") {
        $("#connectionStatus").text(status).removeClass().attr("class", "text-success");
    }

    if (status == "DISCONNECTED") {
        $("#connectionStatus").text(status).removeClass().attr("class", "text-muted");
    }

    if (status == "FAILED") {
        $("#connectionStatus").text(status).removeClass().attr("class", "text-danger");
    }
}

// Set Stream Status
function setPublishStatus(status) {

    $("#publishStatus").className = '';

    if (status == "PUBLISHING") {
        $("#publishStatus").attr("class", "text-success");
    }

    if (status == "UNPUBLISHED") {
        $("#publishStatus").attr("class", "text-muted");
    }

    if (status == "FAILED") {
        $("#publishStatus").attr("class", "text-danger");
    }

    $("#publishStatus").text(status);
}

//Set WCS URL
function setURL() {
    var proto;
    var url;
    var port;
    if (window.location.protocol == "http:") {
        proto = "ws://";
        port = "8080";
    } else {
        proto = "wss://";
        port = "8443";
    }

    url = proto + window.location.hostname + ":" + port;
    document.getElementById("urlServer").value = url;
}

function setInviteLink() {
    url = window.location.href + "?roomName=" + roomName;
    document.getElementById("inviteLink").value = url;
}

//Get field
function field(name) {
    return document.getElementById(name).value;
}

// Check field for empty string
function checkForEmptyField(checkField, alertDiv) {
    if (!$(checkField).val()) {
        $(alertDiv).addClass("has-error");
        return false;
    } else {
        $(alertDiv).removeClass("has-error");
        return true;
    }
}