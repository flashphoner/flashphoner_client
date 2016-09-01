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
        var state = $(this).text();
        console.log(state);
        if (state == "Connect") {
            connect();
        } else {
            disconnect();
        }
    });
    $("#url").val(setURL());
    $("#localStopBtn").attr('disabled',true);
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
            setInviteAddress(room.name());
            var participants = room.getParticipants();
            if (participants.length > 0) {
                for (var i = 0; i < participants.length; i++) {
                    installParticipant(participants[i]);
                }
            }
            //attach send message
            $('#sendMessageBtn').click(function(){
                var date = new Date();
                var time = date.getHours() + ":" + (date.getMinutes()<10?'0':'') + date.getMinutes();
                var newMessage = time + " " + username + " - " + field("message").split('\n').join('<br/>') + '<br/>';
                //broadcast message
                var participants = room.getParticipants();
                for (var i = 0; i < participants.length; i++) {
                    participants[i].sendMessage(field('message'));
                }
                var chat = $("#chat");
                chat.html(chat.html() + newMessage);
                chat.scrollTop(chat.prop('scrollHeight'));
                $('#message').text("");
            });
            //publish local video
            function publishLocalMedia() {
                var control = $("#localStopBtn");
                control.attr('disabled', true);
                room.publish(document.getElementById("localDisplay")).on(STREAM_STATUS.FAILED, function (stream) {
                    console.warn("Local stream failed!");
                    setStreamStatus(stream.status());
                    localStreamTerminated();
                }).on(STREAM_STATUS.PUBLISHING, function (stream) {
                    control.text("Stop");
                    control.click(function () {
                        control.off("click");
                        stream.stop();
                        control.attr('disabled', true);
                    });
                    control.removeAttr('disabled');
                    setStreamStatus(stream.status());
                }).on(STREAM_STATUS.UNPUBLISHED, function(stream) {
                    setStreamStatus(stream.status());
                    localStreamTerminated();
                });

                function localStreamTerminated() {
                    control.text("Publish");
                    control.click(function () {
                        control.off("click");
                        control.attr('disabled', true);
                        publishLocalMedia();
                    });
                    control.removeAttr('disabled');
                }
            }
            publishLocalMedia();
        }).on(ROOM_EVENT.JOINED, function(participant){
            installParticipant(participant);
        }).on(ROOM_EVENT.LEFT, function(participant){
            //remove participant
            if ($('#participant1Name').text() == participant.name()) {
                $('#participant1Name').text("NONE");
            } else if ($('#participant2Name').text() == participant.name()) {
                $('#participant2Name').text("NONE");
            } else {
                console.warn("Ignored participant left, name " + participant.name());
            }
        }).on(ROOM_EVENT.PUBLISHED, function(participant){
            if ($('#participant1Name').text() == participant.name()) {
                participant.play(document.getElementById('participant1Display'));
            } else if ($('#participant2Name').text() == participant.name()) {
                participant.play(document.getElementById('participant2Display'));
            } else {
                console.warn("Ignored participant published, name " + participant.name());
            }
        }).on(ROOM_EVENT.FAILED, function(room, info){
            session.disconnect();
            $('#failedInfo').text(info);
        }).on(ROOM_EVENT.MESSAGE, function(message){

            var date = new Date();
            var time = date.getHours() + ":" + (date.getMinutes()<10?'0':'') + date.getMinutes();
            var newMessage = time + " " + message.from.name() + " - " + message.text.split('\n').join('<br/>') + '<br/>';
            var chat = $("#chat");
            chat.html(chat.html() + newMessage);
            chat.scrollTop(chat.prop('scrollHeight'));
        });
    });
}

function installParticipant(participant) {
    if ($('#participant1Name').text() == "NONE") {
        $('#participant1Name').text(participant.name());
        if (participant.play) {
            participant.play(document.getElementById('participant1Display'));
        }
    } else if ($('#participant2Name').text() == "NONE") {
        $('#participant2Name').text(participant.name());
        if (participant.play) {
            participant.play(document.getElementById('participant2Display'));
        }
    } else {
        console.warn("More than 3 participants, ignore participant " + participant.name());
    }
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
            $("#localStopBtn").attr('disabled',true);
            $("#localStopBtn").off();
            $("#connectBtn").text("Connect");
            $('#sendMessageBtn').off();
            break;
    }
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
