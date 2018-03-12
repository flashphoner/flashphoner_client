var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var localVideo;
var remoteVideo;
var extensionId = "nlbaajplpmleofphigmgaifhoikjmbkg";

function init_page() {
    //init api
    try {
        Flashphoner.init({screenSharingExtensionId: extensionId});
    } catch(e) {
        $("#notifyFlash").text("Your browser doesn't support Flash or WebRTC technology necessary for work of an example");
        return;
    }

    var interval;
    if (Browser.isFirefox()) {
        $("#installExtensionButton").show();
        interval = setInterval(function() {
            if (Flashphoner.firefoxScreenSharingExtensionInstalled) {
                $("#extension").hide();
                $("#installExtensionButton").hide();
                clearInterval(interval);
                onExtensionAvailable();
            }
        }, 500);

    } else if (Browser.isChrome()) {
        $('#mediaSource').hide();
        interval = setInterval(function() {
            chrome.runtime.sendMessage(extensionId, {type: "isInstalled"}, function (response) {
                if (response) {
                    $("#extension").hide();
                    clearInterval(interval);
                    onExtensionAvailable();
                } else {
                    (inIframe()) ? $("#installFromMarket").show() : $("#installExtensionButton").show();
                }
            });
        }, 500);
    } else {
        $("#notify").modal('show');
        return false;
    }
}

function onExtensionAvailable() {
    localVideo = document.getElementById("localVideo");
    remoteVideo = document.getElementById("remoteVideo");
    $("#url").val(setURL() + "/" + createUUID(8));
    onStopped();
}

function onStarted(publishStream, previewStream) {
    $("#publishBtn").text("Stop").off('click').click(function(){
        $(this).prop('disabled', true);
        previewStream.stop();
    }).prop('disabled', false);
    $('#mediaSource').prop('disabled', true);
}

function onStopped() {
    $("#publishBtn").text("Start").off('click').click(function(){
        if (validateForm()) {
            muteInputs();
            $(this).prop('disabled', true);
            start();
        }
    }).prop('disabled', false);
    $('#mediaSource').prop('disabled', false);
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
    var constraints = {
        video: {
            width: parseInt($('#width').val()),
            height: parseInt($('#height').val()),
            frameRate: parseInt($('#fps').val()),
        },
        audio: $("#useMic").prop('checked')
    };
    if (Browser.isChrome()) {
        constraints.video.type = "screen";
    } else if (Browser.isFirefox()){
        constraints.video.mediaSource = $('#mediaSource').val();
    }
    session.createStream({
        name: streamName,
        display: localVideo,
        constraints: constraints
    }).on(STREAM_STATUS.PUBLISHING, function(publishStream){
        /*
         * User can stop sharing screen capture using Chrome "stop" button.
         * Catch onended video track event and stop publishing.
         */
        document.getElementById(publishStream.id()).srcObject.getVideoTracks()[0].onended = function (e) {
            publishStream.stop();
        };
        document.getElementById(publishStream.id()).addEventListener('resize', function(event){
            resizeVideo(event.target);
        });
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
        }).on(STREAM_STATUS.FAILED, function(stream){
            //preview failed, stop publishStream
            if (publishStream.status() == STREAM_STATUS.PUBLISHING) {
                setStatus(STREAM_STATUS.FAILED, stream);
                publishStream.stop();
            }
        }).play();
    }).on(STREAM_STATUS.UNPUBLISHED, function(){
        setStatus(STREAM_STATUS.UNPUBLISHED);
        //enable start button
        onStopped();
    }).on(STREAM_STATUS.FAILED, function(stream){
        setStatus(STREAM_STATUS.FAILED, stream);
        //enable start button
        onStopped();
    }).publish();
}

//show connection or local stream status
function setStatus(status, stream) {
    var statusField = $("#status");
    var infoField = $("#info");
    statusField.text(status).removeClass();
    if (status == "PUBLISHING") {
        statusField.attr("class","text-success");
    } else if (status == "DISCONNECTED" || status == "UNPUBLISHED") {
        statusField.attr("class","text-muted");
    } else if (status == "FAILED") {
        statusField.attr("class","text-danger");
        if (stream) {
            infoField.text(stream.getInfo()).attr("class","text-muted");
        }
    }
}

//install extension
function installExtension() {
    if (Browser.isChrome()) {
        chrome.webstore.install();
    } else if (Browser.isFirefox()) {
        var params = {
            "Flashphoner Screen Sharing": { URL: "../../dependencies/screen-sharing/firefox-extension/flashphoner_screen_sharing-0.0.10-fx.xpi",
                IconURL: "../../dependencies/screen-sharing/firefox-extension/icon.png",
                Hash: "sha1:d05783a5d8af8807aa427520f2e81a3fd23c2a14",
                toString: function () { return this.URL; }
            }
        };
        InstallTrigger.install(params);
    }
}

function installFromMarket() {
    if (Browser.isChrome()) {
        var url = "https://chrome.google.com/webstore/detail/flashphoner-screen-sharin/nlbaajplpmleofphigmgaifhoikjmbkg";
        window.open(url, '_blank');
    }
}

function inIframe () {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

function muteInputs() {
    $(":input").each(function() {
       $(this).prop('disabled',true);
    });
}

function unmuteInputs() {
    $(":input").each(function() {
        $(this).prop('disabled',false);
    });
}

function validateForm() {
    var valid = true;
    $(':text').each(function(){
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
