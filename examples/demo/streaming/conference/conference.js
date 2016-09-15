//Init API
Flashphoner.init({flashMediaProviderSwfLocation: '../../../../media-provider.swf'});

var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var ROOM_EVENT = Flashphoner.roomApi.events;
var currentApi;
var currentRoom;
var control;
var localStream;
var username;
var participantStreams = {};

//initialize interface
function init() {
    if (detectIE()) {
        detectFlash();
    }
    // Bind an event handlers
    $("#joinBtn").click(function() {
        $(this).prop('disabled',true);
        var state = $(this).text();
        if (state == "Join") {
            connect();
        } else {
            leaveRoom();
        }
    });
    $("#localStopBtn").click(function() {
        $(this).prop('disabled',true);
        var state = $(this).text();
        if (state == "Publish") {
            publishLocalMedia();
        } else {
            unpublishLocalMedia();
        }
    }).prop('disabled',true);
    $('#sendMessageBtn').click(function(){
        var message = field('message');
        addMessage(username, message);
        $('#message').val("");
        //broadcast message
        var participants = currentRoom.getParticipants();
        for (var i = 0; i < participants.length; i++) {
            participants[i].sendMessage(message);
        }
    }).prop('disabled',true);

    $("#url").val(setURL());
}

//connect
function connect() {
    if (currentApi && currentApi.status() == SESSION_STATUS.ESTABLISHED) {
        console.warn("Already connected, session id " + currentApi.id());
        joinRoom();
        return;
    }
    var url = field('url');
    username = field('login');
    $('#failedInfo').text("");
    currentApi = Flashphoner.roomApi.connect({urlServer: url, username: username}).on(SESSION_STATUS.FAILED, function(session){
        console.warn("Session failed, id " + session.id());
        setJoinionStatus(session.status());
    }).on(SESSION_STATUS.DISCONNECTED, function(session) {
        console.log("Session diconnected, id " + session.id());
        setJoinionStatus(session.status());
    }).on(SESSION_STATUS.ESTABLISHED, function(session) {
        console.log("Session established, id" + session.id());
        setJoinionStatus(session.status());
        //join room
        joinRoom();
    });
}

function joinRoom() {
    currentApi.join({name: getRoomName()}).on(ROOM_EVENT.STATE, function(room){
        // Unmute buttons
        $("#joinBtn").text("Leave");
        unmuteButtons();
        // Save room to global
        currentRoom = room;
        console.log("Current number of participants at the room: " + room.getParticipants().length);
        if (room.getParticipants().length >= _participants) {
            console.warn("Current room is full");
            $("#failedInfo").text("Current room is full.");
            $("#joinBtn").text("Join");
            room.leave();
            return false;
        }
        setInviteAddress(room.name());
        var participants = room.getParticipants();
        if (participants.length > 0) {
            var chatState = "participants: ";
            for (var i = 0; i < participants.length; i++) {
                installParticipant(participants[i]);
                chatState += participants[i].name();
                if (i != participants.length - 1) {
                    chatState += ",";
                }
            }
            addMessage("chat", chatState);
        } else {
            addMessage("chat", " room is empty");
        }
        publishLocalMedia();
    }).on(ROOM_EVENT.JOINED, function(participant){
        installParticipant(participant);
        addMessage(participant.name(), "joined");
    }).on(ROOM_EVENT.LEFT, function(participant){
        //remove participant
        removeParticipant(participant);
        addMessage(participant.name(), "left");
    }).on(ROOM_EVENT.PUBLISHED, function(participant){
        playParticipantsStream(participant);
    }).on(ROOM_EVENT.FAILED, function(room, info){
        session.disconnect();
        $('#failedInfo').text(info);
    }).on(ROOM_EVENT.MESSAGE, function(message){
        addMessage(message.from.name(), message.text);
    });
}

function addMessage(login, message) {
    var date = new Date();
    var time = date.getHours() + ":" + (date.getMinutes()<10?'0':'') + date.getMinutes();
    var newMessage = time + " " + login + " - " + message.split('\n').join('<br/>') + '<br/>';
    var chat = $("#chat");
    chat.html(chat.html() + newMessage);
    chat.scrollTop(chat.prop('scrollHeight'));
}

function installParticipant(participant) {
    if (($("[id$=Name]").not(":contains('NONE')").length + 1) == _participants) {
        console.warn("More than " + _participants + " participants, ignore participant " + participant.name());
    } else {
        var p = $("[id$=Name]:contains('NONE')")[0].id.replace('Name','');
        var pName = '#' + p + 'Name';
        var pDisplay = p + 'Display';
        $(pName).text(participant.name());
        if (participant.play) {
            // Save participant stream
            participantStreams[participant.name()] = participant.play(document.getElementById(pDisplay));
        }
    }
}

function removeParticipant(participant) {
    $("[id$=Name]").each(function(index,value) {
       if ($(value).text() == participant.name()) {
           delete participantStreams[participant.name()];
           $(value).text('NONE');
       }
    });
}

function playParticipantsStream(participant) {
    $("[id$=Name]").each(function(index,value) {
        if ($(value).text() == participant.name()) {
            var p = value.id.replace('Name','');
            var pDisplay = p + 'Display';
            // Save participant stream
            participantStreams[participant.name()] = participant.play(document.getElementById(pDisplay));
        }
    });
}

function leaveRoom() {
    currentRoom.leave();
    // Stop local stream
    if (localStream) {
        localStream.stop();
        localStream = null;
        Flashphoner.releaseLocalMedia(document.getElementById("localDisplay"));
    }
    // Stop participant streams
    for (var key in participantStreams) {
        if (participantStreams.hasOwnProperty(key)){
            participantStreams[key].stop();
        }
    }
    $("[id$=Name]").not(":contains('NONE')").each(function(index,value) {
        $(value).text('NONE');
    });
    muteButtons();
    $("#joinBtn").text("Join").prop('disabled',false);
}

function getRoomName() {
    var name = getUrlParam("roomName");
    if (name && name !== '') {
        return name;
    }
    return "room-"+createUUID(6);
}

/////////////////////////////////////
///////////// Display UI ////////////
/////////////////////////////////////

// Set Joinion Status
function setJoinionStatus(status) {
    switch (status) {
        case SESSION_STATUS.ESTABLISHED:
            $('#status').text(status).removeClass().attr("class", "text-success");
            $("#joinBtn").text("Leave");
            break;
        case SESSION_STATUS.FAILED:
        case SESSION_STATUS.DISCONNECTED:
            $("[id$=Name]").each(function(index,value) {
                $(value).text('NONE');
            });
            $('#status').text(status).removeClass().attr("class", "text-danger");
            $('#sendMessageBtn').prop('disabled',true).off();
            $("#localStopBtn").prop('disabled',true).off();
            $("#joinBtn").text("Join");
            break;
    }
    $("#joinBtn").prop('disabled',false);
}

function setStreamStatus(status) {
    switch (status) {
        case STREAM_STATUS.UNPUBLISHED:
        case STREAM_STATUS.PUBLISHING:
            $('#localStatus').text(status).removeClass().attr("class", "text-success");
            break;
        case STREAM_STATUS.FAILED:
            $('#localStatus').text(status).removeClass().attr("class", "text-danger");
            break;
    }
}

function setInviteAddress(name) {
    $('#inviteAddress').text(window.location.href.split("?")[0] + "?roomName="+name);
}

// Helpers

function unpublishLocalMedia() {
    if (localStream) {
        localStream.stop();
    }
    $("#localStopBtn").text("Publish").prop('disabled',false);
}

//publish local video
function publishLocalMedia() {
    currentRoom.publish(document.getElementById("localDisplay")).on(STREAM_STATUS.FAILED, function (stream) {
        console.warn("Local stream failed!");
        setStreamStatus(stream.status());
        unpublishLocalMedia();
    }).on(STREAM_STATUS.PUBLISHING, function (stream) {
        localStream = stream;
        $("#localStopBtn").text("Stop").prop('disabled',false);
        setStreamStatus(stream.status());
    }).on(STREAM_STATUS.UNPUBLISHED, function(stream) {
        setStreamStatus(stream.status());
        unpublishLocalMedia();
    });
}

function unmuteButtons() {
    $("#joinBtn").prop('disabled',false);
    $('#sendMessageBtn').prop('disabled',false);
    $("#localStopBtn").prop('disabled',false);
}

function muteButtons() {
    $('#sendMessageBtn').prop('disabled',true);
    $("#localStopBtn").prop('disabled',true);
}