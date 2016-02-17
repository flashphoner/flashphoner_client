var api = Flashphoner.getInstance();
var client;
var authToken;
var currentCall;
var intervalId = -1;
var currentCommand;
var result;
var resultReady = false;
var resultInterval = {};
var mediaProvider;
var receivedMessages = [];

function initAccess() {
    var mediaProviderEl = document.getElementById("mediaProvider");
    mediaProvider = mediaProviderEl.options[mediaProviderEl.selectedIndex].value;
    mediaProviderEl.disabled = true;

    var accountTypeEl = document.getElementById("accountType");
    authToken = accountTypeEl.options[accountTypeEl.selectedIndex].value;
    accountTypeEl.disabled = true;

    var clientEl = document.getElementById("client");
    client = clientEl.value + "; " + mediaProvider;
    clientEl.disabled = true;

    document.getElementById("connectButton").disabled = true;

    if (mediaProvider == "WSPlayer") {
        connectToServer();
    } else {
        getAccess(mediaProvider, false, function () {
            getAccess(mediaProvider, true, connectToServer);
        });
    }
}

function connectToServer(accountId) {
    trace("Connecting to qaApp");
    var connection = {
        urlServer: api.configuration.urlWsServer,
        authToken: authToken,
        appKey: 'qaApp',
        mediaProviders: [mediaProvider],
        client: client
    };

    if (mediaProvider == "WSPlayer") {

        connection.mediaProviders[0] = "WSPlayer";
        connection.useWsTunnel = true;
        connection.useBase64BinaryEncoding = false;

        var config = new Configuration();
        config.wsPlayerCanvas = document.getElementById('videoCanvas');
        config.wsPlayerReceiverPath="../../../dependencies/websocket-player/WSReceiver.js";
        config.videoWidth = 320;
        config.videoHeight = 240;
        config.urlWsServer = api.configuration.urlWsServer;
        api.init(config);

    }

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

    var clientEl = document.getElementById("client");

    var mediaProviderEl = document.getElementById("mediaProvider");
    var accountTypeEl = document.getElementById("accountType");

    var isOpera = !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
    if (isOpera) {
        clientEl.value = "Opera";
        mediaProviderEl.remove(0);
        accountTypeEl.remove(1);
    } else if (typeof InstallTrigger !== 'undefined') {
        clientEl.value = "Firefox";
    } else if (Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0) {
        clientEl.value = "Safari";
        mediaProviderEl.remove(0);
        accountTypeEl.remove(1);
    } else if (!!window.chrome && !isOpera) {
        clientEl.value = "Chrome";
    } else if (/*@cc_on!@*/false || !!document.documentMode) {
        clientEl.value = "Internet Explorer";
        mediaProviderEl.remove(0);
        mediaProviderEl.remove(2);
    }

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
                result = (afterBytes - beforeBytes) > 1000;
                resultReady = true;
            });
        }, 2000);
    })
}

function isStreamMediaReceived(streamName, type) {
    resultReady = false;
    if (mediaProvider == "WSPlayer") {

        setTimeout(function() {
            result = api.getWSPlayerStatistics(type);
            resultReady = true;
        }, 2000);

    } else {
        var stream = api.publishStreams.get(streamName);
        if (!stream) {
            stream = api.playStreams.get(streamName);
        }
        api.getStreamStatistics(stream.mediaSessionId, stream.mediaProvider, function (statistic) {
            var beforeBytes = getBytes(statistic, type);
            setTimeout(function () {
                api.getStreamStatistics(stream.mediaSessionId, stream.mediaProvider, function (statistic) {
                    var afterBytes = getBytes(statistic, type);
                    result = (afterBytes - beforeBytes) > 1000;
                    resultReady = true;
                });
            }, 2000);
        })
    }
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
            document.getElementById("mediaProvider").disabled = false;
            document.getElementById("accountType").disabled = false;
            document.getElementById("client").disabled = false;
            document.getElementById("connectButton").disabled = false;
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
