var api = Flashphoner.getInstance();
var currentCall;
var intervalId = -1;
var currentCommand;
var result;
var resultReady = false;
var resultInterval = {};
var mediaProvider;
var receivedMessages = [];

function enableWebRTC() {
    mediaProvider = MediaProvider.WebRTC;
    initAccess();
}

function enableFlash() {
    mediaProvider = MediaProvider.Flash;
    initAccess();

}

function initAccess() {
    document.getElementById("flashButton").disabled = true;
    document.getElementById("webrtcButton").disabled = true;
    getAccess(mediaProvider, false, function () {
        getAccess(mediaProvider, true, function () {
            trace("Connecting to qaApp");
            api.connect({appKey: 'qaApp', mediaProviders: [mediaProvider], client: getClientFromUrl()});
        });
    });
}

function initAPI() {
    api.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    api.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    api.addListener(WCSEvent.RegistrationStatusEvent, registrationStatusListener);
    api.addListener(WCSEvent.CallStatusEvent, callStatusListener);
    api.addListener(WCSEvent.OnDataEvent, dataEventListener);
    api.addListener(WCSEvent.OnCallEvent, onCallListener);
    api.addListener(WCSEvent.OnMessageEvent, onMessageListener);
    ConfigurationLoader.getInstance(function (configuration) {
        configuration.remoteMediaElementId = 'remoteVideo';
        api.init(configuration);
    });
}

function getAccess(mediaProvider, hasVideo, callbackFn) {
    if (intervalId == -1) {
        var checkAccessFunc = function () {
            if (api.hasAccess(mediaProvider, hasVideo)) {
                clearInterval(intervalId);
                intervalId = -1;
                callbackFn();

            }
        };
        intervalId = setInterval(checkAccessFunc, 500);
    }
    api.getAccess(mediaProvider, hasVideo);
}

function call(call) {
    api.call(call);
    currentCall = call;
}

function isAudioReceived() {
    isMediaReceived("audio");
}

function isVideoReceived() {
    isMediaReceived("video");
}

function isMediaReceived(type) {
    resultReady = false;
    api.getStatistics(currentCall, function (statistic) {
        var beforeBytes = getBytes(statistic, type);
        setTimeout(function () {
            api.getStatistics(currentCall, function (statistic) {
                var afterBytes = getBytes(statistic, type);
                result = (afterBytes - beforeBytes) > 100;
                resultReady = true;
            });
        }, 500);
    })
}

function getBytes(statistic, type) {
    var afterBytes = 0;
    if (statistic.type == "chrome") {
        afterBytes = statistic.incomingStreams[type].bytesReceived;
    } else if (statistic.type == "flash") {
        if ("audio" == type) {
            afterBytes = statistic.incomingStreams[type].audioByteCount;
        } else if ("video" == type) {
            afterBytes = statistic.incomingStreams[type].videoByteCount;
        }
    }
    return afterBytes;
}

function isMessageReceived(message) {
    for (var m in receivedMessages) {
        if (receivedMessages[m].body == message.body) {
            return true;
        }
    }
    return false;
}

function onMessageListener(event) {
    trace("New message: " + event.body);
    receivedMessages.push(event);
}

function dataEventListener(event) {
    currentCommand = event.payload;
    var operationId = event.operationId;

    var executionId = currentCommand.executionId;
    var iterationIndex = currentCommand.iterationIndex;
    var code = currentCommand.code;

    trace("received operationId: " + operationId + " command: " + JSON.stringify(currentCommand));

    resultReady = true;
    result = eval(code);
    resultInterval[operationId] = setInterval(function () {
        if (resultReady) {
            clearInterval(resultInterval[operationId]);
            trace("send result on command: " + JSON.stringify(currentCommand) + "; result: " + result);
            api.sendData({
                operationId: createUUID(),
                payload: {executionId: executionId, iterationIndex: iterationIndex, result: result}
            });
        }
    }, 200);
}

function onCallListener(event) {
    trace("New call " + event.callId);
    currentCall = event;
}

function connectionStatusListener(event) {
    trace(event.status);
}

function registrationStatusListener(event) {
    trace(event.status);
}

function callStatusListener(event) {
    trace(event.status);
}

function errorEvent(event) {
    trace(event.info);
}

//Trace
function trace(str) {
    console.log(str);
}


getClientFromUrl = function () {
    var clientMatch = [];
    var address = window.location.toString();
    var pattern = /https?:\/\/.*\?client\=(.*)/;
    clientMatch = address.match(pattern);
    return clientMatch != null ? clientMatch[1] : "undefined";
};