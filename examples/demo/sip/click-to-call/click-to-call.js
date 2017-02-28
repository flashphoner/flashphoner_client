var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS; 
var CALL_STATUS = Flashphoner.constants.CALL_STATUS;


/////////////////////////////
///////// Init //////////////

function init_page(){
	//init api
    try {
        Flashphoner.init({flashMediaProviderSwfLocation: '../../../../media-provider.swf'});
    } catch(e) {
        $("#notifyFlash").text("Your browser doesn't support Flash or WebRTC technology necessary for work of an example");
        return;
    }
	
    localDisplay = document.getElementById("localDisplay");
	remoteDisplay = document.getElementById("remoteDisplay");

    // Set websocket URL
    $("#urlServer").val(setURL());
	
	onHangup();
}

function connect() {
	//check if there is already a session
    if (Flashphoner.getSessions().length > 0) {
        call(Flashphoner.getSessions()[0]);
    } else {
        var url = $('#urlServer').val();
	    var appKey = "clickToCallApp";

	    var connectionOptions = {
		    urlServer: url,
		    appKey: appKey
	    };

	    //create session
	    console.log("Create new session with url " + url);
	    Flashphoner.createSession(connectionOptions).on(SESSION_STATUS.ESTABLISHED, function(session){
		    setStatus("Session", SESSION_STATUS.ESTABLISHED);
			//session connected, place call
		    call(session);
	    }).on(SESSION_STATUS.DISCONNECTED, function(){
	        setStatus("Session", SESSION_STATUS.DISCONNECTED);
	        onHangup();
	    }).on(SESSION_STATUS.FAILED, function(){
	        setStatus("Session", SESSION_STATUS.FAILED);
	        onHangup();
		});
	}
}

function call(session) {
	var constraints = {
        audio: true,
        video: false
    };
	
	//prepare outgoing call 
    var outCall = session.createCall({
		callee: $("#callee").val(),
		visibleName: "Click To Call",
		localVideoDisplay: localDisplay,
		remoteVideoDisplay: remoteDisplay,
		constraints: constraints,
		receiveAudio: true,
        receiveVideo: false
	}).on(CALL_STATUS.RING, function(){
		setStatus("Call", CALL_STATUS.RING);
    }).on(CALL_STATUS.ESTABLISHED, function(){
		setStatus("Call", CALL_STATUS.ESTABLISHED);
    }).on(CALL_STATUS.FINISH, function(){
		setStatus("Call", CALL_STATUS.FINISH);
	    onHangup();
    }).on(CALL_STATUS.FAILED, function(){
		setStatus("Call", CALL_STATUS.FAILED);
		onHangup();
	});
	
	outCall.call();
	
	$("#callBtn").text("Hangup").removeClass("btn-success").addClass("btn-danger").off('click').click(function(){
        $(this).prop('disabled', true);
	    outCall.hangup();
    }).prop('disabled', false);
}

function onHangup() {
    $("#callBtn").removeClass("btn-danger").addClass("btn-success").text("Call").off('click').click(function(){
		if ($("#urlServer").val() && $("#callee").val) {
			$(this).prop('disabled', true);
			$('#urlServer').prop('disabled', true);
			$('#callee').prop('disabled', true);
			connect();
		}
    }).prop('disabled', false);
	$('#urlServer').prop('disabled', false);
    $('#callee').prop('disabled', false);
}

// Set connection and call status
function setStatus(prefix, status) {
    var statusField = $("#status");
    statusField.text(prefix + ": " +status).removeClass();
    if (status == "REGISTERED" || status == "ESTABLISHED") {
        statusField.attr("class","text-success");
    } else if (status == "DISCONNECTED" || status == "FINISH") {
        statusField.attr("class","text-muted");
    } else if (status == "FAILED") {
        statusField.attr("class","text-danger");
    } else if (status == "TRYING" || status == "RING") {
        statusField.attr("class","text-primary");
    }
}