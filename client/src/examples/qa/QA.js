var api = Flashphoner.getInstance();
var authToken;
var currentCall;
var intervalId = -1;
var currentCommand;
var result;
var resultReady = false;
var resultInterval = {};
var mediaProvider;
var receivedMessages = [];

function setAccountType(type) {
    authToken = type;
    document.getElementById("callButton").disabled = true;
    document.getElementById("streamButton").disabled = true;
    if (mediaProvider) {
        initAccess();
    }
}

function setMediaProvider(mp) {
    mediaProvider = mp;
    document.getElementById("flashButton").disabled = true;
    document.getElementById("webrtcButton").disabled = true;
    if (authToken) {
        initAccess();
    }
}

function initAccess() {
    getAccess(mediaProvider, false, function () {
        getAccess(mediaProvider, true, connectToServer);
    });
}

function connectToServer(accountId) {
    trace("Connecting to qaApp");
    var connection = {
        authToken: authToken,
        appKey: 'qaApp',
        mediaProviders: [mediaProvider],
        client: getClientFromUrl() + "; " + mediaProvider
    };
    if (accountId) {
        connection.accountId = accountId;
    }

    api.connect(connection);
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

//used for calls
function isAudioReceived() {
    isCallMediaReceived("audio");
}

//used for calls
function isVideoReceived() {
    isCallMediaReceived("video");
}

function isCallMediaReceived(type) {
    resultReady = false;
    api.getCallStatistics(currentCall, function (statistic) {
        var beforeBytes = getBytes(statistic, type);
        setTimeout(function () {
            api.getCallStatistics(currentCall, function (statistic) {
                var afterBytes = getBytes(statistic, type);
                result = (afterBytes - beforeBytes) > 100;
                resultReady = true;
            });
        }, 500);
    })
}

function isStreamMediaReceived(streamName, type) {
    resultReady = false;
    var stream = api.publishStreams.get(streamName);
    if (!stream) {
        stream = api.playStreams.get(streamName);
    }
    api.getStreamStatistics(stream.mediaSessionId, MediaProvider.WebRTC, function (statistic) {
        var beforeBytes = getBytes(statistic, type);
        setTimeout(function () {
            api.getStreamStatistics(stream.mediaSessionId, MediaProvider.WebRTC, function (statistic) {
                var afterBytes = getBytes(statistic, type);
                result = (afterBytes - beforeBytes) > 100;
                resultReady = true;
            });
        }, 500);
    })
}


function getBytes(statistic, type) {
    var afterBytes = 0;
    if (!statistic.incomingStreams[type]) {
        return 0;
    }
    if (statistic.type == "chrome" || statistic.type == "firefox") {
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

function connectionStatusListener(connection, event) {
    trace(connection.status);
    if (ConnectionStatus.Disconnected == connection.status || ConnectionStatus.Failed == connection.status) {
        if (event && (event.code == 3001 || event.code == 1005)) {
            connectToServer(event.reason);
        } else {
            document.getElementById("callButton").disabled = false;
            document.getElementById("streamButton").disabled = false;
            document.getElementById("flashButton").disabled = false;
            document.getElementById("webrtcButton").disabled = false;
        }
    }

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