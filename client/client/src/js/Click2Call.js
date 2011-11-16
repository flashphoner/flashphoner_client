/*
Copyright (c) 2011 Flashphoner
All rights reserved. This Code and the accompanying materials
are made available under the terms of the GNU Public License v2.0
which accompanies this distribution, and is available at
http://www.gnu.org/licenses/old-licenses/gpl-2.0.html

Contributors:
    Flashphoner - initial API and implementation

This code and accompanying materials also available under LGPL and MPL license for Flashphoner buyers. Other license versions by negatiation. Write us support@flashphoner.com with any questions.
*/
/*
 id:String;
 state:String;
 iHolded:Boolean = false;
 sip_state:String;
 callee:String;
 caller:String;
 visibleNameCallee:String;
 visibleNameCaller:String;
 playerVideoHeight:int;
 playerVideoWidth:int;
 streamerVideoHeight:int;
 streamerVideoWidth:int;
 timeOfCall:int = 0;
 timer:Timer;
 anotherSideUser:String;
 incoming:Boolean = false;
 isVideoCall:Boolean = false;
 */

var flashphoner;

// One call become two calls during TRANSFER case
// there is why we need at least two kinds of calls here
var holdedCall = null;
var currentCall = null;
var callee = '';
var callerLogin = '';
var registerRequired;
var isLogged = false;

var micVolume = 100;
var speakerVolume = 100;
var connectingViewBeClosed = false;
var traceEnabled = true;
var intervalId = -1;
var isMutedMicButton = false;
var isMutedSpeakerButton = false;
var proportion = 0;

function trace(str) {
    var console = $("#console");
    var isScrolled = (console[0].scrollHeight - console.height() + 1) / (console[0].scrollTop + 1 + 37); // is console scrolled down? or may be you are reading previous messages.

    if (traceEnabled) {
        console.append(str + '<br>');
    }

    if (isScrolled < 1) {
        console[0].scrollTop = console[0].scrollHeight; //autoscroll if you are not reading previous messages
    }
}

$(document).ready(function() {
    if (playerIsRight()) {
    	openConnectingView("...loading...", 0);
    }else{
    	openConnectingView("You have old flash player", 0);
		trace("Download flash player from: http://get.adobe.com/flashplayer/");
    }
});


function loginByToken(token) {
    trace("loginByToken; token = "+token);
    var result = flashphoner.loginByToken(token);
}

function getInfoAboutMe() {
    trace("getInfoAboutMe");
    return flashphoner.getInfoAboutMe();
}

function logoff() {
    trace("logoff");
    flashphoner.logoff();
}

function callByToken(token) {
    trace("callByToken; token = "+token);
    if (isLogged) {
        if (isMuted() == 1) {
            intervalId = setInterval('if (isMuted() == -1){closeRequestUnmute(); clearInterval(intervalId);callByToken(null);}', 500);
            requestUnmute();
        } else if (isMuted() == -1){
            var result = flashphoner.callByToken(token);
            if (result == 0) {
                toHangupState();
            }
    	} else {
    		openConnectingView("Microphone is not plugged in", 3000);
    	}        
    } else {
        loginByURL();
    }
}

function hangup(callId) {
    trace("hangup; callId - " + callId);
    flashphoner.hangup(callId);
}

function sendDTMF(callId, dtmf) {
    trace("sendDTMF; callId - " + callId + "; dtmf - " + dtmf);
    flashphoner.sendDTMF(callId, dtmf);
}

function isMuted() {
    var isMute = flashphoner.isMuted();
    return isMute;
}

function sendVideoChangeState() {
    trace("sendVideoChangeState;");
    var sendVideoButton = getElement('sendVideo');
    if (sendVideoButton.value == 'Send video') {
        sendVideoButton.value = "Stop video";
        flashphoner.setSendVideo(true);
    } else {
        sendVideoButton.value = "Send video";
        flashphoner.setSendVideo(false);
    }
}

function viewVideo() {
    trace("viewVideo;");
    flashphoner.viewVideo();
}

function viewAccessMessage() {
    trace("viewAccessMessage;");
    flashphoner.viewAccessMessage();
}

function changeRelationMyVideo(relation) {
    trace("changeRelationMyVideo;relation - " + relation);
    flashphoner.changeRelationMyVideo(relation);
}

function getMicVolume() {
    trace("getMicVolume");
    return flashphoner.getMicVolume();
}
function getVolume() {
    trace("getVolume");
    return flashphoner.getVolume();
}

function saveMicSettings() {
    trace("saveMicSettings");
    flashphoner.setVolume(speakerVolume);
    flashphoner.setMicVolume(micVolume);
    closeSettingsView();
}

function changeMicStatus() {
    trace("changeMicStatus");
    var micButton = getElement('micButton');
    if (isMutedMicButton == false) {
        /*micButton.style.background = "url(assets/mic_crossed.png)";*/
        micVolume = getMicVolume();
        flashphoner.setMicVolume(0);
        isMutedMicButton = true;
    } else {
        /*micButton.style.background = "url(assets/mic.png)";*/
        flashphoner.setMicVolume(micVolume);
        isMutedMicButton = false;
    }
}

function changeSpeakerStatus() {
    trace("changeSpeakerStatus");
    var soundButton = getElement('soundButton');
    if (isMutedSpeakerButton == false) {
        /*soundButton.style.background = "url(assets/sound_crossed.png)";*/
        speakerVolume = getVolume();
        flashphoner.setVolume(0);
        isMutedSpeakerButton = true;
    } else {
        /*soundButton.style.background = "url(assets/sound.png)";*/
        flashphoner.setVolume(speakerVolume);
        isMutedSpeakerButton = false;
    }
}

function getVersion() {
    trace("getVersion;");
    return flashphoner.getVersion();
}
/* ------------------ Notify functions ----------------- */

function addLogMessage(message) {
    trace(message);
}

function notifyFlashReady() {
	trace("notifyFlashReady");
	getElement('versionOfProduct').innerHTML = getVersion();
	closeConnectingView();
	loginByToken(null);
}

function notifyRegisterRequired(registerR) {
    registerRequired = registerR;
}

function notifyCloseConnection() {
    trace("notifyCloseConnection");
    toCallState();
    isLogged = false;
    closeVideoView();
    getElement('sendVideo').value = "Send video";
}

function notifyConnected() {
    trace("notifyConnected");
    if (!registerRequired) {
        isLogged = true;
        callByToken(null);
    }
}

function notifyRegistered() {
    trace("notifyRegistered");
    if (registerRequired) {
        isLogged = true;
        callByToken(null);
    }
}

function notifyBalance(balance) {
}

function notify(call) {
    trace("notify: callId " + call.id + " --- " + call.anotherSideUser);
    if (currentCall.id == call.id) {
        currentCall = call;
        if (call.state == STATE_FINISH) {
            if (holdedCall != null) {
                currentCall = holdedCall;
                holdedCall = null;
                createCallView(currentCall);
            } else {
                closeVideoView();
                toCallState();
            }
            getElement('sendVideo').value = "Send video";
        } else if (call.state == STATE_HOLD) {
            $('#callState').html('...Call on hold...');
            enableHoldButton();
        } else if (call.state == STATE_TALK) {
            if (call.isVideoCall) {
                openVideoView();
            }
            $('#callState').html('...Talking...');
            enableHoldButton();
        } else if (call.state == STATE_RING) {
            $('#callState').html('...Ringing...');
        }
    } else if (holdedCall.id == call.id) {
        if (call.state == STATE_FINISH) {
            holdedCall = null;
        }
        enableHoldButton();
    }
}

function notifyCallbackHold(call, isHold) {
}

function notifyCost(cost) {
}

function notifyError(error) {

    trace("notifyError: error " + error);

    if (error == CONNECTION_ERROR) {
        openInfoView("Connection fail", 3000,30);
    } else if (error == AUTHENTICATION_FAIL) {
        openInfoView("Register fail", 3000,30);
        window.setTimeout("logoff();", 3000);
    } else if (error == USER_NOT_AVAILABLE) {
        openInfoView("Callee not found!", 3000,30);
    } else if (error == TOO_MANY_REGISTER_ATTEMPTS) {
        openInfoView("Connection error", 3000,30);
        toLoggedOffState();
    } else if (error == LICENSE_RESTRICTION) {
        openInfoView("License restriction", 3000,30);
	} else if (error==LICENSE_NOT_FOUND){
		openInfoView("Please set the license key. You can get it here - www.flashphoner.com/license.", 5000,90);
    } else if (error == INTERNAL_SIP_ERROR) {
        openInfoView("Unknown error", 3000,30);
    } else if (error == REGISTER_EXPIRE) {
        openInfoView("Check SIP account settings", 3000,30);
    } else if (error == SIP_PORTS_BUSY) {
        openInfoView("All sip ports are busy", 3000,30);
        connectingViewBeClosed = true;
        window.setTimeout("logoff();", 3000);
    } else if (error == MEDIA_PORTS_BUSY) {
        openInfoView("All media ports are busy", 3000,30);
    } else if (error == WRONG_SIPPROVIDER_ADDRESS) {
        openInfoView("Wrong sip provider address", 3000,30);
        connectingViewBeClosed = true;
        window.setTimeout("logoff();", 3000);
    }
    closeConnectingView();
    toCallState();
}

function notifyVideoFormat(call) {
    trace("notifyVideoFormat: call.id = " + call.id);

    if (call.streamerVideoWidth != 0) {
        proportionStreamer = call.streamerVideoHeight / call.streamerVideoWidth;
        if (proportionStreamer != 0) {
            changeRelationMyVideo(proportionStreamer);
        }
    }

    if (!call.playerVideoHeight == 0) { //that mean if user really send me video
        proportion = call.playerVideoHeight / call.playerVideoWidth; //set proportion of video picture, else it will be = 0
    }

    if ($('div').is('.videoDiv') && proportion != 0) { //if video window opened and other side send video
        var newHeight = $('.videoDiv').width() * proportion + 40;
        $('.videoDiv').height(newHeight); //we resize video window for new proportion
        $('#jsSWFDiv').height(newHeight - 40); //and resize flash for new video window
    }
}

function notifyMessage(messageObject) {
    trace('notifyMessage: ' + messageObject.from + ': ' + messageObject.body);
}

function notifyAddCall(call) {
    trace("notifyAddCall; callId - " + call.id + ", another side - " + call.anotherSideUser);

    if (currentCall != null && call.incoming == true) {
        hangup(call.id);
    } else if (currentCall != null && call.incoming == false) {
        setStatusHold(currentCall.id, true);
        holdedCall = currentCall;
        currentCall = call;
        createCallView(currentCall);
    } else {
        currentCall = call;
        createCallView(currentCall);
        if (call.incoming == true){
        	openIncomingView(call);
        	toHangupState();
       	}
    }
}

function notifyRemoveCall(call) {
    trace("notifyRemoveCall: callId " + call.id);
    if (currentCall != null && currentCall.id == call.id) {
        currentCall = null;
        removeCallView(call)
    }
}

function notifyVersion(version){
	getElement('versionOfProduct').innerHTML = version;
}
/* ----------------------------------------------------------------------- */

function openConnectingView(str, timeout) {
    trace("openConnectingView: message - " + str + "; timeout - " + timeout);
   	if (timeout != 0) {
        window.setTimeout("closeConnectingView();", timeout);
    }
   	getElement('connectingDiv').style.visibility = "visible";
    getElement('connectingText').innerHTML = str;
}

function closeConnectingView() {
    trace("closeConnectingView");
    getElement('connectingDiv').style.visibility = "hidden";
}

function openInfoView(str, timeout, height) {
    trace("TODO openInfoView: message - " + str + "; timeout - " + timeout);
   	/*if (timeout != 0) {
        window.setTimeout("closeInfoView();", timeout);
    }
   	getElement('infoDiv').style.visibility = "visible";
   	getElement('infoDiv').style.height = height+"px";
    getElement('infoText').innerHTML = str;*/
}

function closeInfoView() {
    trace("closeInfoView");
    getElement('infoDiv').style.visibility = "hidden";
}

function openSettingsView() {
    trace("openSettingsView");
    getElement('settingsDiv').style.visibility = "visible";
}
function closeSettingsView() {
    trace("closeSettingsView");
    getElement('settingsDiv').style.visibility = "hidden";
}

function getElement(str) {
    return document.getElementById(str);
}

function toHangupState() {
    trace("toHangupState");
    $('#callButton').html('Hangup').addClass('hangup').removeClass('call');
    disableCallButton();
}

function toCallState() {
    trace("toCallState");
    $('#callButton').html('Call').addClass('call').removeClass('hangup');
    disableCallButton();
}

function disableCallButton() {
    trace("disableCallButton");
    var button = $('#callButton');
    
    $('#callButton').addClass('disabled');
    window.setTimeout(enableCallButton, 3000);

    function enableCallButton() {
      $('#callButton').removeClass('disabled');
    }
}

/* ----- VIDEO ----- */

function openVideoView() {
    trace("openVideoView");
    if (isMuted() == -1){
        viewVideo();
        $('#video_requestUnmuteDiv').removeClass().addClass('videoDiv');
        $('#closeButton_video_requestUnmuteDiv').css('visibility', 'visible');

        $('#sendVideo').css('visibility', 'visible');
        $('#requestUnmuteText').hide();
        $('#video_requestUnmuteDiv .bar').html('&nbsp;&nbsp;Video');

        if (proportion != 0) {
            //$('.videoDiv #video_requestUnmuteDiv').height($(this).width() * proportion);
        	var newHeight = $('.videoDiv').width() * proportion + 40;
        	$('.videoDiv').height(newHeight); //we resize video window for new proportion
        	$('#jsSWFDiv').height(newHeight - 40); //and resize flash for new video window            
        }
    } else {
        requestUnmute();
        intervalId = setInterval('if (isMuted() == -1){closeRequestUnmute(); clearInterval(intervalId); openVideoView();}', 500);
    }
}

function closeVideoView() {
    trace("closeVideoView");
    $('#video_requestUnmuteDiv').removeClass().addClass('closed');
}

/* 
 This functions need to show window with the Adobe security panel when
 is ask allow use devices. This functions change size of window where swf is located.
 Sometimes this window use to show 'Request view', sometimes - to show 'Video view'
 */
function requestUnmute() {
    trace("requestUnmute");
    $('.back').show();
    $('.request').show();
    $('#flash').removeClass('init').addClass('security');

    viewAccessMessage();
}

function closeRequestUnmute() {
    trace("closeRequestUnmute");
    $('.back').hide();
    $('.request').hide();
    $('#flash').addClass('init').removeClass('security');
}
/* ------------------------- */

// functions closeView is simplifying of many close....View functions
function close(element) {
    element.css('visibility', 'hidden');
}
/* --------------------- On document load we do... ------------------ */
$(function() {

    
    // All buttons except .call and .hangup stay in press state until double click
    $(".button:not(.dialButton, .call, .hangup, .disabled)").click(function() {
      $(this).toggleClass('pressed');
    });

    // All dial buttons and call/hangup go unpressed after mouseup 
    $('.dialButton, .call, .hangup').mousedown(function() {
      if (!$(this).hasClass('disabled')) {$(this).addClass('pressed');}
    }).mouseup(function() {
      $(this).removeClass('pressed');
    }).mouseover (function() {
      $(this).removeClass('pressed');
    });

    // dialpad button opens dialpad
    $("#dialpadButton").click(function() {
      if ($(this).hasClass('pressed')) {
        $('#dialPad').show();
      } else {
        $('#dialPad').hide();
      }
    });
    
    // mic button opens mic slider
    $("#micButton").click(function() {
      if ($(this).hasClass('pressed')) {
        $('#micSlider').show();
      } else {
        $('#micSlider').hide();
      }
    });    
    
    // sound button opens sound slider
    $("#soundButton").click(function() {
      if ($(this).hasClass('pressed')) {
        $('#speakerSlider').show();
      } else {
        $('#speakerSlider').hide();
      }
    });

    // call button make call or hangup
    $("#callButton").click(function() {
      if ($(this).html() == 'Call') {
        call();
      } else {
        hangup(currentCall.id);
      }
    });


    $("#settingsButton").click(function() {
      openSettingsView();
    });
    
    $("#canselLoginDiv").click(function() {
      closeLoginView();
    });

    $("#sendVideo").click(function() {
      sendVideoChangeState();
    });

    $("#saveMicSettings").click(function() {
      saveMicSettings();
    });

    $("#micButton").click(function() {
      changeMicStatus();
    });

    $("#soundButton").click(function() {
      changeSpeakerStatus();
    });

    $("#cameraButton").click(function() {
      openVideoView();
    });

    $("#closeButton_video_requestUnmuteDiv").click(function() {
      closeVideoView();
    });

    $(".closeButton").click(function() {
      close($(this).parent());
    });

    //enable drag and resize objects
    $("#settingsDiv").draggable({handle: '.bar', stack:"#settingsDiv"});
    $("#video_requestUnmuteDiv").draggable({handle: '.bar', stack:"#video_requestUnmuteDiv"});
    $("#video_requestUnmuteDiv").resizable({ minHeight: 180, minWidth: 215, aspectRatio: true});

    //Bind click on number buttons
    $(".numberButton").click(function() {
        if (currentCall != null && currentCall.state == STATE_TALK) {
            sendDTMF(currentCall.id, $(this).val());
        } else if (currentCall == null) {
            $("#calleeText").val($("#calleeText").val() + $(this).val());
        }
    });

    // this function set changing in button styles when you press any button
    /*
    $(".button").mousedown(
        function() {
            $(this).css('border-style', 'inset');
        }).mouseup(
        function() {
            $(this).css('border-style', 'outset');
        }).mouseout(function() {
            $(this).css('border-style', 'outset');
        });
    */
    // this functions resize flash when you resize video window
    $('#video_requestUnmuteDiv').resize(function() {
        $('#jsSWFDiv').height($(this).height() - 40);
    });

    
		$("#micSlider").slider({
			orientation: "vertical",
			range: "min",
			min: 0,
			max: 100,
      value: 60,
			slide: function(event, ui) {
        flashphoner.setVolume(micVolume);
      }
		});
	
	  $("#speakerSlider").slider({
			orientation: "vertical",
			range: "min",
			min: 0,
			max: 100,
			value: 60,
      slide: function(event, ui) {  
        flashphoner.setVolume(speakerVolume);      
      }
		});

});



	