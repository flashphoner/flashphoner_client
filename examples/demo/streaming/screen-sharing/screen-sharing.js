var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var localVideo;
var remoteVideo;
var extensionId = "nlbaajplpmleofphigmgaifhoikjmbkg";
var extensionNotInstalled;

function init_page() {
    //init api
    try {
        Flashphoner.init({screenSharingExtensionId: extensionId});
    } catch(e) {
        $("#notifyFlash").text("Your browser doesn't support Flash or WebRTC technology needed for this example");
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

    } else if (Browser.isChrome() && !Browser.isAndroid() && !Browser.isiOS()) {
        $('#mediaSourceForm').hide();
        interval = setInterval(function() {
            chrome.runtime.sendMessage(extensionId, {type: "isInstalled"}, function (response) {
                if (chrome.runtime.lastError) {         //WCS-2369 - cacth runtime.lastError
                    (inIframe()) ? $("#installFromMarket").show() : $("#installExtensionButton").show();
                    clearInterval(interval);
                    onExtensionAvailable();
                    $('#woChromeExtension').prop('checked', true);
                    $('#woChromeExtension').prop('disabled', true);
                    extensionNotInstalled = true;
                } else {
                    $("#extension").hide();
                    clearInterval(interval);
                    onExtensionAvailable();
                }
            });
        }, 500);
    } else if(isSafariMacOS()) {
        $("#extension").hide();
        $('#mediaSourceForm').hide();
        $('#micInput').hide();
        $('#mic').hide();
        clearInterval(interval);
        onExtensionAvailable();
    } else {
        $("#notify").modal('show');
        return false;
    }

    Flashphoner.getMediaDevices(null, true).then(function (list) {
        list.audio.forEach(function (device) {
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
    });

    if(!Browser.isChrome()) {
        $('#chromeExtension').remove();
    }
}

function isSafariMacOS() {
    return Browser.isSafari() && !Browser.isAndroid() && !Browser.isiOS();
}

function onExtensionAvailable() {
    localVideo = document.getElementById("localVideo");
    remoteVideo = document.getElementById("remoteVideo");
    $("#url").val(setURL() + "/" + createUUID(8));
    onDisconnected();
}

function onStarted(publishStream, previewStream) {
    $("#publishBtn").text("Stop").off('click').click(function(){
        $(this).prop('disabled', true);
        previewStream.stop();
    }).prop('disabled', false);
    $("#connectBtn").prop('disabled', false);
    $('#mediaSource').prop('disabled', true);
}

function onStopped(session) {
    $("#publishBtn").text("Start").off('click').click(function(){
        if (validateForm()) {
            muteInputs();
            $(this).prop('disabled', true);
            startStreaming(session);
        }
    }).prop('disabled', false);
    $("#connectBtn").prop('disabled', false);
    $('#mediaSource').prop('disabled', false);
}

function onConnected(session) {
    $("#publishBtn").text("Start").off('click').click(function(){
        if (validateForm()) {
            muteInputs();
            $(this).prop('disabled', true);
            startStreaming(session);
        }
    }).prop('disabled', false);
    $("#connectBtn").text("Disconnect").off('click').click(function(){
        if (validateForm()) {
            muteInputs();
            $(this).prop('disabled', true);
            session.disconnect();
        }
    }).prop('disabled', false);

    $('#mediaSource').prop('disabled', false);
}

function onDisconnected() {
    unmuteInputs();
    $("#publishBtn").prop('disabled', true);
    $("#connectBtn").text("Connect").off('click').click(function(){
        if (validateForm()) {
            muteInputs();
            $(this).prop('disabled', true);
            connect();
        }
    }).prop('disabled', false);
    $('#mediaSource').prop('disabled', false);
}

function connect() {
    //check if we already have session
    var url = $('#url').val();
    //check if we already have session
    if (Flashphoner.getSessions().length > 0) {
        var session = Flashphoner.getSessions()[0];
        if (session.getServerUrl() == url) {
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
        setStatus(SESSION_STATUS.ESTABLISHED);
        onConnected(session);
    }).on(SESSION_STATUS.DISCONNECTED, function(){
        setStatus(SESSION_STATUS.DISCONNECTED);
        onDisconnected();
    }).on(SESSION_STATUS.FAILED, function(){
        setStatus(SESSION_STATUS.FAILED);
        onDisconnected();
    });

}

function startStreaming(session) {
    var streamName = field("url").split('/')[3];
    var constraints = {
        video: {
            width: parseInt($('#width').val()),
            height: parseInt($('#height').val()),
            //WCS-2014. fixed window/tab sharing
            frameRate: parseInt($('#fps').val())
        }
    };
    if ($("#useMic").prop('checked')) {
        constraints.audio = {
            deviceId: $('#audioInput').val()
        };
    }
    constraints.video.type = "screen";
    if ($("#woChromeExtension").prop('checked') || Browser.isSafari()) {
        constraints.video.withoutExtension = true;
    }
    if (Browser.isFirefox()){
        constraints.video.mediaSource = $('#mediaSource').val();
    }
    var options = {
        name: streamName,
        display: localVideo,
        constraints: constraints
    }
    if (isSafariMacOS()) {
        options.disableConstraintsNormalization = true;
    }
    session.createStream(options
        ).on(STREAM_STATUS.PUBLISHING, function(publishStream){
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
        onStopped(session);
    }).on(STREAM_STATUS.FAILED, function(stream){
        setStatus(STREAM_STATUS.FAILED, stream);
        //enable start button
        onStopped(session);
    }).publish();
}

//show connection or local stream status
function setStatus(status, stream) {
    var statusField = $("#status");
    var infoField = $("#info");
    statusField.text(status).removeClass();
    if (status == "PUBLISHING" || status == "ESTABLISHED") {
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
        window.open("https://chrome.google.com/webstore/detail/flashphoner-screen-sharin/nlbaajplpmleofphigmgaifhoikjmbkg");
    } else if (Browser.isFirefox()) {
        var params = {
            "Flashphoner Screen Sharing": { URL: "../../dependencies/screen-sharing/firefox-extension/flashphoner_screen_sharing-0.0.10-fx.xpi",
                IconURL: "../../dependencies/screen-sharing/firefox-extension/icon.png",
                Hash: "sha1:96699c6536de455cdc5c7705f5b24fae28931605",
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
        if($(this).attr('id') == 'woChromeExtension' && extensionNotInstalled) {
            return;
        }
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
