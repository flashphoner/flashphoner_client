var Flashphoner = RoomApi.sdk;
var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var ROOM_EVENT = RoomApi.events;
var Browser = Flashphoner.Browser;
var connection;
var room_;

//initialize interface
function init_page() {
    //init api
    try {
        Flashphoner.init();
    } catch(e) {
        $("#notifyFlash").text("Your browser doesn't support WebRTC technology needed for this example");
        return;
    }
    if(Browser.isAndroid() || Browser.isiOS()) {
        $("#notify").modal('show');
        $(':button').each(function(){
            if ($(this).text() !== "Close" && $(this).text() !== "&times;") {
                $(this).prop('disabled', true);
            }
        });
        $(':text').each(function(){
            $(this).prop('disabled', true);
        });
        $(".fp-localVideo").each(function(){
            $(this).hide();
        });
        return false;
    }
    $("#url").val(setURL());
    onLeft();
    onStopSharing();
}

// Screen sharing part

function onStopSharing() {
    $("#shareBtn").text("Share").off('click').click(function(){
            startSharing(room_);
    }).prop('disabled',false);
}

function onStartSharing(publishStream) {
    $("#shareBtn").text("Unshare").off('click').click(function(){
        publishStream.stop();
    }).prop('disabled',false);
}

function isSafariMacOS() {
    return Browser.isSafari() && !Browser.isAndroid() && !Browser.isiOS();
}

function startSharing(room) {
    $("#shareBtn").prop('disabled',true);
    var constraints = {
        video: {
            width: parseInt($('#width').val()),
            height: parseInt($('#height').val()),
            frameRate: parseInt($('#fps').val()),
            withoutExtension: true
        },
        audio: $("#useMic").prop('checked')
    };
    constraints.video.type = "screen";
    if (Browser.isFirefox()){
        constraints.video.mediaSource = "screen";
    }
    var options = {
        name: "screenShare",
        display: document.getElementById("preview"),
        constraints: constraints,
        cacheLocalResources: false
    }
    if (isSafariMacOS()) {
        options.disableConstraintsNormalization = true;
    }
    room.publish(options).on(STREAM_STATUS.FAILED, function (stream) {
        console.warn("Local stream failed!");
        onStopSharing();
    }).on(STREAM_STATUS.PUBLISHING, function (stream) {
        /*
         * User can stop sharing screen capture using Chrome "stop" button.
         * Catch onended video track event and stop publishing.
         */
        document.getElementById(stream.id()).srcObject.getVideoTracks()[0].onended = function (e) {
            stream.stop();
        };
        document.getElementById(stream.id()).addEventListener('resize', function(event){
            resizeVideo(event.target);
        });
        onStartSharing(stream);
    }).on(STREAM_STATUS.UNPUBLISHED, function(stream) {
        onStopSharing();
    });
}

// Video chat part

function onJoined(room) {
    $("#joinBtn").text("Leave").off('click').click(function(){
        $(this).prop('disabled', true);
        room.leave().then(onLeft, onLeft);
    }).prop('disabled', false);
    $("#shareBtn").prop('disabled',false);
    $('#sendMessageBtn').off('click').click(function(){
        var message = field('message');
        addMessage(connection.username(), message);
        $('#message').val("");
        //broadcast message
        var participants = room.getParticipants();
        for (var i = 0; i < participants.length; i++) {
            participants[i].sendMessage(message);
        }
    }).prop('disabled',false);
    $('#failedInfo').text("");
}

function onLeft() {
    $("[id$=Name]").not(":contains('NONE')").each(function(index,value) {
        $(value).text('NONE');
    });
    $("#joinBtn").text("Join").off('click').click(function(){
        if (validateForm()) {
            $(this).prop('disabled', true);
            muteConnectInputs();
            start();
        }
    }).prop('disabled', false);
    $('#sendMessageBtn').prop('disabled', true);
    $("#localStopBtn").prop('disabled', true);
    $("#localAudioToggle").prop("disabled", true);
    $("#localVideoToggle").prop("disabled", true);
    $("#shareBtn").prop("disabled", true);
    unmuteConnectInputs();
}

function start() {
    var url = $('#url').val();
    var username = $('#login').val();
    var display = document.getElementById("localDisplay");
    if (connection && connection.status() == SESSION_STATUS.ESTABLISHED) {
        //check url and username
        if (connection.getServerUrl() != url || connection.username() != username) {
            connection.on(SESSION_STATUS.DISCONNECTED, function(){});
            connection.on(SESSION_STATUS.FAILED, function(){});
            connection.disconnect();
        } else {
            joinRoom();
            return;
        }
    }
    // Requesting media access before connecting to the server #WCS-3449
    Flashphoner.getMediaAccess(null, localDisplay).then(function() {
        createConnection(url, username);
    }).catch(function(error) {
        console.error("User not allowed media access: "+error);
        $("#failedInfo").text("User not allowed media access. Refresh the page");
        onLeft();
    });
}

function createConnection(url, username) {
    connection = RoomApi.connect({urlServer: url, username: username}).on(SESSION_STATUS.FAILED, function(session){
        setStatus('#status', session.status());
        onLeft();
    }).on(SESSION_STATUS.DISCONNECTED, function(session) {
        setStatus('#status', session.status());
        onLeft();
    }).on(SESSION_STATUS.ESTABLISHED, function(session) {
        setStatus('#status', session.status());
        joinRoom();
    });
}

function joinRoom() {
    connection.join({name: getRoomName()}).on(ROOM_EVENT.STATE, function(room){
        var participants = room.getParticipants();
        console.log("Current number of participants in the room: " + participants.length);
        if (participants.length >= _participants) {
            console.warn("Current room is full");
            $("#failedInfo").text("Current room is full.");
            room.leave().then(onLeft, onLeft);
            return false;
        }
        room_ = room;
        setInviteAddress(room.name());
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
        publishLocalMedia(room);
        onJoined(room);
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
        connection.disconnect();
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
        playParticipantsStream(participant);
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
    if (participant.getStreams().length > 0) {
        for (var i=0; i<participant.getStreams().length; i++) {
            $("[id$=Name]").each(function (index, value) {
                if ($(value).text() == participant.name()) {
                    var p = value.id.replace('Name', '');
                    var pDisplay = p + 'Display';
                    // check if we already play this stream
                    if (document.getElementById(participant.getStreams()[i].id()) == null) {
                        // setup 1st stream to main div
                        if (participant.getStreams()[i].streamName().indexOf("screenShare") == -1) {
                            participant.getStreams()[i].play(document.getElementById(pDisplay)).on(STREAM_STATUS.PLAYING, function (playingStream) {
                                document.getElementById(playingStream.id()).addEventListener('resize', function (event) {
                                    resizeVideo(event.target);
                                });
                            });
                        } else {
                            participant.getStreams()[i].play(document.getElementById("sharedDisplay")).on(STREAM_STATUS.PLAYING, function (playingStream) {
                                document.getElementById(playingStream.id()).addEventListener('resize', function (event) {
                                    resizeVideo(event.target);
                                });
                            });
                        }
                    }
                }
            });
        }
    }
}

function getRoomName() {
    var name = getUrlParam("roomName");
    if (name && name !== '') {
        return name;
    }
    return "room-"+createUUID(6);
}

function setInviteAddress(name) {
    $('#inviteAddress').text(window.location.href.split("?")[0] + "?roomName="+name);
}

function onMediaPublished(stream) {
    $("#localStopBtn").text("Stop").off('click').click(function(){
        $(this).prop('disabled', true);
        stream.stop();
    }).prop('disabled', false);
    $("#localAudioToggle").text("Mute A").off('click').click(function(){
        if (stream.isAudioMuted()) {
            $(this).text("Mute A");
            stream.unmuteAudio();
        } else {
            $(this).text("Unmute A");
            stream.muteAudio();
        }
    }).prop('disabled', false);
    $("#localVideoToggle").text("Mute V").off('click').click(function() {
        if (stream.isVideoMuted()) {
            $(this).text("Mute V");
            stream.unmuteVideo();
        } else {
            $(this).text("Unmute V");
            stream.muteVideo();
        }
    }).prop('disabled',false);
    $("#shareBtn").prop('disabled',false);
}

function onMediaStopped(room) {
    $("#localStopBtn").text("Publish").off('click').click(function(){
        $(this).prop('disabled', true);
        publishLocalMedia(room);
    }).prop('disabled', (connection.getRooms().length == 0));
    $("#localAudioToggle").prop("disabled", true);
    $("#localVideoToggle").prop("disabled", true);
}

//publish local video
function publishLocalMedia(room) {
    var constraints = {
        audio: true,
        video: true
    };
    room.publish({
        display: document.getElementById("localDisplay"),
        constraints: constraints,
        record: false,
        receiveVideo: false,
        receiveAudio: false
    }).on(STREAM_STATUS.FAILED, function (stream) {
        console.warn("Local stream failed!");
        setStatus("#localStatus", stream.status());
        onMediaStopped(room);
    }).on(STREAM_STATUS.PUBLISHING, function (stream) {
        setStatus("#localStatus", stream.status());
        onMediaPublished(stream);
    }).on(STREAM_STATUS.UNPUBLISHED, function(stream) {
        setStatus("#localStatus", stream.status());
        onMediaStopped(room);
    });
}

function muteConnectInputs() {
    $(':text').not("[id='width'],[id='height'],[id='fps']").each(function(){
        $(this).prop('disabled', true);
    });
}

function unmuteConnectInputs() {
    $(':text').each(function(){
        $(this).prop('disabled', false);
    });
}

function validateForm() {
    var valid = true;
    $(':text').each(function(){
        if (!$(this).val()) {
            highlightInput($(this));
            valid = false;
        } else {
            removeHighlight($(this));
        }
    });
    return valid;

    function highlightInput(input) {
        input.closest('.form-group').addClass("has-error");
    }
    function removeHighlight(input) {
        input.closest('.form-group').removeClass("has-error");
    }
}

function setStatus(selector, status) {
    var statusField = $(selector);
    statusField.text(status).removeClass();
    if (status == "PUBLISHING" || status == "ESTABLISHED") {
        statusField.attr("class","text-success");
    } else if (status == "DISCONNECTED" || status == "UNPUBLISHED") {
        statusField.attr("class","text-muted");
    } else if (status == "FAILED") {
        statusField.attr("class","text-danger");
    }
}
