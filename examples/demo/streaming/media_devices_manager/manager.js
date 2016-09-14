//Init API
Flashphoner.init({
    flashMediaProviderSwfLocation: '../../../../media-provider.swf',
    screenSharingExtensionId: "nlbaajplpmleofphigmgaifhoikjmbkg"
});

var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var currentSession;
var _stream;
var _streamName;
var localVideo;
var remoteVideo;
var _constraints = {};
var browser = detectBrowser();

//////////////////////////////////
/////////////// Init /////////////

function startTest() {
    var emptyField;
    $("form :input").not(':input[type=button]').each(function() {
        if (!checkForEmptyField('#'+$(this).attr('id'),'#'+$(this).attr('id')+'Form')) {
            emptyField = true;
        }
    });

    if(emptyField) {
        $("#applyBtn").removeProp("disabled");
        return false;
    }

    var audioSelect = document.getElementById("audioInput");
    var selectedAudio = audioSelect.options[audioSelect.selectedIndex].value;
    var videoSelect = document.getElementById("videoInput");
    var selectedVideo = videoSelect.options[videoSelect.selectedIndex].value;

    _constraints.audio = {
        deviceId: selectedAudio
    };
    _constraints.video = {
        deviceId: selectedVideo,
        width: parseInt(document.getElementById("width").value),
        height: parseInt(document.getElementById("height").value),
        frameRate: document.getElementById("fps").value,
        type: "camera"
    };

    $("#form :input").prop('readonly', true);
    document.getElementById("videoInput").disabled = true;
    document.getElementById("audioInput").disabled = true;

    connectAndPublish();
}

function initAPI() {

    localVideo = document.getElementById("localVideo");
    remoteVideo = document.getElementById("remoteVideo");

    $("#url").val(setURL() + "/" + createUUID(8));

    if (detectIE()) {
        detectFlash();
    }

    $("#applyBtn").click(function() {
        $(this).prop("disabled",true);
        var state = $(this).text();
        if (state == "Start") {
            startTest();
        } else {
            if (_stream) {
                _stream.stop();
            } else {
                console.error("Nothing to stop!");
            }
        }

    });
    Flashphoner.getMediaDevices(Flashphoner.getMediaProviders()[0],true).then(function(list){
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
    });
}

//New connection
function connectAndPublish() {
    var url = field('url');
    if (currentSession && currentSession.status() == SESSION_STATUS.ESTABLISHED) {
        console.warn("Already connected, session id " + currentSession.id());
        publishStream();
        return;
    }
    console.log("Create new session with url " + url);

    var handleSession = function (session) {
       var status = session.status();
       switch (status) {
           case "FAILED":
               console.warn("Session failed, id " + session.id());
               $("#applyBtn").removeProp("disabled");
               $("#form :input").prop('readonly', false);
               document.getElementById("videoInput").disabled = false;
               document.getElementById("audioInput").disabled = false;
               break;
           case "DISCONNECTED":
               console.log("Session diconnected, id " + session.id());
               $("#applyBtn").removeProp("disabled");
               break;
           case "ESTABLISHED":
               console.log("Session established, id " + session.id());
               publishStream();
               break;
       }
    };

    currentSession = Flashphoner.createSession({urlServer: url})
        .on(SESSION_STATUS.FAILED, handleSession)
        .on(SESSION_STATUS.DISCONNECTED, handleSession)
        .on(SESSION_STATUS.ESTABLISHED, handleSession);
}

//Publish stream
function publishStream() {
    Flashphoner.getMediaAccess(_constraints, localVideo).then(function(){
        if (localVideo.children.length > 1) {
            console.error("Display has 2 video elements!");
        }
        //todo remove
        localVideo.children[0].removeEventListener('resize', resizeLocalVideo);
        localVideo.children[0].addEventListener('resize', resizeLocalVideo);
        _streamName = field("url").split('/')[3];
        _stream = currentSession.createStream({name: _streamName, display: localVideo, cacheLocalResources: true})
            .on(STREAM_STATUS.PUBLISHING, function(publisher) {
                $("#streamStatus").text(publisher.status()).removeClass().attr("class","text-muted");
                //create preview
                currentSession.createStream({name: _streamName, display: remoteVideo})
                    .on(STREAM_STATUS.PLAYING, function(playingStream){
                        document.getElementById(playingStream.id()).addEventListener('resize', function(event){
                            resizeVideo(event.target);
                        });
                        console.log("Playing stream " + playingStream.name() + " ; id " + playingStream.id());
                        $("#applyBtn").text("Stop");
                        $("#applyBtn").removeAttr("disabled");
                    })
                    .on(STREAM_STATUS.FAILED, function(){
                        console.warn("Preview stream failed");
                        publisher.stop();
                    })
                    .play();
            })
            .on(STREAM_STATUS.FAILED, streamTerminated)
            .on(STREAM_STATUS.UNPUBLISHED, streamTerminated);
        _stream.publish();
    }, function(error){
        console.warn("Failed to get access to media " + error);
        $("#form :input").prop('readonly', false);
        document.getElementById("videoInput").disabled = false;
        document.getElementById("audioInput").disabled = false;
        $("#applyBtn").removeProp("disabled");
    });

    function streamTerminated(stream) {
        var status = stream.status();
        $("#form :input").prop('readonly', false);
        document.getElementById("videoInput").disabled = false;
        document.getElementById("audioInput").disabled = false;
        $("#applyBtn").text("Start");
        $("#applyBtn").removeAttr("disabled");
        $("#streamStatus").text(status).removeClass().attr("class","text-muted");
    }
}

function resizeLocalVideo(event) {
    var requested = _constraints.video;
    if (requested.width != event.target.videoWidth || requested.height != event.target.videoHeight) {
        console.warn("Camera does not support requested resolution, actual resolution is " + event.target.videoWidth + "x" + event.target.videoHeight);
    }
    resizeVideo(event.target);
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