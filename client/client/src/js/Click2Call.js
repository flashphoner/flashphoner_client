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
var proportionStreamer = 0;
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
    	openConnectingView("...Loading...", 0);
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
        loginByToken(null);
    }
}

function hangup(callId) {
    trace("hangup; callId - " + callId);
    flashphoner.hangup(callId);
}

function sendDTMF(callId, dtmf) {
    trace("sendDTMF: callId - " + callId + "; dtmf - " + dtmf);
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
            proportion = 0;
            closeVideoView();
            $('#callState').html('...Finished...');
            toCallState();
        } else if (call.state == STATE_HOLD) {
            $('#callState').html('...Holded...');
        } else if (call.state == STATE_TALK) {
            if (call.isVideoCall) {
                openVideoView('big');
            }
            $('#callState').html('...Talking...');
        } else if (call.state == STATE_RING) {
            $('#callState').html('...Ringing...');
        }
    }
}

function notifyCallbackHold(call, isHold) {
}

function notifyCost(cost) {
}

function notifyError(error) {

    trace("notifyError: error " + error);

    if (error == CONNECTION_ERROR || error == TOO_MANY_REGISTER_ATTEMPTS || 
    	error == LICENSE_RESTRICTION || error==LICENSE_NOT_FOUND ||
    	error == REGISTER_EXPIRE || error == MEDIA_PORTS_BUSY) {
        openInfoView("Connection error, try later", 3000);
    } else if (error == AUTHENTICATION_FAIL  || error == SIP_PORTS_BUSY ||
    	error == WRONG_SIPPROVIDER_ADDRESS) {
        openInfoView("Connection error, try later", 3000);
        window.setTimeout("logoff();", 3000);
    } else if (error == USER_NOT_AVAILABLE) {
        openInfoView("Support is offline", 3000);
    } else if (error == INTERNAL_SIP_ERROR) {
        openInfoView("Unknown error", 3000);
    }
    closeConnectingView();
    toCallState();
}

function notifyVideoFormat(call) {
    trace("notifyVideoFormat: call.id = " + call.id);

    // proportionStreamer allow us change proportion of small video window (myself preview video)
    if (call.streamerVideoWidth != 0) {
        proportionStreamer = call.streamerVideoHeight / call.streamerVideoWidth;
        if (proportionStreamer != 0) {
            /** here we change size of small myself preview video window in the swf from the js code. 
             * To be precise we cnahge only height, width is fixed and equal to 34% of big video.
             */ 
            changeRelationMyVideo(proportionStreamer);
        }
    }

    if (!call.playerVideoHeight == 0) { //that mean other side really send us video
        proportion = call.playerVideoHeight / call.playerVideoWidth; //set proportion of video picture, else it will be = 0
        trace('proportion = '+proportion);
    }
    
    

    
    /*
    if ($('div').is('.videoDiv') && proportion != 0) { //if video window opened and other side send video
        var newHeight = $('.videoDiv').width() * proportion + 40;
        $('.videoDiv').height(newHeight); //we resize video window for new proportion
        $('#jsSWFDiv').height(newHeight - 40); //and resize flash for new video window
    }
    */
}

function notifyMessage(messageObject) {
    trace('notifyMessage: ' + messageObject.from + ': ' + messageObject.body);
}

function notifyAddCall(call) {
    trace("notifyAddCall; callId - " + call.id + ", another side - " + call.anotherSideUser);
    if (call.incoming == true) {
        hangup(call.id);
    } else {
        currentCall = call;
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

function openInfoView(str, timeout) {
   	if (timeout != 0) {
        window.setTimeout("$('#callState').html('...Finished...');", timeout);
    }
	$('#callState').html(str);
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

function openVideoView(size) {
    trace("openVideoView");
    viewVideo();
    $('#cameraButton').addClass('pressed');
    if (isMuted() == -1){

      if (size == 'small') {

        $('#flash').removeClass('init').addClass('videoMy');
        $('#jsSWFDiv').height(240).width(320);
        
      } else if ((size == 'big')&&(proportion != 0)) { // sometimes voip servers send video with null sizes. Here we defend from such cases
          $('#flash').removeClass('init').addClass('video');
          var newHeight = 320 * proportion;
          $('.video').height(newHeight);
          $('#jsSWFDiv').height(newHeight).width(320);
          $('#c2c').height(newHeight+40);
      }    
        
    } else {
        requestUnmute();
        intervalId = setInterval('if (isMuted() == -1){closeRequestUnmute(); clearInterval(intervalId); openVideoView();}', 500);
    }
}

function closeVideoView() {
    trace("closeVideoView");
    $('#flash').removeClass().removeAttr('style').addClass('init');
    $('#c2c').removeAttr('style'); //TODO remove this from here because sometimes we close videoview when call is not finished
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

    // All dial buttons and call/hangup go unpressed after mouseup. Except if it disabled mode. 
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
    
    // dialButtons sends DTMF signals
    $(".dialButton").click(function() {
    	if (currentCall != null && currentCall.state == STATE_TALK) {
      		sendDTMF(currentCall.id, $(this).html());
      		var dialScreenText = $('.dialScreen').html();
      		if (dialScreenText.length > 10){
      			$('.dialScreen').html(dialScreenText.substr(1) + $(this).html());
      		}else{
      			$('.dialScreen').append($(this).html());
      		}
    	}
    });    
    
    // mic button opens mic slider
    $("#micButton").click(function() {
      if ($(this).hasClass('pressed')) {
        $('#micSlider').show();
        $('#micBack').show();
      } else {
        $('#micSlider').hide();
        $('#micBack').hide();
      }
    });    
    
    // sound button opens sound slider
    $("#soundButton").click(function() {
      if ($(this).hasClass('pressed')) {
        $('#speakerSlider').show();
        $('#speakerBack').show();
      } else {
        $('#speakerSlider').hide();
        $('#speakerBack').hide();
      }
    });

    // call button makes call or hangup
    $("#callButton:not(.disabled)").click(function() {
      if ($(this).html() == 'Call') {
        callByToken(null);
      } else {
        hangup(currentCall.id);
      }
    });

    // Mic slider set mic volume when you slide it
		$("#micSlider").slider({
			orientation: "vertical",
			range: "min",
			min: 0,
			max: 100,
      value: 60,
			slide: function(event, ui) {
        flashphoner.setMicVolume(ui.value);
      }
		});
	
	  // Speaker slider set speaker volume when you slide it
	  $("#speakerSlider").slider({
			orientation: "vertical",
			range: "min",
			min: 0,
			max: 100,
			value: 60,
      slide: function(event, ui) {  
        flashphoner.setVolume(ui.value);      
      }
		});


    // Camera button opens video window.
    // Depends on situation it can be both video or just my video
    
    
    $("#cameraButton").click(function() {
      if ($(this).hasClass('pressed')) {
        if(proportion != 0){
          openVideoView('big');
        } else {
          openVideoView('small');
        }
      } else {
        closeVideoView();
      }
    });    
    
    
    /*$("[id = 'cameraButton'][class != 'button pressed']").click(function() {
      if(proportion != 0){
        openVideoView('big');
      } else {
        openVideoView('small');
      }
    });

    $("[id = 'cameraButton'][class = 'button pressed']").click(function() {
      closeVideoView();
    });
    */
        
    

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
    /* -------- DEPRECATED ------
    $("#cameraButton").click(function() {
      openVideoView();
    });
    */

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

    // this functions resize flash when you resize video window
    $('#video_requestUnmuteDiv').resize(function() {
        $('#jsSWFDiv').height($(this).height() - 40);
    });

    


});



	