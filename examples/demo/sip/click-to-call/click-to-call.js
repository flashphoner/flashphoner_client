var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS; 
var CALL_STATUS = Flashphoner.constants.CALL_STATUS;
var PRELOADER_URL = "../../dependencies/media/preloader.mp4";
// The object to check a browser version should not be missed #WCS-3914
var Browser = Flashphoner.Browser;


/////////////////////////////
///////// Init //////////////

function init_page(){
	//init api
    try {
        Flashphoner.init();
    } catch(e) {
        $("#notifyFlash").text("Your browser doesn't support WebRTC technology needed for this example");
        return;
    }
	
    localDisplay = document.getElementById("localDisplay");
	remoteDisplay = document.getElementById("remoteDisplay");

    // Set websocket URL
    $("#urlServer").val(setURL());
	
	onHangup();
}

function connect() {
    if (Browser.isSafariWebRTC() && Flashphoner.getMediaProviders()[0] === "WebRTC") {
        Flashphoner.playFirstVideo(localDisplay, true, PRELOADER_URL).then(function () {
            Flashphoner.playFirstVideo(remoteDisplay, false, PRELOADER_URL).then(function () {
                createSession();
            });
        });
        return;
    }
    createSession();
}

function createSession() {
    //check if there is already a session
    if (Flashphoner.getSessions().length > 0) {
        call(Flashphoner.getSessions()[0]);
    } else {
        var url = $('#urlServer').val();
        var sipOptions = {
            login: $('#sipLogin').val(),
            authenticationName: $('#sipAuthenticationName').val(),
            password: $('#sipPassword').val(),
            domain: $('#sipDomain').val(),
            outboundProxy: $('#sipOutboundProxy').val(),
            port: $('#sipPort').val(),
            registerRequired: true
        };
    
        var connectionOptions = {
            urlServer: url,
            sipOptions: sipOptions
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
        receiveVideo: false,
        stripCodecs: "SILK"
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
		if (validate()) {
			$(this).prop('disabled', true);
			$('#urlServer').prop('disabled', true);
			$('#callee').prop('disabled', true);
            $("#sipCredentialsBtn").prop('disabled', true);
			connect();
		} else {
		    onSipCredentialsBtnClick();
		}
    }).prop('disabled', false);
	$('#urlServer').prop('disabled', false);
    $('#callee').prop('disabled', false);
    $("#sipCredentialsBtn").off('click').click(function(){
        onSipCredentialsBtnClick();
    }).prop('disabled', false);
    $("#okBtn").off('click').click(function(){
        onOkBtnClick();
    }).prop('disabled', false);
    if (Flashphoner.getSessions().length > 0) {
        Flashphoner.getSessions()[0].disconnect();
    }
}

function onSipCredentialsBtnClick() {
    var formConnection = document.getElementById("formConnection");
    if (formConnection.style.display === "none") {
        formConnection.style.display = "block";
    }
    $("#sipCredentialsBtn").prop('disabled', true);
}

function onOkBtnClick() {
    if(validateForm("formConnection")) {
        var formConnection = document.getElementById("formConnection");
        if (formConnection.style.display !== "none") {
            formConnection.style.display = "none";
        }
        $("#sipCredentialsBtn").prop('disabled', false);
    }
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

function validateForm(formId) {
    var valid = true;
	
    $('#' + formId + ' :text').each(function(){
        if(!filledInput($(this)) && valid) {
			valid = false;
		}
    });
	if(!filledInput($('#' + formId + ' :password')) && valid) {
		valid = false;
	}
	
    return valid;
}

function filledInput(input) {
	var valid = true;

    if (!input.val()) {
		valid = false;
        input.closest('.form-group').addClass("has-error");
    } else {
        input.closest('.form-group').removeClass("has-error");
    }
	
	return valid;
}

function validate() {
    var valid = false;

    if(validateForm("formConnection") && filledInput($("#callee")) && filledInput($('#urlServer'))) {
       valid = true;
    }
    return valid;
}
