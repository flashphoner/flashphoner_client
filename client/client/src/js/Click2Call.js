/*
Copyright (c) 2011 Flashphoner
All rights reserved. This Code and the accompanying materials
are made available under the terms of the GNU Public License v2.0
which accompanies this distribution, and is available at
http://www.gnu.org/licenses/old-licenses/gpl-2.0.html

Contributors:
    Flashphoner - initial API and implementation

This code and accompanying materials also available under LGPL and MPL license for Flashphoner buyers. 
Other license versions by negatiation. Write us support@flashphoner.com with any questions.
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
var traceEnabled = true;
var intervalId = -1;
var isMutedMicButton = false;
var isMutedSpeakerButton = false;
var proportion = 0;
var proportionStreamer = 0;
var callToken = "";

var timerHours = 0;
var timerMinutes = 0;
var timerSeconds = 0;
var timerTimeout;

var testInviteParameter = new Object;
testInviteParameter['param1'] = "value1";
testInviteParameter['param2'] = "value2";

// trace log to the console in the demo page
function trace(funcName, param1, param2, param3) {

    var today = new Date();
    // get hours, minutes and seconds
    var hh = today.getHours(); 
    var mm = today.getMinutes();
    var ss = today.getSeconds();
    
    // Add '0' if it < 10 to see 14.08.06 instead of 14.6.8
    hh = hh == 0 ? '00' : hh < 10 ? '0' + hh : hh;
    mm = mm == 0 ? '00' : mm < 10 ? '0' + mm : mm;
    ss = ss == 0 ? '00' : ss < 10 ? '0' + ss : ss;
    
    // set time 
    var time = hh + ':' + mm + ':' + ss;
     
    var div1 = div2 = ''; 
     
    var console = $("#console");
    // Check if console is scrolled down? Or may be you are reading previous messages.
    var isScrolled = (console[0].scrollHeight - console.height() + 1) / (console[0].scrollTop + 1 + 37); 

    // Check if we set params and set it ????? instead of 'undefined' if not, also set dividers equal to ', ' 
    if (typeof param1 == 'undefined') {param1 = '';}
    if (typeof param2 == 'undefined') {param2 = '';} else {var div1 = ', ';}
    if (typeof param3 == 'undefined') {param3 = '';} else {var div2 = ', ';} 
    
    // Print message to console
    if (traceEnabled) {
        console.append('<grey>' + time + ' - '  + '</grey>' + funcName + '<grey>' + '(' + param1 + div1 + param2 + div2 + param3 + ')' + '</grey>' + '<br>');
    }

    //Autoscroll cosole if you are not reading previous messages
    if (isScrolled < 1) {
        console[0].scrollTop = console[0].scrollHeight; 
    }
}

function timer() {

  if (timerHours < 10) {mTimerHours = "0" + timerHours} else {mTimerHours = timerHours}
  if (timerMinutes < 10) {mTimerMinutes = "0" + timerMinutes} else {mTimerMinutes = timerMinutes}
  if (timerSeconds < 10) {mTimerSeconds = "0" + timerSeconds} else {mTimerSeconds = timerSeconds}

  $("#timer").html(mTimerHours + ":" + mTimerMinutes + ":" + mTimerSeconds);
  
  timerSeconds = timerSeconds + 1;
  
  if ( timerSeconds == 60) {
    timerMinutes = timerMinutes + 1; 
    timerSeconds = 0;
  }

  if ( timerMinutes == 60) {
    timerHours = timerHours + 1; 
    timerMinutes = 0;
  }  
   
  timerTimeout = setTimeout("timer()", 1000);
}

$(document).ready(function() {
    if (playerIsRight()) {
    	$('#callState').html('...Loading...');
    }else{
    	$('#callState').html('You have old flash player');
		trace("Download flash player from: http://get.adobe.com/flashplayer/");
    }
});


function loginByToken(token) {
    trace("loginByToken", window.location, token);
    $('#callState').html('...Calling...');
    
    if (navigator.userAgent.indexOf("Firefox") != -1) {
      var pageUrl = window.location.toString();
      trace ("Client browser is Firefox");
    }
    
    var result = flashphoner.loginByToken(token, pageUrl);
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
    trace("callByToken", token);
    if (isLogged) {
        if (isMuted() == 1) {
            intervalId = setInterval('if (isMuted() == -1){closeRequestUnmute(); clearInterval(intervalId);callByToken(callToken);}', 500);
            requestUnmute();
        } else if (isMuted() == -1){
            var result = flashphoner.callByToken(token, false, testInviteParameter);
            if (result == 0) {
            	$('#callState').html('...Calling...');
                toHangupState();
            }
    	} else {
    		openInfoView("Microphone is not plugged in", 3000);
    	}        
    } else {
        loginByToken(null);
    }
}

function hangup(callId) {
    trace("hangup", callId);
    flashphoner.hangup(callId);
}

function sendDTMF(callId, dtmf) {
    trace("sendDTMF", callId, dtmf);
    flashphoner.sendDTMF(callId, dtmf);
}

function isMuted() {
    var isMute = flashphoner.isMuted();
    return isMute;
}

// TODO change img to background
function sendVideoChangeState() {
    trace("sendVideoChangeState");
    var sendVideoButton = $('.sendVideoButton');
    var sendVideoButtonImage = $('#sendVideoButtonImage'); 
    
    if (sendVideoButton.hasClass('on')) {
        sendVideoButton.toggleClass('on');
        sendVideoButtonImage.attr('src','assets/c2c_play.png')
        flashphoner.setSendVideo(false);
    } else {
        sendVideoButton.toggleClass('on');
        sendVideoButtonImage.attr('src','assets/c2c_pause.png')
        flashphoner.setSendVideo(true);
    }
}

function initSendVideoButton(){
    var sendVideoButton = $('.sendVideoButton');
    var sendVideoButtonImage = $('#sendVideoButtonImage');
    if (sendVideoButton.hasClass('on')) {
        sendVideoButton.toggleClass('on');
        sendVideoButtonImage.attr('src','assets/c2c_play.png')
        flashphoner.setSendVideo(false);    	
    }	
}

function viewVideo() {
    trace("viewVideo");
    flashphoner.viewVideo();   
}

function viewAccessMessage() {
    trace("viewAccessMessage");
    flashphoner.viewAccessMessage();
}

function changeRelationMyVideo(relation) {
    trace("changeRelationMyVideo", relation);
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
    trace("getVersion");
    return flashphoner.getVersion();
}
/* ------------------ Notify functions ----------------- */

function addLogMessage(message) {
    trace('addLogMessage', message);
}

function notifyFlashReady() {
	trace("notifyFlashReady");
	$('versionOfProduct').html(getVersion());
	loginByToken(null);
  $("#micSlider").slider("option","value",getMicVolume());	
  $("#speakerSlider").slider("option","value",getVolume());
}

function notifyRegisterRequired(registerR) {
    registerRequired = registerR;
}

function notifyCloseConnection() {
    trace("notifyCloseConnection");
	currentCall = null;
    toCallState();
    isLogged = false;
    closeVideoView();
    initSendVideoButton();
    $('#callState').html('Finished');
}

function notifyConnected() {
    trace("notifyConnected");
    if (!registerRequired) {
        isLogged = true;
        callByToken(callToken);
    }
}

function notifyRegistered() {
    trace("notifyRegistered");
    if (registerRequired) {
        isLogged = true;
        callByToken(callToken);
    }
}                                                       

function notifyBalance(balance) {
}

// This functions invoked every time when call state changed
function notify(call) {
    trace('notify', call.id, call.anotherSideUser);
    if (currentCall.id == call.id) {
        currentCall = call;
        if (currentCall.visibleNameCallee != null){
        	if (currentCall.visibleNameCallee.length > 11){
        		$('#caller').css('font-size', 20);
        		$('#caller').css('top', 95);
        	}
        	$('#caller').html(currentCall.visibleNameCallee);
        } else {
        	$('#caller').html(currentCall.callee);
        }
        // if we finish the call
        if (call.state == STATE_FINISH) {
            proportion = 0; 
            closeVideoView();
            initSendVideoButton();
            $('#callState').html('Finished');
            toCallState();
            
            timerMinutes = 0;
            timerHours = 0;
            timerSeconds = 0;
            $("#timer").hide();
            clearTimeout(timerTimeout);
        // if call is holded
        } else if (call.state == STATE_HOLD) {
            $('#callState').html('...Holded...');
        // or if call is started talk
        } else if (call.state == STATE_TALK) {
            $('#callState').html('...Talking...');
            timer();
            $("#timer").show();
        // or if we just ringing    
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

    trace("notifyError", error);

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
    toCallState();
}

function notifyVideoFormat(call) {
    trace("notifyVideoFormat", call.id);

    // proportionStreamer allow us change proportion of small video window (myself preview video)
    if (call.streamerVideoWidth != 0) {
        proportionStreamer = call.streamerVideoHeight / call.streamerVideoWidth;
        if (proportionStreamer != 0) {
            /** Here we change size of small myself preview video window in the swf from the js code. 
             * To be precise we cnahge only height, width is fixed and equal to 20% of big video.
             */ 
            changeRelationMyVideo(proportionStreamer);
        }
    }

    if (!call.playerVideoHeight == 0) { //that mean other side really send us video
        proportion = call.playerVideoHeight / call.playerVideoWidth; //set proportion of video picture, else it will be = 0
        var newHeight = 320 * proportion;
        $('.video').height(newHeight);
        $('#jsSWFDiv').height(newHeight).width(320);
        //$('#c2c').height(newHeight+40);
    }
}

function notifyOpenVideoView(isViewed){
	trace("notifyOpenVideoView: isViewed = " + isViewed);
	if (isViewed){
		openVideoView('big');
	}else{
		closeVideoView();
	}
}

function notifyMessage(messageObject) {
    trace('notifyMessage', messageObject.from, messageObject.body);
}

function notifyAddCall(call) {
    trace("notifyAddCall", call.id, call.anotherSideUser);
    if (call.incoming == true) {
        hangup(call.id);
    } else {
        currentCall = call;
       	$('#caller').html(currentCall.anotherSideUser);
    }
}

function notifyRemoveCall(call) {
    trace("notifyRemoveCall", call.id);
    if (currentCall != null && currentCall.id == call.id) {
        currentCall = null;
    }
}

function notifyVersion(version){
	getElement('versionOfProduct').innerHTML = version;
}
/* ----------------------------------------------------------------------- */

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
    trace("openVideoView", size);
    viewVideo();
    $('#cameraButton').addClass('pressed');
    // if we already give access to devices when trying to open video view
    if (isMuted() == -1){

      // show send my video button
      $('.sendVideoButton').show();
      
      // if we need show only myself video (when other side dont send us video)
      // or if we need show both videos - ourselves and partner`s 
      if ((size == 'big')&&(proportion != 0)) { // sometimes voip servers send video with null sizes. Here we defend from such cases
          $('#flash').removeClass('init').addClass('video');
          var newHeight = 320 * proportion;
          $('.video').height(newHeight);
          $('#jsSWFDiv').height(newHeight).width(320);
          $('#c2c').height(newHeight+40);
      } else if (size == 'small') {
        $('#flash').removeClass('init').addClass('videoMy');
        $('#jsSWFDiv').height(240).width(320);
      } else {
      	$('#flash').removeClass('init').addClass('video');
        $('#jsSWFDiv').height(240).width(320);
      	
      }
        
    // or if we did not access the devices yet
    } else {
        requestUnmute();
        intervalId = setInterval('if (isMuted() == -1){closeRequestUnmute(); clearInterval(intervalId); openVideoView("small");}', 500);
    }
}

function closeVideoView() {
    trace("closeVideoView");
    // turn flash div back to init size
    $('#flash').removeClass().removeAttr('style').addClass('init');
    // turn c2c div back to init size  
    $('#c2c').height(240);
    // hide send video button
    $('.sendVideoButton').hide();
    // unpressed camerabutton
    $('#cameraButton').removeClass('pressed');
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

/* TODO make good auto trace                       
function getFnName(fn) {
  return fn.toString().match(/function ([^(]*)\(/)[1];
}
*/


/* --------------------- On document load we do... ------------------ */
$(function() {

    // load c2c interface in frame c2c-test for showing in popup
    // $('#c2c-test').load('Click2callJS.html', alert('done'));
    
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
      if (! $(this).hasClass('disabled')) {
        if ($(this).html() == 'Call') {
          callByToken(callToken);
        } else {
          hangup(currentCall.id);
        }
      }
    });


    // call me  button opens new window with click2call
    $("#callMeButton1:not(.disabled)").click(function() {
      window.open('click2call-test-1.html','_blank','width=340,height=260,resizable=no,toolbar=no,menubar=no,location=no,status=no,scrollbar=no')
    });     

    $("#callMeButton2:not(.disabled)").click(function() {
      window.open('click2call-test-2.html','_blank','width=340,height=260,resizable=no,toolbar=no,menubar=no,location=no,status=no,scrollbar=no')
    });     

    $("#callMeButton3:not(.disabled)").click(function() {
      window.open('click2call-test-3.html','_blank','width=340,height=260,resizable=no,toolbar=no,menubar=no,location=no,status=no,scrollbar=no')
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
        $('.sendVideoButton').show();
        if(proportion != 0){
          openVideoView('big');
        } else {
          openVideoView('small');
        }
      } else {
        $('.sendVideoButton').hide();
        closeVideoView();
      }
    });    
    
    // bind effects to click on send video button
    // and toggle video on/off by clicking
    $('.sendVideoButton').mousedown(function() {
      $(this).addClass('sendVideoButtonPressed');
    }).mouseup(function() {
      $(this).removeClass('sendVideoButtonPressed');    
    }).mouseover(function() {
      $(this).removeClass('sendVideoButtonPressed');    
    }).click(function() {
      sendVideoChangeState();
    });
    
    // Settings button button opens settings view  
    $("#settingsButton").click(function() {
      if ($(this).hasClass('pressed')) {
        
        $("#settingsView").show();
        
        var micList = flashphoner.getMicropones();
        var camList = flashphoner.getCameras();
 
        //clear it each time, else we append it more and more... 
        $("#micSelector").html("");
        $("#camSelector").html("");
        
        for (var i = 0; i < micList.length; i++) {
          $("#micSelector").append('<option value="' + micList[i] + '">' + micList[i] + '</option>');
        }

        // we use here index instead of name because AS getcamera can only use indexes
        for (var i = 0; i < camList.length; i++) {
          $("#camSelector").append('<option value="' + i + '">' + camList[i] + '</option>');
        }
        
      } else {
        $("#settingsView").hide();
      }
    }); 
    

    $("#micSelector").change(function() {
      flashphoner.setMicrophone($(this).val());
      trace('Microphone changed to ', $(this).val());
    });

    $("#camSelector").change(function() {
      flashphoner.setCamera($(this).val());
      trace('Camera changed to ', $(this).val());
    });
    
    $("#settingsOkButton").click(function() {
      $("#settingsView").hide();
      $("#settingsButton").removeClass("pressed");
    });
    
});



	