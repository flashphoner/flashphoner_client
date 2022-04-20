var Flashphoner = RoomApi.sdk;
var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var ROOM_EVENT = RoomApi.events;
var PRELOADER_URL = "../../dependencies/media/preloader.mp4";
var Browser = Flashphoner.Browser;
var connection;
var participantStateList;

//initialize interface
function init_page() {
    var url = window.location.href;
    if(url.includes('?')) {
        $('#recordBox').hide();
    } else {
        $('#recordBox').show();
    }
    //init api
    try {
        Flashphoner.init();
    } catch(e) {
        $("#notifyFlash").text("Your browser doesn't support WebRTC technology needed for this example");
        return;
    }
    participantStateList = new ParticipantLocalStateList();
    $("#url").val(setURL());
    onLeft();
}

function onJoined(room) {
    $("#joinBtn").text("Leave").off('click').click(function(){
        $(this).prop('disabled', true);
        room.leave().then(onLeft, onLeft);
    });
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
    participantStateList.clean();
    for (var i = 0; i < _participants; i++) {
        resetParticipantButtons("participant" + i);
    };
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
    connection.join({name: getRoomName(), record: isRecord()}).on(ROOM_EVENT.STATE, function(room) {
        var participants = room.getParticipants();
        console.log("Current number of participants in the room: " + participants.length);
        if (participants.length >= _participants) {
            console.warn("Current room is full");
            $("#failedInfo").text("Current room is full.");
            room.leave().then(onLeft, onLeft);
            return false;
        }
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
        publishLocalStream(room);
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
        var pBase = $("[id$=Name]:contains('NONE')")[0].id.replace('Name','');
        var pName = '#' + pBase + 'Name';
        $(pName).text(participant.name());
        participantStateList.add(participant, pBase);
        playParticipantsStream(participant);
    }
}

function removeParticipant(participant) {
    var participantState = participantStateList.getState(participant);
    if (participantState) {
        participantStateList.remove(participant);
        $(participantState.getName()).text('NONE');
        resetParticipantButtons(participantState.getBaseId());
    } else {
        console.log("Cannot remove " + participant.name() + " from participants list: not found");
    }
}

function playParticipantsStream(participant) {
    var participantState = participantStateList.getState(participant);
    if (participantState && participant.getStreams().length > 0) {
        var pDisplay = participantState.getDisplay();
        if (Browser.isSafariWebRTC()) {
            Flashphoner.playFirstVideo(pDisplay, false, PRELOADER_URL).then(function() {
                playStream(participant, pDisplay);
            }).catch(function (error) {
                // Low Power Mode detected, user action is needed to start playback in this mode #WCS-2639
                console.log("Can't atomatically play participant" + participant.name() + " stream, use Play button");
                for (var i = 0; i < pDisplay.children.length; i++) {
                    if (pDisplay.children[i]) {
                        console.log("remove cached instance id " + pDisplay.children[i].id);
                        pDisplay.removeChild(pDisplay.children[i]);
                    }
                }
                onParticipantStopped(participant);
            });
        } else {
            playStream(participant, pDisplay);
        }
    } else {
        console.log("Cannot play participant " + participant.name() + " stream: participant not found");
    }
}

function playStream(participant, display) {
    var participantState = participantStateList.getState(participant);
    if (participantState) {
        var playBtn = participantState.getPlayButton();
        var audioBtn = participantState.getAudioButton();
        var options = {
            unmutePlayOnStart: true,
            constraints: {
                audio: {
                    deviceId: 'default'
                }
            }
        };
        // Leave participant stream muted in Android Edge browser #WCS-3445
        if (Browser.isChromiumEdge() && Browser.isAndroid()) {
            options.unmutePlayOnStart = false;
        }
        participant.getStreams()[0].play(display, options).on(STREAM_STATUS.PLAYING, function (playingStream) {
            var video = document.getElementById(playingStream.id())
            video.addEventListener('resize', function (event) {
                resizeVideo(event.target);
            });
            // Set up participant Stop/Play button
            if (playBtn) {
                $(playBtn).text("Stop").off('click').click(function() {
                    $(this).prop('disabled', true);
                    playingStream.stop();
                }).prop('disabled', false);
            }
            // Set up participant audio toggle button #WCS-3445
            if (audioBtn) {
                $(audioBtn).text("Audio").off('click').click(function() {
                    if (playingStream.isRemoteAudioMuted()) {
                        playingStream.unmuteRemoteAudio();
                    } else {
                        playingStream.muteRemoteAudio();
                    }
                }).prop('disabled', false);
            }
            // Start participant audio state checking timer #WCS-3445
            participantState.startMutedCheck(playingStream);
        }).on(STREAM_STATUS.STOPPED, function () {
            onParticipantStopped(participant);
        }).on(STREAM_STATUS.FAILED, function () {
            onParticipantStopped(participant);
        });
    } else {
        console.log("Cannot play stream: participant " + participant.name() + " not found");
    }
}

function onParticipantStopped(participant) {
    var participantState = participantStateList.getState(participant);
    if (participantState) {
        var playBtn = participantState.getPlayButton();
        var audioBtn = participantState.getAudioButton();
        var audioState = participantState.getAudioState();
        if (playBtn) {
            $(playBtn).text("Play").off('click').click(function() {
                playParticipantsStream(participant);
            }).prop('disabled', false);
        }
        if (audioBtn) {
            $(audioBtn).text("Audio").off('click').prop('disabled', true);
        }
        if (audioState) {
            participantState.stopMutedCheck();
            $(audioState).text("");
        }
    } else {
        console.log("Cannot perfom onStopped actions: " + participant.name() + " not found");
    }
}

function resetParticipantButtons(id) {
    $("#" + id + 'Btn').text("Play").off('click').prop('disabled', true);
    $("#" + id + 'AudioBtn').text("Audio").off('click').prop('disabled', true);
    $("#" + id + 'AudioState').text("");
}

function getRoomName() {
    var name = getUrlParam("roomName");
    if (name && name !== '') {
        return name;
    }
    return "room-"+createUUID(6);
}

function isRecord() {
    return $('#recordCheckBox').is(":checked");
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
    $("#joinBtn").prop('disabled', false);
}

function onMediaStopped(room) {
    $("#localStopBtn").text("Publish").off('click').click(function(){
        $(this).prop('disabled', true);
        publishLocalStream(room);
    }).prop('disabled', (connection.getRooms().length == 0));
    $("#localAudioToggle").prop("disabled", true);
    $("#localVideoToggle").prop("disabled", true);
    $("#joinBtn").prop('disabled', false);
}

//publish local video
function publishLocalMedia(room) {
    $("#joinBtn").prop('disabled', true);
    var constraints = {
        audio: true,
        video: true
    };
    var display = document.getElementById("localDisplay");

    room.publish({
        display: display,
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

function publishLocalStream(room) {
    if (Browser.isSafariWebRTC()) {
        var display = document.getElementById("localDisplay");
        Flashphoner.playFirstVideo(display, true, PRELOADER_URL).then(function() {
            publishLocalMedia(room);
        }).catch(function (error) {
            console.log("Can't atomatically publish local stream, use Publish button");
            for (var i = 0; i < display.children.length; i++) {
                if (display.children[i]) {
                    console.log("remove cached instance id " + display.children[i].id);
                    display.removeChild(display.children[i]);
                }
            }
            onMediaStopped(room);
        });
    } else {
        publishLocalMedia(room);
    }
}

function muteConnectInputs() {
    $(':text').each(function(){
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

// Object to store local state to display participant #WCS-3445
function ParticipantLocalState(participant, id) {
    var state = {
        participant: participant,
        baseId: id,
        audioTimer: null,
        getBaseId: function() {
            return state.baseId;
        },
        getName: function() {
            return document.getElementById(state.baseId + 'Name');
        },
        getDisplay: function() {
            return document.getElementById(state.baseId + 'Display');
        },
        getPlayButton: function() {
            return document.getElementById(state.baseId + 'Btn');
        },
        getAudioButton: function() {
            return document.getElementById(state.baseId + 'AudioBtn');
        },
        getAudioState: function() {
            return document.getElementById(state.baseId + 'AudioState');
        },
        startMutedCheck: function(stream) {
            var audioState = state.getAudioState();
            state.stopMutedCheck();
            state.audioTimer = setInterval(function () {
                if (stream.isRemoteAudioMuted()) {
                    $(audioState).text("Muted");
                } else {
                    $(audioState).text("Unmuted");
                }
            }, 500);
        },
        stopMutedCheck: function() {
            if (state.audioTimer) {
                clearInterval(state.audioTimer);
                state.audioTimer = null;
            }
        }
    }

    return state;
}

// Array object to store local participant states #WCS-3445
function ParticipantLocalStateList() {
    var stateList = {
        list: [],
        add: function(participant, id) {
            var state = new ParticipantLocalState(participant, id);
            stateList.list.push(state);
        },
        remove: function(participant) {
            for (var i = 0; i < stateList.list.length; i++) {
                if (stateList.list[i].participant && (stateList.list[i].participant.name() === participant.name())) {
                    stateList.list[i].stopMutedCheck();
                    stateList.list.splice(i, 1);
                }
            }
        },
        clean: function() {
            while (stateList.list.length) {
                var state = stateList.list.pop();
                state.stopMutedCheck();
            }
        },
        getState: function(participant) {
            for (var i = 0; i < stateList.list.length; i++) {
                if (stateList.list[i].participant && (stateList.list[i].participant.name() === participant.name())) {
                    return stateList.list[i];
                }
            }
            return null;
        },
        startMutedCheck: function(participant, stream) {
            var item = stateList.getState(participant);
            if (item) {
                item.startMutedCheck(stream);
            } else {
                console.error("Cannot start muted check timer for participant " + participant);
            }
        },
        stopMutedCheck: function(participant) {
            var item = stateList.getState(participant);
            if (item) {
                item.stopMutedCheck();
            } else {
                console.error("Cannot stop muted check timer for participant " + participant);
            }
        }
    }

    return stateList;
}