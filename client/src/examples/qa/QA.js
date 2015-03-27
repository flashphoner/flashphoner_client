//Init WCS JavaScript API
var api = Flashphoner.getInstance();

function initAPI() {
    api.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    api.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    api.addListener(WCSEvent.RegistrationStatusEvent, registrationStatusListener);
    api.addListener(WCSEvent.CallStatusEvent, callStatusListener);
    api.addListener(WCSEvent.OnDataEvent, dataEventListener);
    api.addListener(WCSEvent.OnCallEvent, onCallListener);
    api.addListener(WCSEvent.OnCallEvent, onCallListener);
    ConfigurationLoader.getInstance(function (configuration) {
        api.init(configuration);
        api.connect({appKey: 'qaApp'});
    });

}

var currentCall;

function dataEventListener(event) {
    var operationId = event.operationId;
    var payload = event.payload;
    var testId = payload.testId;
    var iterationIndex = payload.iterationIndex;
    var code = payload.code;

    var result = eval(code);

    trace("operationId: " + operationId + " payload: " + JSON.stringify(payload) +"; result: " + result);
    api.sendData({operationId:createUUID(), payload: {testId:testId, iterationIndex:iterationIndex, result:result}})
}


//Connection Status
function connectionStatusListener(event) {
    trace(event.status);
    if (event.status == ConnectionStatus.Established) {
        trace('Connection has been established. You can start a new call.');
    }
}

//Registration Status
function registrationStatusListener(event) {
    trace(event.status);
}

function onCallListener(event) {
    currentCall = event;
}

//Call Status
function callStatusListener(event) {
    trace(event.status);
    if (event.status == CallStatus.ESTABLISHED) {
        trace('Call ' + event.callId + ' is established');
    }
}

//Error
function errorEvent(event) {
    trace(event.info);
}

//Trace
function trace(str) {
    console.log(str);
}