//Init WCS JavaScript API
var f = Flashphoner.getInstance();

var currentCall;
var connected;

/////////////////////////////
///////// Init //////////////

function initAPI() {

    f.addListener(WCSEvent.ErrorStatusEvent, errorEvent);
    f.addListener(WCSEvent.ConnectionStatusEvent, connectionStatusListener);
    f.addListener(WCSEvent.RegistrationStatusEvent, registrationStatusListener);
    f.addListener(WCSEvent.CallStatusEvent, callStatusListener);

    // init Flash support for IE
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

    $("#callBtn").prop('disabled', true);

    if (!connected) {
        if ($("#connection").val() == null) {
            console.log("Connection body is null, trying to call default connect");
            f.connect({urlServer: setURL(), appKey: "click2call"});
        } else {
            console.log("Execute code from textarea");
            eval($("#connection").val());
        }
    } else {
        call();
    }
}

// Cancel the current call
function cancel() {
    if (currentCall !== null) {
        f.hangup(currentCall);
    }

    $("#callBtn").prop('disabled', true);

    callStatus("Cancelled, try to call again.");
}

// Save connection and callee info in cookies
function setCookies() {
    f.setCookie("connection", $("#connection").val());
    f.setCookie("callee", $("#callee").val());
}

//New call
function call() {

    displayCallButtonAsHangup();

    setCookies();

    var call = new Call();
    if ($("#callee").val() == null) {
        console.log("Callee body is null, set default callee");
        call.callee = "override_by_rest";
    } else {
        console.log("Set callee from textarea");
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
        call();
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

    $("#error").removeClass();
    $("#error").addClass("alert center-block text-center alert-danger");
    $("#error").text(event.info);
    setTimeout(function () {
        $("#error").removeClass();
        $("#error").addClass("hidden");
    }, 3000);

    displayCallButtonAsCall()
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
        proto = "ws://"
        port = "8080"
    } else {
        proto = "wss://"
        port = "8443"
    }

    url = proto + window.location.hostname + ":" + port;

    return url;
}

//Trace
function trace(str) {
    console.log(str);
}
