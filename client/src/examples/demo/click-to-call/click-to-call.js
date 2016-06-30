//Init WCS JavaScript API
var f = Flashphoner.getInstance();

var currentCall;
var connected;
var call;
/////////////////////////////
///////// Init //////////////

function initAPI() {

    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.RegistrationStatusEvent, registrationStatusListener);
    f.addListener(WCSEvent.CallStatusEvent, callStatusListener);

    // init Flash support for IE

    if (detectIE()) {
        detectFlash();
    }

    f.init({pathToSWF: '../../../dependencies/flash/MediaManager.swf', elementIdForSWF : "flashDiv"});
}

$(document).ready(function () {
    $("#callBtn").click(function () {
        var str = $("#callBtn").text();
        if (str == "Call") {
            connect();
        } else {
            cancel();
        }
    });

    // Set connection field using cookies
    if (f.getCookie("connection")) {
        $("#connection").val(decodeURIComponent(f.getCookie("connection")));
    } else {
        $("#connection").text("f.connect({urlServer: '"+setURL()+"', appKey: 'defaultApp',sipLogin:'10000',sipPassword:'12345',sipDomain:'192.168.1.1',sipPort:5060});");
    }

    // Set callee field using cookies
    if (f.getCookie("callee")) {
        $("#callee").val(decodeURIComponent(f.getCookie("callee")));
    } else {
        $("#callee").val("call.callee = '10001';");
    }

});

/////////////////////////////
///////// Controls //////////////

//New connection
function connect() {

    setCookies();

    status("");

    if (!detectIE()) {
        $("#callBtn").prop('disabled', true);
    }

    if (!connected) {
        if ($("#connection").val() == null) {
            trace("Connection body is null, trying to call default connect");
            f.connect({urlServer: setURL(), appKey: "click2call"});
        } else {
            trace("Execute code from textarea");
            eval($("#connection").val());
        }
    } else {
        makeCall();
    }
}

// Cancel the current call
function cancel() {
    if (currentCall !== null) {
        trace("hangup current call");
        f.hangup(currentCall);
    }

    if (!detectIE()) {
        $("#callBtn").prop('disabled', true);
    } else {
        displayCallButtonAsCall();
    }

    callStatus("Cancelled, try to call again.");
}

// Save connection and callee info in cookies
function setCookies() {
    f.setCookie("connection", $("#connection").val());
    f.setCookie("callee", $("#callee").val());
}

//New call
function makeCall() {

    displayCallButtonAsHangup();

    setCookies();

    call = new Call();
    if ($("#callee").val() == null) {
        trace("Callee body is null, set default callee");
        call.callee = "override_by_rest";
    } else {
        trace("Set callee from textarea");
        eval($("#callee").val());
    }

    currentCall = f.call(call);
}

//////////////////////////////////
///////// Listeners //////////////

// Connection Status
function connectionStatusListener(event) {
    trace("connection status: " + event.status);
    if (event.status == ConnectionStatus.Established) {
        connected = true;
        trace('Connection has been established. Calling');
        status("Calling");
        makeCall();
    } else if (event.status == ConnectionStatus.Failed) {
        $("#callBtn").prop('disabled', false);
    }

    status(event.status);
}
// Registration Status
function registrationStatusListener(event) {
    trace("registrationStatusListener " + event.status);
}

// Call Status
function callStatusListener(event) {
    trace("callStatusListener >> " + event.status);

    if ($("#callBtn").prop('disabled')) {
        $("#callBtn").prop('disabled', false);
    }

    if (event.status == CallStatus.BUSY || event.status == CallStatus.FINISH || event.status == CallStatus.FAILED) {
        displayCallButtonAsCall();
    }

    if (event.status == CallStatus.ESTABLISHED) {
        trace('Call ' + event.callId + ' is established');
    }

    callStatus(event.status);
}

// Error
function errorEvent(event) {
    trace("error: " + event.info);
    connected = false;
    f.finish(call);
    $("#callStatus").removeClass();
    $("#callStatus").addClass("alert center-block text-center alert-danger");
    $("#callStatus").text(event.info);
    setTimeout(function () {
        $("#callStatus").removeClass();
        $("#callStatus").addClass("hidden");
    }, 3000);

    displayCallButtonAsCall();
}

//////////////////////////////////
///////// Display UI //////////////

function displayCallButtonAsCall() {
    $("#callBtn").prop('disabled', false);
    $("#callBtn").text("Call");
    $("#callBtn").removeClass("btn-danger");
    $("#callBtn").addClass("btn-success");
}

function displayCallButtonAsHangup() {
    $("#callBtn").text("Hangup");
    $("#callBtn").removeClass("btn-success");
    $("#callBtn").addClass("btn-danger");
    $("#callBtn").prop('disabled', false);
}

// Display connection status
function status(str) {
    if (!str || str.length == 0) {
        $("#callStatus").text("");
    } else {
        if (str=="ESTABLISHED"){
            $("#callStatus").text("CONNECTED");
        }else {
            $("#callStatus").text(str);
        }
    }
}

// Display call status
function callStatus(str) {
    $("#callStatus").text(str);
}


//////////////////////////////////
///////// Utils //////////////


//set WCS URL
function setURL() {
    var proto;
    var url;
    var port;
    if (window.location.protocol == "http:") {
        proto = "ws://";
        port = "8080";
    } else {
        proto = "wss://";
        port = "8443";
    }

    url = proto + window.location.hostname + ":" + port;

    return url;
}

//Trace
function trace(str) {
    console.log(str);
}

// Detect IE, Edge
function detectIE() {
    var ua = window.navigator.userAgent;
    if (ua.indexOf('MSIE ') > 0 || (navigator.userAgent.indexOf("Edge") > 0 )){
        return true;
    }
    var trident = ua.indexOf('Trident/');
    if (trident > 0) {
        return true;
    }
    return false;
}

// Detect Flash
function detectFlash() {
    var hasFlash = false;
    try {
        var fo = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
        if (fo) {
            hasFlash = true;
        }
    } catch (e) {
        if (navigator.mimeTypes
            && navigator.mimeTypes['application/x-shockwave-flash'] != undefined
            && navigator.mimeTypes['application/x-shockwave-flash'].enabledPlugin) {
            hasFlash = true;
        }
    }
    if (!hasFlash) {
        $("#notifyFlash").text("Your browser doesn't support the Flash technology necessary for work of an example");
    }
}