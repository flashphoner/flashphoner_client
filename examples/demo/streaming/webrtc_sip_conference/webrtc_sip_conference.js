var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;

var config;

var INTERVAL = 1000;

var MAX_PENDING_TIME = INTERVAL * 10;

var intervals;

var api;

function init_page() {
    //init api
    try {
        Flashphoner.init();
    } catch(e) {
        $("#notifyFlash").text("Your browser doesn't support WebRTC technology needed for this example");
        return;
    }
    $("#startBtn").text("Start").off('click').click(start).prop('disabled', false);
}

function start() {
    $("#startBtn").off('click').prop('disabled', true);
    config = JSON.parse(field('config'));
    config.sipAsRtmp.callId = generateCallID();
    var restUrl = "http://" + config.wcs + ":8081";
    api = FlashphonerRestApi.instance(restUrl, restUrl);
    intervals = {
        sipAsRtmp : setInterval(checkSipAsRtmp, INTERVAL),
        mixer : setInterval(checkMixer, INTERVAL),
        sipToMixer : setInterval(checkSipToMixerAttachment, INTERVAL),
        mixerToSip : setInterval(checkMixerToSipInjection, INTERVAL),
        main : setInterval(mainLoop, INTERVAL)
    };
}

var state = {
    sipAsRtmp : {
        active : false,
        pending : false,
        time : -1
    },
    mixer : {
        active : false,
        pending : false,
        time : -1
    },
    sipToMixer : {
        active : false,
        pending : false,
        time : -1
    },
    mixerToSip : {
        active : false,
        pending : false,
        time : -1
    },
    initialized : false,
    failed : false
};

function updateState(state, active, pending) {
    if (active) {
        state.active = true;
        state.pending = false;
    } else if (pending) {
        state.active = false;
        state.pending = true;
    } else if (!active) {
        state.active = false;
    }
    state.time = Date.now();
}

function mainLoop() {
    showState();
    if (state.failed) {
        teardown();
        return;
    }
    if (state.initialized && (!state.sipAsRtmp.active || !state.mixer.active || !state.sipToMixer.active || !state.mixerToSip.active)) {
        state.failed = true;
        return;
    }
    if (!state.sipAsRtmp.active) {
        if (!state.sipAsRtmp.pending) {
            setupSipAsRtmp();
        } else if (checkPendingStateTime(state.sipAsRtmp.time)) {
            console.log("Failed to initiate sipAsRtmp!");
            state.failed = true;
        }
        return;
    }
    if (!state.mixer.active) {
        if (!state.mixer.pending) {
            sendDtmf();
            setupMixer();
        } else if (checkPendingStateTime(state.mixer.time)) {
            console.log("Failed to initiate mixer!");
            state.failed = true;
        }
        return;
    }
    if (!state.sipToMixer.active) {
        if (!state.sipToMixer.pending) {
            attachSipToMixer();
        } else if (checkPendingStateTime(state.sipToMixer.time)) {
            console.log("Failed to initiate sipToMixer!");
            state.failed = true;
        }
        return;
    }
    if (!state.mixerToSip.active) {
        if (!state.mixerToSip.pending) {
            injectMixerToSip();
        } else if (checkPendingStateTime(state.mixerToSip.time)) {
            console.log("Failed to initiate mixerToSip!");
            state.failed = true;
        }
        return;
    }
    if (!state.initialized) {
        state.initialized = true;
        $("#startBtn").off('click').text("Stop").click(function(){
            $(this).prop('disabled', true);
            state.failed = true;
        }).prop('disabled', false);
    }
}

function checkPendingStateTime(timeSince) {
    return Date.now() - timeSince > MAX_PENDING_TIME;
}

function showState() {
    $('#sipAsRtmp').text(translateState(state.sipAsRtmp));
    $('#mixer').text(translateState(state.mixer));
    $('#sipToMixer').text(translateState(state.sipToMixer));
    $('#mixerToSip').text(translateState(state.mixerToSip));
    $('#initialized').text(state.initialized);
    $('#failed').text(state.failed);

}

function translateState(state) {
    if (state.active) {
        return "ACTIVE";
    }
    if (state.pending) {
        return "PENDING";
    }
    return "NONE";
}

function teardown() {
    console.log("Teardown");
    api.call.terminate({
        callId : config.sipAsRtmp.callId
    });
    api.mixer.terminate({
        uri : config.mixer.uri
    });
    clearInterval(intervals.sipAsRtmp);
    clearInterval(intervals.mixer);
    clearInterval(intervals.sipToMixer);
    clearInterval(intervals.mixerToSip);
    clearInterval(intervals.main);
}

function checkSipAsRtmp() {
    api.call.find({
        callId : config.sipAsRtmp.callId
    }).then(function(){
        updateState(state.sipAsRtmp, true, false);
    }, function(){
        updateState(state.sipAsRtmp, false, false);
    });
}

function checkMixer() {
    api.mixer.findAll().then(function(mixers){
        for (var i = 0; i < mixers.length; i++) {
            if (mixers[i].uri === config.mixer.uri) {
                updateState(state.mixer, true, false);
                return;
            }
        }
        updateState(state.mixer, false, false);
    }, function(){
        updateState(state.mixer, false, false);
    });
}

function checkSipToMixerAttachment() {
    api.mixer.findAll().then(function(mixers){
        for (var i = 0; i < mixers.length; i++) {
            if (mixers[i].uri === config.mixer.uri) {
                for (var s = 0; s < mixers[i].mediaSessions.length; i++) {
                    if (mixers[i].mediaSessions[s].includes(config.sipAsRtmp.callId)) {
                        updateState(state.sipToMixer, true, false);
                        return;
                    }
                }
            }
        }
        updateState(state.sipToMixer, false, false);
    }, function(){
        updateState(state.sipToMixer, false, false);
    });
}

function checkMixerToSipInjection() {
    //todo implement check
}


function setupSipAsRtmp() {
    updateState(state.sipAsRtmp, false, true);
    api.call.startup({
        callId : config.sipAsRtmp.callId,
        callee : config.sipAsRtmp.ext,
        rtmpStream : config.sipAsRtmp.rtmpStream,
        rtmpUrl : config.sipAsRtmp.rtmpUrl,
        hasAudio : "true",
        hasVideo : "false",
        sipLogin : config.sipAsRtmp.login,
        sipAuthenticationName : config.sipAsRtmp.login,
        sipPassword : config.sipAsRtmp.password,
        sipDomain : config.sipAsRtmp.domain,
        sipOutboundProxy : config.sipAsRtmp.outboundProxy,
        sipPort : config.sipAsRtmp.port,
        sipRegisterRequired : config.sipAsRtmp.registerRequired,
        toStream : config.sipAsRtmp.toStream,
        visibleName : config.sipAsRtmp.login
    }).then(function(){
        console.log("Sip as rtmp requested");
    }, function() {
        state.failed = true;
    });
}

function sendDtmf() {
    if (config.sipAsRtmp.dtmf != null && config.sipAsRtmp.dtmf !== "") {
        api.call.sendDtmf({
            callId: config.sipAsRtmp.callId,
            dtmf: config.sipAsRtmp.dtmf,
            type: config.sipAsRtmp.dtmfType
        }).then(function () {
            console.log("DTMF sent");
        }, function () {
            console.log("Failed to send dtmf!");
            state.failed = true;
        })
    }
}

function setupMixer() {
    updateState(state.mixer, false, true);
    api.mixer.startup({
        uri : config.mixer.uri,
        localStreamName : config.mixer.name
    }).then(function() {
        console.log("Mixer created");
    }, function() {
        state.failed = true;
    });
}

function attachSipToMixer() {
    updateState(state.sipToMixer, false, true);
    api.mixer.add({
        uri : config.mixer.uri,
        remoteStreamName : config.sipAsRtmp.toStream
    }).then(function(){
        console.log("SIP stream attached to mixer");
    }, function() {
        state.failed = true;
    });
}

function injectMixerToSip() {
    updateState(state.mixerToSip, false, true);
    api.call.injectStream.startup({
        callId : config.sipAsRtmp.callId,
        streamName : config.mixer.name + "-" + config.sipAsRtmp.toStream
    }).then(function() {
        console.log("Mixer to stream injection requested");
        updateState(state.mixerToSip, true, false);
    }, function() {
        state.failed = true;
    });
}

function generateCallID (){
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    var part1 = "";
    var part2 = "";
    var part3 = "";
    var part4 = "";

    for( var i=0; i < getRandomInt(6,10); i++ )
        part1 += possible.charAt(Math.floor(Math.random() * possible.length));

    for( var i=0; i < getRandomInt(6,10); i++ )
        part2 += possible.charAt(Math.floor(Math.random() * possible.length));

    for( var i=0; i < getRandomInt(6,10); i++ )
        part3 += possible.charAt(Math.floor(Math.random() * possible.length));

    for( var i=0; i < getRandomInt(6,10); i++ )
        part4 += possible.charAt(Math.floor(Math.random() * possible.length));

    var callid = part1 + "-" + part2 + "-" + part3 + "-" + part4;
    return callid;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}