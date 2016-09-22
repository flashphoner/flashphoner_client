var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var localVideo;
var remoteVideo;
var constraints;

function init_page() {
    //init api
    try {
        Flashphoner.init({flashMediaProviderSwfLocation: '../../../../media-provider.swf'});
    } catch(e) {
        $("#notifyFlash").text("Your browser doesn't support Flash or WebRTC technology necessary for work of an example");
        return;
    }

    Flashphoner.getMediaDevices(null,true).then(function(list){
        list.audio.forEach(function(device) {
            var audio = document.getElementById("audioInput");
            var i;
            var deviceInList = false;
            for (i = 0; i < audio.options.length; i++) {
                if (audio.options[i].value == device.id) {
                    deviceInList = true;
                    break;
                }
            }
            if (!deviceInList) {
                var option = document.createElement("option");
                option.text = device.label || device.id;
                option.value = device.id;
                audio.appendChild(option);
            }
        });
        list.video.forEach(function(device) {
            console.log(device);
            var video = document.getElementById("videoInput");
            var i;
            var deviceInList = false;
            for (i = 0; i < video.options.length; i++) {
                if (video.options[i].value == device.id) {
                    deviceInList = true;
                    break;
                }
            }
            if (!deviceInList) {
                var option = document.createElement("option");
                option.text = device.label || device.id;
                option.value = device.id;
                video.appendChild(option);
            }
        });
        //local and remote displays
        localVideo = document.getElementById("localVideo");
        remoteVideo = document.getElementById("remoteVideo");

        $("#url").val(setURL() + "/" + createUUID(8));
        //set initial button callback
        onStopped();
    }).catch(function(error) {
        $("#notifyFlash").text("Failed to get media devices");
    });
}

function onStarted(publishStream, previewStream) {
    $("#publishBtn").text("Stop").off('click').click(function(){
        $(this).prop('disabled', true);
        previewStream.stop();
    }).prop('disabled', false);
}

function onStopped() {
    $("#publishBtn").text("Start").off('click').click(function(){
        if (validateForm()) {
            muteInputs();
            $(this).prop('disabled', true);
            start();
        }
    }).prop('disabled', false);
    unmuteInputs();
}

function start() {
    //check if we already have session
    var url = $('#url').val();
    //check if we already have session
    if (Flashphoner.getSessions().length > 0) {
        var session = Flashphoner.getSessions()[0];
        if (session.getServerUrl() == url) {
            startStreaming(session);
            return;
        } else {
            //remove session DISCONNECTED and FAILED callbacks
            session.on(SESSION_STATUS.DISCONNECTED, function(){});
            session.on(SESSION_STATUS.FAILED, function(){});
            session.disconnect();
        }
    }

    console.log("Create new session with url " + url);
    Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.ESTABLISHED, function(session){
        //session connected, start streaming
        startStreaming(session);
    }).on(SESSION_STATUS.DISCONNECTED, function(){
        setStatus(SESSION_STATUS.DISCONNECTED);
        onStopped();
    }).on(SESSION_STATUS.FAILED, function(){
        setStatus(SESSION_STATUS.FAILED);
        onStopped();
    });
}

function startStreaming(session) {
    var streamName = field("url").split('/')[3];
    constraints = {
        audio: {
            deviceId: $('#audioInput').val()
        },
        video: {
            deviceId: $('#videoInput').val(),
            width: parseInt($('#width').val()),
            height: parseInt($('#height').val()),
            frameRate: parseInt($('#fps').val())
        }
    };
    Flashphoner.getMediaAccess(constraints, localVideo).then(function(){
        session.createStream({
            name: streamName,
            display: localVideo,
            cacheLocalResources: true
        }).on(STREAM_STATUS.PUBLISHING, function(publishStream){
            var video = document.getElementById(publishStream.id());
            //resize local if resolution is available
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                resizeLocalVideo({target: video});
            }
            //remove resize listener in case this video was cached earlier
            video.removeEventListener('resize', resizeLocalVideo);
            video.addEventListener('resize', resizeLocalVideo);
            setStatus(STREAM_STATUS.PUBLISHING);
            //play preview
            session.createStream({
                name: streamName,
                display: remoteVideo
            }).on(STREAM_STATUS.PLAYING, function(previewStream){
                document.getElementById(previewStream.id()).addEventListener('resize', function(event){
                    resizeVideo(event.target);
                });
                //enable stop button
                onStarted(publishStream, previewStream);
            }).on(STREAM_STATUS.STOPPED, function(){
                publishStream.stop();
            }).on(STREAM_STATUS.FAILED, function(){
                //preview failed, stop publishStream
                if (publishStream.status() == STREAM_STATUS.PUBLISHING) {
                    setStatus(STREAM_STATUS.FAILED);
                    publishStream.stop();
                }
            }).play();
        }).on(STREAM_STATUS.UNPUBLISHED, function(){
            setStatus(STREAM_STATUS.UNPUBLISHED);
            //enable start button
            onStopped();
        }).on(STREAM_STATUS.FAILED, function(){
            setStatus(STREAM_STATUS.FAILED);
            //enable start button
            onStopped();
        }).publish();
    }, function(error){
        console.warn("Failed to get access to media " + error);
        onStopped();
    });
}

//show connection or local stream status
function setStatus(status) {
    var statusField = $("#status");
    statusField.text(status).removeClass();
    if (status == "PUBLISHING") {
        statusField.attr("class","text-success");
    } else if (status == "DISCONNECTED" || status == "UNPUBLISHED") {
        statusField.attr("class","text-muted");
    } else if (status == "FAILED") {
        statusField.attr("class","text-danger");
    }
}

function muteInputs() {
    $(":input, select").each(function() {
        $(this).prop('disabled',true);
    });
}

function unmuteInputs() {
    $(":input, select").each(function() {
        $(this).prop('disabled',false);
    });
}

function resizeLocalVideo(event) {
    var requested = constraints.video;
    if (requested.width != event.target.videoWidth || requested.height != event.target.videoHeight) {
        console.warn("Camera does not support requested resolution, actual resolution is " + event.target.videoWidth + "x" + event.target.videoHeight);
    }
    resizeVideo(event.target);
}

function validateForm() {
    var valid = true;
    $('#form :text, select').each(function(){
        if (!$(this).val()) {
            highlightInput($(this));
            valid = false;
        } else {
            var numericFields = ['fps', 'width', 'height'];
            if (numericFields.indexOf(this.id) != -1 && !(parseInt($(this).val()) > 0)) {
                highlightInput($(this));
                valid = false;
            } else {
                removeHighlight($(this));
            }
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