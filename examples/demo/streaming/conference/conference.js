//Init API
Flashphoner.init({flashMediaProviderSwfLocation: '../../../../media-provider.swf'});

var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var ROOM_EVENT = Flashphoner.roomApi.events;
var currentApi;

//initialize interface
function init() {
    if (detectIE()) {
        detectFlash();
    }
    $("#connectBtn").click(function() {
        $(this).prop('disabled',true);
        var state = $(this).text();
        if (state == "Connect") {
            connect();
        } else {
            disconnect();
        }
    });
    $("#url").val(setURL());
    $("#localStopBtn").prop('disabled',true);
}

//connect
function connect() {
    if (currentApi && currentApi.status() == SESSION_STATUS.ESTABLISHED) {
        console.warn("Already connected, session id " + currentApi.id());
        return;
    }
    var url = field('url');
    var username = field('login');
    $('#failedInfo').text("");
    currentApi = Flashphoner.roomApi.connect({urlServer: url, username: username}).on(SESSION_STATUS.FAILED, function(session){
        console.warn("Session failed, id " + session.id());
        setConnectionStatus(session.status());
    }).on(SESSION_STATUS.DISCONNECTED, function(session) {
        console.log("Session diconnected, id " + session.id());
        setConnectionStatus(session.status());
    }).on(SESSION_STATUS.ESTABLISHED, function(session) {
        console.log("Session established, id" + session.id());
        setConnectionStatus(session.status());
        //join room
        currentApi.join({name: getRoomName()}).on(ROOM_EVENT.STATE, function(room){
            console.log("Participant count: " + room.getParticipants().length);
            if (room.getParticipants().length >= _participants) {
                console.warn("Current room is full");
                $("#failedInfo").text("Current room is full");
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
            //attach send message
            $('#sendMessageBtn').click(function(){
                var message = field('message');
                addMessage(username, message);
                $('#message').val("");
                //broadcast message
                var participants = room.getParticipants();
                for (var i = 0; i < participants.length; i++) {
                    participants[i].sendMessage(message);
                }
            });
            //publish local video
            function publishLocalMedia() {
                var control = $("#localStopBtn");
                control.prop('disabled',true);
                room.publish(document.getElementById("localDisplay")).on(STREAM_STATUS.FAILED, function (stream) {
                    console.warn("Local stream failed!");
                    setStreamStatus(stream.status());
                    localStreamTerminated();
                }).on(STREAM_STATUS.PUBLISHING, function (stream) {
                    control.text("Stop");
                    control.click(function () {
                        control.off("click");
                        stream.stop();
                        control.prop('disabled',true);
                    });
                    control.prop('disabled',false);
                    setStreamStatus(stream.status());
                }).on(STREAM_STATUS.UNPUBLISHED, function(stream) {
                    setStreamStatus(stream.status());
                    localStreamTerminated();
                });

                function localStreamTerminated() {
                    control.text("Publish");
                    control.click(function () {
                        control.off("click");
                        control.prop('disabled',true);
                        publishLocalMedia();
                    });
                    control.prop('disabled',false);
                }
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
    if ($("[id$=Name]").not(":contains('NONE')").length == _participants) {
        console.warn("More than " + _participants + " participants, ignore participant " + participant.name());
    } else {
        var p = $("[id$=Name]:contains('NONE')")[0].id.replace('Name','');
        var pName = '#' + p + 'Name';
        var pDisplay = p + 'Display';
        $(pName).text(participant.name());
        if (participant.play) {
            participant.play(document.getElementById(pDisplay));
        }
    }
}

function removeParticipant(participant) {
    $("[id$=Name]").each(function(index,value) {
       if ($(value).text() == participant.name()) {
           $(value).text('NONE');
       }
    });
}

function playParticipantsStream(participant) {
    $("[id$=Name]").each(function(index,value) {
        if ($(value).text() == participant.name()) {
            var p = value.id.replace('Name','');
            var pDisplay = p + 'Display';
            participant.play(document.getElementById(pDisplay));
        }
    });
}

function disconnect() {
    if (!currentApi) {
        console.warn("Nothing to disconnect");
        return;
    }
    currentApi.disconnect();
    $("#connectBtn").text("Connect");
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

// Set Connection Status
function setConnectionStatus(status) {
    switch (status) {
        case SESSION_STATUS.ESTABLISHED:
            $('#status').text(status).removeClass().attr("class", "text-success");
            $("#connectBtn").text("Disconnect");
            break;
        case SESSION_STATUS.FAILED:
        case SESSION_STATUS.DISCONNECTED:
            $('#participant1Name').text("NONE");
            $('#participant2Name').text("NONE");
            $('#status').text(status).removeClass().attr("class", "text-danger");
            $("#localStopBtn").prop('disabled',true);
            $("#localStopBtn").off();
            $("#connectBtn").text("Connect");
            $('#sendMessageBtn').off();
            break;
    }
    $("#connectBtn").prop('disabled',false);
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
