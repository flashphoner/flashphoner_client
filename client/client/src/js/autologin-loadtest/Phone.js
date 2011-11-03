/*
Copyright (c) 2011 Flashphoner
All rights reserved. This Code and the accompanying materials
are made available under the terms of the GNU Public License v2.0
which accompanies this distribution, and is available at
http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
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
var timeout_func;

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
    toLogOffState();
    if (playerIsRight()) {
    	openConnectingView("Loading...", 0);
    }else{
    	openConnectingView("You have old flash player", 0);
		trace("Download flash player from: http://get.adobe.com/flashplayer/");
    }
});


function login() {
    trace('login');
    connectingViewBeClosed = false;
    var result = flashphoner.login('sip:' + $('#username').val() + '@' + $('#server').val() + ':' + $('#port').val(), $('#password').val(), $('#authname').val());
    closeLoginView();
    if (result == 0) {
        openConnectingView("Connecting...", 0);
        setCookie("login", $('#username').val());
        setCookie("authName", $('#authname').val());
        setCookie("pwd", $('#password').val());
        setCookie("sipProviderAddress", $('#server').val());
        setCookie("sipProviderPort", $('#port').val());
    }
}

function loginWithToken(token) {
    trace("loginWithToken; token - " + token);
    connectingViewBeClosed = false;
    var result = flashphoner.loginWithToken(token);

    closeLoginView();
    openConnectingView("Connecting...", 0);
}

function getInfoAboutMe() {
    trace("getInfoAboutMe");
    return flashphoner.getInfoAboutMe();
}

function logoff() {
    trace("logoff");
    flashphoner.logoff();
}

function call() {
    trace("call");
    if (isLogged) {
        if (isMuted() == 1) {
            intervalId = setInterval('if (isMuted() == -1){closeRequestUnmute(); clearInterval(intervalId);call();}', 500);
            requestUnmute();
        } else if (isMuted() == -1){
            var result = flashphoner.call(getElement('calleeText').value, 'Caller');
            if (result == 0) {
                toHangupState();
            } else {
                openConnectingView("Callee number is wrong", 3000);
            }
    	} else {
    		openConnectingView("Microphone is not plugged in", 3000);
    	}        
    } else {
        openLoginView();
    }
}

function sendMessage(to, body, contentType) {
    trace("sendMessage; to - " + to + "; body - " + body);
    flashphoner.sendMessage(to, body, contentType);
}


function answer(callId) {
    trace("answer; callId - " + callId);
    if (isMuted() == 1) {
        intervalId = setInterval('if (isMuted() == -1){closeRequestUnmute(); clearInterval(intervalId);answer(currentCall.id);}', 500);
        requestUnmute();
    } else if (isMuted() == -1){
        flashphoner.answer(callId);
    } else {
    	openConnectingView("Microphone is not plugged in", 3000);
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

function setStatusHold(callId, isHold) {
    trace("setStatusHold; callId - " + callId + "; isHold - " + isHold);
    flashphoner.setStatusHold(callId, isHold);
    disableHoldButton();
}

function transfer(callId, target) {
    trace("transfer; callId - " + callId + "; target - " + target);
    flashphoner.transfer(callId, target);
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
        micButton.style.background = "url(assets/mic_crossed.png)";
        micVolume = getMicVolume();
        flashphoner.setMicVolume(0);
        isMutedMicButton = true;
    } else {
        micButton.style.background = "url(assets/mic.png)";
        flashphoner.setMicVolume(micVolume);
        isMutedMicButton = false;
    }
}

function changeSpeakerStatus() {
    trace("changeSpeakerStatus");
    var soundButton = getElement('soundButton');
    if (isMutedSpeakerButton == false) {
        soundButton.style.background = "url(assets/sound_crossed.png)";
        speakerVolume = getVolume();
        flashphoner.setVolume(0);
        isMutedSpeakerButton = true;
    } else {
        soundButton.style.background = "url(assets/sound.png)";
        flashphoner.setVolume(speakerVolume);
        isMutedSpeakerButton = false;
    }
}

function setCookie(key, value) {
    trace("setCookie; key - " + key + "; value - " + value);
    flashphoner.setCookie(key, value);
}

function getCookie(key) {
    trace("getCookie; key - " + key);
    return flashphoner.getCookie(key);
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
	getElement('versionOfProduct').innerHTML = getVersion();
    if (flashvars.token != null) {
        loginWithToken(flashvars.token);
    } else {
        closeConnectingView();
    }
}

function notifyRegisterRequired(registerR) {
    registerRequired = registerR;
}

function notifyCloseConnection() {
    trace("notifyCloseConnection");
    toLogOffState();
    toCallState();
    isLogged = false;
    closeIncomingView();
    closeVideoView();
    closeCallView();
    getElement('sendVideo').value = "Send video";
}

function notifyConnected() {
    trace("notifyConnected");
    if (registerRequired) {
        if (!connectingViewBeClosed) {
            openConnectingView("Waiting register event", 0);
        }
    } else {
        toLogState();
        callerLogin = getInfoAboutMe().login;
        getElement("loggedUserDiv").innerHTML = callerLogin;
        isLogged = true;
        closeConnectingView();
    }
}

function notifyRegistered() {
    trace("notifyRegistered");
    if (registerRequired) {
        toLogState();
        callerLogin = getInfoAboutMe().login;
        getElement("loggedUserDiv").innerHTML = callerLogin;
        isLogged = true;
        closeConnectingView();
    }
    call();    
}

function try_hangup(){
  hangup(callId);	
}

function notifyBalance(balance) {
}

function notify(call) {
    trace("notify: callId " + call.id + " --- " + call.anotherSideUser);
    if (currentCall.id == call.id) { //if we have some call now and notify is about exactly our call
        currentCall = call;
        if (call.state == STATE_FINISH) {
            // if that hangup during transfer procedure?
            if (holdedCall != null) {
                currentCall = holdedCall; //holded call become current
                holdedCall = null; //make variable null
                createCallView(currentCall);
            } else {
                closeIncomingView();
                closeVideoView();
                toCallState();
            }
            getElement('sendVideo').value = "Send video";
	    setTimeout("call();",5000);
            // or this just usual hangup during the call
        } else if (call.state == STATE_HOLD) {
            $('#callState').html('...Call on hold...');
            enableHoldButton();
        } else if (call.state == STATE_TALK) {
            if (call.isVideoCall) {
                openVideoView();
            }
            $('#callState').html('...Talking...');
            enableHoldButton();
	    setTimeout("hangup('"+call.id+"');", 5000);
        } else if (call.state == STATE_RING) {
            $('#callState').html('...Ringing...');
        }
    } else if (holdedCall.id == call.id) {
        if (call.state == STATE_FINISH) {
            /* that mean if
             - user1 call user2
             - user2 transfer to user3
             - user3 just thinking (not answer, not hangup)
             - user2 hangup during him thinking
             then we delete old holded call from user1 memory
             */
            holdedCall = null;	    
        }
        enableHoldButton();
    }
}

function notifyCallbackHold(call, isHold) {
    trace("notifyCallbackHold: callId - " + call.id + "; isHold - " + isHold);
    if (currentCall != null && currentCall.id == call.id) {
        currentCall = call;
        if (call.iHolded) {
            getElement('holdButton').style.background = "url(assets/unhold.png)";
            getElement('holdButton').onclick = function() {
               	setStatusHold(call.id, false);
            }
        } else {
            getElement('holdButton').style.background = "url(assets/hold.png)";
            getElement('holdButton').onclick = function() {
               	setStatusHold(call.id, true);
            }
        }
    }
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
    openChatView();

    //if (messageObject.from == $('#loggedUserDiv').html()) {
    if (messageObject.from == callerLogin) { //check if it outcoming or incoming message
        createChat(messageObject.to.toLowerCase());
        var chatTextarea = $('#chat' + messageObject.to.toLowerCase() + ' .chatTextarea'); //set current textarea for
        var isScrolled = (chatTextarea[0].scrollHeight - chatTextarea.height() + 1) / (chatTextarea[0].scrollTop + 1); // is chat scrolled down? or may be you are reading previous messages.
        chatTextarea.append('<div class=myNick>' + messageObject.from + '</div>' + messageObject.body + '<br>'); //add message to chat
    } else {
        createChat(messageObject.from.toLowerCase());
        var chatTextarea = $('#chat' + messageObject.from.toLowerCase() + ' .chatTextarea'); //set current textarea
        var isScrolled = (chatTextarea[0].scrollHeight - chatTextarea.height() + 1) / (chatTextarea[0].scrollTop + 1); // is chat scrolled down? or may be you are reading previous messages.
        chatTextarea.append('<div class=yourNick>' + messageObject.from + '</div>' + messageObject.body + '<br>'); //add message to chat
    }

    if (isScrolled == 1) {
        chatTextarea[0].scrollTop = chatTextarea[0].scrollHeight; //autoscroll if you are not reading previous messages
    }
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

function createCallView(call) {
    //trace('createCallView');
    openCallView();
    $('#caller').html(call.anotherSideUser);

    getElement('holdButton').onclick = function() {
       	setStatusHold(call.id, !call.isHolded);
	}

    $('#transferButton').click(function() {
        openTransferView(call);
    });
}

function removeCallView(call) {
    //trace('removeCallView');
    closeCallView();
    $('#caller').html('');
    $('#callState').html('');
    $('#holdButton').css('background', 'url(assets/hold.png)');
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

/* --------------- Additional functions ------------------- */

function toLogState() {
    trace("toLogState");
    $('#loginMainButton').val('Log out');
}

function toLogOffState() {
    trace("toLogOffState");
    $('#loginMainButton').val('Log in');
    $('#loggedUserDiv').html('');
}

function toHangupState() {
    trace("toHangupState");
    $('#callButton').val("Hangup");
    $('#callButton').css('background', '#C00');
    disableCallButton();
}

function toCallState() {
    trace("toCallState");
    $('#callButton').val("Call");
    $('#callButton').css('background', '#090');
    disableCallButton();
}

function disableCallButton() {
    trace("disableCallButton");
    var button = $('#callButton');

    button.css('background', 'gray').prop('disabled', true); //change color to gray and disable

    // this function will change color to red/green and enable button
    // TODO make states for button
    function enableCallButton() {
        button.prop('disabled', false);
        //if button have call state - make it green, else - make it red
        if (button.val() == 'Call') {
            button.css('background', '#090');
        } else {
            button.css('background', '#c00');
        }
    }

    window.setTimeout(enableCallButton, 3000); //set previous color and enable
}

function enableHoldButton() {
    trace("enableHoldButton");
    var button = $('#holdButton');
   	button.css('visibility', 'inherit');
}

function disableHoldButton() {
    trace("disableHoldButton");
    var button = $('#holdButton');
    button.css('visibility', 'hidden');
}


function openLoginView() {
    if (flashvars.token != null) {
        loginWithToken(flashvars.token);
    } else {
        trace("openLoginView");
        $('#loginDiv').css('visibility', 'visible');
        $('#username').val(getCookie('login'));
        $('#authname').val(getCookie('authName'));
        $('#password').val(getCookie('pwd'));
        $('#server').val(getCookie('sipProviderAddress'));
        $('#port').val(getCookie('sipProviderPort'));
    }

}

function closeLoginView() {
    trace("closeLoginView");
    $('#loginDiv').css('visibility', 'hidden');
}

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
    trace("openInfoView: message - " + str + "; timeout - " + timeout);
   	if (timeout != 0) {
        window.setTimeout("closeInfoView();", timeout);
    }
   	getElement('infoDiv').style.visibility = "visible";
   	getElement('infoDiv').style.height = height+"px";
    getElement('infoText').innerHTML = str;
}

function closeInfoView() {
    trace("closeInfoView");
    getElement('infoDiv').style.visibility = "hidden";
}

function openIncomingView(call) {
    trace("openIncomingView: caller " + call.caller + " visibleNameCaller " + call.visibleNameCaller);
    getElement('answerButton').onclick = function() {
        answer(call.id);
        closeIncomingView();
    };
    getElement('hangupButton').onclick = function() {
        hangup(call.id);
        closeIncomingView();
    };

    getElement('incomingDiv').style.visibility = "visible";
    getElement('callerField').innerHTML = call.caller + " '" + call.visibleNameCaller + "'";
}

function closeIncomingView() {
    trace("closeIncomingView");
    getElement('incomingDiv').style.visibility = "hidden";
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
    getElement('sendVideo').click();
}

function closeVideoView() {
    trace("closeVideoView");
    $('#video_requestUnmuteDiv').removeClass().addClass('closed');
}

/* ----- CHAT ----- */

function openChatView() {
    trace("openChatView");
    $('#chatDiv').css('visibility', 'visible');
}
function closeChatView() {
    trace("closeChatView");
    $('#chatDiv').css('visibility', 'hidden');
}
/*-----------------*/

/* ----- CALL ----- */
function openCallView() {
    trace("openCallView");
    $('#callDiv').css('visibility', 'visible');
}
function closeCallView() {
    trace("closeCallView");
    $('#callDiv').css('visibility', 'hidden');
}
/*-----------------*/
/* ----- TRANSFER ----- */
function openTransferView(call) {
    trace("openTransferView");
    getElement('transferDivButton').onclick = function() {
        transfer(currentCall.id, getElement('transferDivInput').value);
        closeTransferView();
    };

    if (call.state != STATE_HOLD) {
        setStatusHold(call.id, true);
    }
    getElement('transferDiv').style.visibility = "visible";
}

function closeTransferView() {
    trace("closeTransferView");
    getElement('transferDiv').style.visibility = "hidden";
}
/*-----------------*/

/* ------------- Additional interface functions --------- */

// Functions createChat creates chat with the callee. 
// It contains all chat window functionality including send message function 

function createChat(calleeName) {

    //var closetab = '<a href="" id="close' + calleeName + '" class="close">&times;</a>';
    //$("#tabul").append('<li id="tab' + calleeName + '" class="ntabs">' + calleeName + '&nbsp;' + closetab + '</li>'); //add tab with the close button

    if (!$('li').is('#tab' + calleeName)) {
        var closetab = '<a href="" id="close' + calleeName + '" class="close">&times;</a>';
        var shortCalleeName = calleeName;

        // We will cut too long calleeNames to place it within chat tab
        if (calleeName.length > 21) {
            shortCalleeName = calleeName.substr(0, 21) + '...';
        }


        $("#tabul").append('<li id="tab' + calleeName + '" class="ntabs"> ' + shortCalleeName + '&nbsp;' + closetab + '</li>'); //add tab with the close button


        $('#tabcontent').append('<div class=chatBox id=chat' + calleeName + '>') //add chatBox
        $('#chat' + calleeName).append('<div class=chatTextarea></div>')//add text area for chat messages
            .append('<input class=messageInput type=textarea>')//add input field
            .append('<input class=messageSend type=button value=Send>'); //add send button

        $("#tabul li").removeClass("ctab"); //remove select from all tabs
        $("#tab" + calleeName).addClass("ctab"); //select new tab
        $(".chatBox").hide(); //hide all chatBoxes
        $("#chat" + calleeName).show(); //show new chatBox

        // Bind send message on click Enter in message inout field

        $('#chat' + calleeName + ' .messageInput').keydown(function(event) {
            if (event.keyCode == '13') {
                //trace($(this).next().val());
                $(this).next().click(); // click on sendMessage button
            } else if (event.keyCode == '27') {
                $(this).val('');
            }
        });

        // Bind send message function
        $('#chat' + calleeName + ' .messageSend').click(function() {
            var calleeName = $(this).parent().attr('id').substr(4); //parse id of current chatBox, take away chat word from the beginning
            var messageText = $(this).prev().val(); //parse text from input
            sendMessage(calleeName, messageText, 'text/plain'); //send message
            $(this).prev().val(''); //clear message input
        });

        // Bind selecting tab
        $("#tab" + calleeName).bind("click", function() {
            $("#tabul li").removeClass("ctab"); //hide all tabs
            $("#tab" + calleeName).addClass("ctab"); //select clicked tab
            $(".chatBox").hide(); //chide all chatBoxes
            $("#chat" + calleeName).show(); //show new chatBox
        });

        // Bind closing tab on click 
        $("#close" + calleeName).click(function() {
            //close this tab
            $(this).parent().hide();
            $("#chat" + calleeName).hide();

            var prevVisibleTab = $(this).parent().prevAll().filter(':visible').filter(':first'); //set prev visible tab
            var nextVisibleTab = $(this).parent().nextAll().filter(':visible').filter(':first'); //set next visible tab

            if ($(this).parent().is('.ctab')) { //but what if this tab was selected?
                $(this).parent().removeClass("ctab"); //we will unselect this
                if (prevVisibleTab.is('.ntabs')) { //and if there is prev tab
                    prevVisibleTab.addClass('ctab'); //then select prev tab
                    $('#chat' + prevVisibleTab.attr('id').substr(3)).show(); //and show accoring chat

                } else if (nextVisibleTab.is('.ntabs')) { //or if there is next tab
                    nextVisibleTab.addClass('ctab'); //then select next tab
                    $('#chat' + nextVisibleTab.attr('id').substr(3)).show(); //and show accoring chat

                } else {
                    $('#chatDiv').css('visibility', 'hidden'); //else simply close all chat
                }
            }
            ;
            return false; // i don`t know why it need
        });
    } else {
        $("#tabul li").removeClass("ctab"); //remove select from all tabs
        $("#tab" + calleeName).show(); //show our tab
        $("#tab" + calleeName).addClass("ctab"); //select our tab
        $(".chatBox").hide(); //hide all chatboxes
        $("#chat" + calleeName).show(); //show our chatBox

    }

}

/* ---------------------------------------------------- */

/* 
 This functions need to show window with the Adobe security panel when
 is ask allow use devices. This functions change size of window where swf is located.
 Sometimes this window use to show 'Request view', sometimes - to show 'Video view'
 */
function requestUnmute() {
    trace("requestUnmute");

    $('#video_requestUnmuteDiv').removeClass().addClass('securityDiv');
    $('#closeButton_video_requestUnmuteDiv').css('visibility', 'hidden');
    $('#sendVideo').css('visibility', 'hidden');
    $('#requestUnmuteText').show();

    getElement('jsSWFDiv').style.width = "214";
    getElement('jsSWFDiv').style.height = "138";
    getElement('jsSWFDiv').style.top = "35px";

    viewAccessMessage();
}

function closeRequestUnmute() {
    trace("closeRequestUnmute");
    $('#video_requestUnmuteDiv').removeClass().addClass('closed');
    getElement('jsSWFDiv').style.top = "20px";
}
/* ------------------------- */

// functions closeView is simplifying of many close....View functions
function close(element) {
    element.css('visibility', 'hidden');
}


/* --------------------- On document load we do... ------------------ */
$(function() {
    //Bind click on login link
    $("#loginMainButton").click(function() {
        if ($("#loginMainButton").val() == "Log in") {
            openLoginView();
        } else {
            logoff();
        }
    });

    $("#loginButton").click(function() {
        login();
    });

    //Bind click on different buttons
    $("#callButton").click(function() {
        if ($("#callButton").val() == 'Call') {
            call();
        } else {
            hangup(currentCall.id);
        }
    });

    $("#settingsButton").click(function() {
      openSettingsView();
    });
    
    $("#settingsButtonInCallView").click(function() {
      openSettingsView();
    });

    $("#cameraButtonInCallee").click(function() {
      openVideoView();
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

    $("#canselTransferView").click(function() {
      closeTransferView();
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
    $("#loginDiv").draggable({handle: '.bar', stack:"#loginDiv"});
    $("#incomingDiv").draggable({handle: '.bar', stack:"#incomingDiv"});
    $("#settingsDiv").draggable({handle: '.bar', stack:"#settingsDiv"});
    $("#transferDiv").draggable({handle: '.bar', stack:"#transferDiv"});
    $("#chatDiv").draggable({handle: '.bar', stack:"#chatDiv"});
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
    $(".button").mousedown(
        function() {
            $(this).css('border-style', 'inset');
        }).mouseup(
        function() {
            $(this).css('border-style', 'outset');
        }).mouseout(function() {
            $(this).css('border-style', 'outset');
        });

    // Bind click on chatButton
    $("#chatButton").click(function() {
        if (isLogged) {
            if ($('#calleeText').val() != '') {
                openChatView();
                createChat($('#calleeText').val().toLowerCase());
            } else {
                openConnectingView("Callee number is wrong", 3000);
            }
        } else {
            openLoginView();
        }
    });

    /* Autofill Aut. name field when you fil Login field */
    $('#username').keyup(function() {
        $('#authname').val($(this).val());
    });

    // this functions resize flash when you resize video window
    $('#video_requestUnmuteDiv').resize(function() {
        $('#jsSWFDiv').height($(this).height() - 40);
    });

});
