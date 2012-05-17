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

var _loginObject = null;

var managedCalls = new Object();
var flashphoner;

// One call become two calls during TRANSFER case
// there is why we need at least two kinds of calls here
var holdedCall = null;
var currentCall = null;
var callee = '';
// not sure if "callee" is reserved word so I will use callee1 /Pavel
var callee1 = '';
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

var testInviteParameter = new Object;
//testInviteParameter['param1'] = "value1";
//testInviteParameter['param2'] = "value2";

var MAGIC_SEQUENCE_COLON="aBcDeFgH_COLON";
var MAGIC_SEQUENCE_SEMICOLON="aBcDeFgH_SEMICOLON";
var MAGIC_SEQUENCE_AT="aBcDeFgH_AT";
var MAGIC_SEQUENCE_DOT="aBcDeFgH_DOT";
var MAGIC_SEQUENCE_COMMA="aBcDeFgH_COMMA";
var MAGIC_SEQUENCE_EQ="aBcDeFgH_EQ";
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

$(document).ready(function() {
    toLogOffState();
    if (playerIsRight()) {
    	openConnectingView("Loading...", 0);
    }else{
    	openConnectingView("You have old flash player", 0);
		  trace("Download flash player from: http://get.adobe.com/flashplayer/");
    }
});

function generateUUID(){
    var d = new Date().getTime();
    var uuid = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = d/16 | 0;
        return (c=='x' ? r : (r&0x7|0x8)).toString(16);
    });
    return uuid;
};

function login() {
    trace("login");
    connectingViewBeClosed = false;
    var loginObject = new Object();
    if (this._loginObject!=null){
	loginObject = this._loginObject;
    }else{
	loginObject.username = 'sip:' + $('#username').val() + '@' + $('#domain').val();
	loginObject.password = $('#password').val();
	loginObject.authenticationName = $('#authname').val();
	loginObject.outboundProxy = $('#outbound_proxy').val();
	loginObject.port = $('#port').val();
	loginObject.qValue = '1.0';        
	this._loginObject = loginObject;
    }
    var result = flashphoner.login(loginObject);
    closeLoginView();
    if (result == 0) {
        openConnectingView("Connecting...", 0);
        setCookie("login", $('#username').val());
        setCookie("authName", $('#authname').val());
        setCookie("pwd", $('#password').val());
        setCookie("domain", $('#domain').val());
        setCookie("outbound_proxy", $('#outbound_proxy').val());
        setCookie("port", $('#port').val());
    }
}

function loginByToken(token) {
    trace("loginByToken", token);
    connectingViewBeClosed = false;
    var result = flashphoner.loginByToken(token);

    closeLoginView();
    openConnectingView("Connecting...", 0);
}

function subscribe(subscribeObj){
    trace("subscribe", subscribeObj.event, subscribeObj.expires);
    flashphoner.subscribe(subscribeObj);
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
    trace("call", callee1);
    if (isLogged) {
        if (isMuted() == 1) {
            intervalId = setInterval('if (isMuted() == -1){closeRequestUnmute(); clearInterval(intervalId);call();}', 500);
            requestUnmute();
        } else if (isMuted() == -1){
            var result = flashphoner.call(callee1, 'Caller', false, testInviteParameter);
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

function deferredCall(){
	trace("deferredCall");
	flashphoner.call("sip:Deferred@yes.my", 'Caller');
}

function sendMessage(msgObject){
	trace("sendMessage", msgObject.id, msgObject.to, msgObject.body, msgObject.contentType);
	flashphoner.sendMessage(msgObject);
}

function sendRawRequest(rawRequest){
	var rawRequestText = getElement('rawRequestText').value;
	trace("sendRawRequest",rawRequestText);
	setCookie("rawRequestText", rawRequestText);	
	flashphoner.sendRawRequest(rawRequestText);		
}

function answer(callId) {
    trace("answer", callId);
    if (isMuted() == 1) {
        intervalId = setInterval('if (isMuted() == -1){closeRequestUnmute(); clearInterval(intervalId);answer(currentCall.id);}', 500);
        requestUnmute();
    } else if (isMuted() == -1){
        flashphoner.answer(callId);
    } else {
    	openConnectingView("Microphone is not plugged in", 3000);
    }
}

function ignore(callId) {
    trace("ignore", callId);
    flashphoner.ignore(callId);
}
function hangup(callId) {
    trace("hangup", callId);
    flashphoner.hangup(callId);
}

function sendDTMF(callId, dtmf) {
    trace("sendDTMF", callId, dtmf);
    if (dtmf=='#'){
	var infoObject = new Object();
	infoObject.callId = callId;
	infoObject.contentType = "application/broadsoft";
	infoObject.body = "event flashhook";
	flashphoner.sendInfo(infoObject);
	trace("senInfo",infoObject);
    } else{
	trace("sendDTMF");
    	flashphoner.sendDTMF(callId, dtmf);
    }	
}

function setStatusHold(callId, isHold) {
    trace("setStatusHold", callId, isHold);
    flashphoner.setStatusHold(callId, isHold);
    disableHoldButton();
}

function changeStatusHold(callId){
    trace("changeStatusHold");
    var call = managedCalls[callId];
    trace("current call status: "+call.state);
    if ("HOLD"==call.state){
    	//unhold
	setStatusHold(callId,false);
    }else{
	//hold
	setStatusHold(callId,true);	
    }
}


function transfer(callId, target) {
    trace("transfer", callId, target);
    flashphoner.transfer(callId,target);
}

function isMuted() {
    var isMute = flashphoner.isMuted();
    return isMute;
}

function sendVideoChangeState() {
    trace("sendVideoChangeState");
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

function saveMicSettings() {
    trace("saveMicSettings");
    flashphoner.setVolume(speakerVolume);
    flashphoner.setMicVolume(micVolume);
    closeSettingsView();
}

function setCookie(key, value) {
    trace("setCookie", key, value);
    flashphoner.setCookie(key, value);
}

function getCookie(key) {
    trace("getCookie", key);
    return flashphoner.getCookie(key);
}

function getVersion() {
    trace("getVersion");
    return flashphoner.getVersion();
}

function unholdManagedCall(){
    var callId = getElement('managedCallId').value;
    setStatusHold(callId, false);
}

function holdManagedCall(){
    var callId = getElement('managedCallId').value;
    setStatusHold(callId, true);
}

function answerManagedCall(){
    var callId = getElement('managedCallId').value;
    answer(callId);    
}

function hangupManagedCall(){
    var callId = getElement('managedCallId').value;    
    hangup(callId);
}

/* ------------------ Notify functions ----------------- */

function addLogMessage(message) {
    trace(message);
}

function notifyChangeMicVolume(volume){
	$("#micSlider").slider("option", "value", volume);
}


function notifySubscription(subscribeObject,sipObject){
  trace("notify subscription");
  trace("sipObject: "+sipObject.type+" "+sipObject.message.code+" "+sipObject.message.reason);
  trace("sipObject raw: "+sipObject.message.raw);
}

function notifyFlashReady() {
	$('#versionOfProduct').html(getVersion());
    if (flashvars.token != null) {
        loginWithToken(flashvars.token);
    } else {
        closeConnectingView();
    }
    getElement('rawRequestText').value=getCookie('rawRequestText');
}

function notifyRegisterRequired(registerR) {
    registerRequired = registerR;
}

function notifyCloseConnection() {
    trace("notifyCloseConnection");
    connected = false;
    currentCall = null;    
    toLogOffState();
    toCallState();
    isLogged = false;
    closeIncomingView();
    closeVideoView();
    closeCallView();
    getElement('sendVideo').value = "Send video";
    setTimeout(tryReconnect,10000);
}

function tryReconnect(){    
    if (!connected){
	trace("trying to reconnect");
	login();	
        setTimeout(tryReconnect,10000);
    }
}

function notifyConnected() {
    trace("notifyConnected");
    connected = true;
    if (registerRequired) {
        if (!connectingViewBeClosed) {
            openConnectingView("Waiting for registering...", 0);
        }
    } else {
        callerLogin = getInfoAboutMe().login;
        toLogState();
        isLogged = true;
        closeConnectingView();
        deferredCall();
    }
}

function notifyRegistered() {
    trace("notifyRegistered");
    if (registerRequired) {
        toLogState();
        callerLogin = getInfoAboutMe().login;
        getElement("callerLogin").innerHTML = callerLogin;
        isLogged = true;
        closeConnectingView();
	//subscribeReg();		
	//flashphoner.setProperty("local_audio_codec","speex16");
	//flashphoner.setProperty("out_jitter_buffer_enabled","true");
	//flashphoner.setSpeexQuality(8);
	setTimeout("deferredCall()",3000);        
    }
}

function subscribeReg(){
	var subscribeObj = new Object();
        subscribeObj.event="reg";
	subscribeObj.expires=3600;
	subscribe(subscribeObj);        
}

function notifyBalance(balance) {
}

function refreshManagedCalls(){
	var managedCallsElement = getElement('managedCalls');
	var str="";
	var i=0;
	for (var callId in managedCalls){
		i++;
		var managedCall = managedCalls[callId];
		var callStr = i+" | id: "+managedCall.id+" | caller: "+managedCall.caller+" | callee: "+managedCall.callee+" | state: "+managedCall.state;			
		str = str + callStr+"<br/>";		
	}
	managedCallsElement.innerHTML=str;		
}

function notify(call) {
    trace("notify", call.id, call.anotherSideUser);    
    getElement('managedCallId').value=call.id;
    managedCalls[call.id] = call;    
    refreshManagedCalls();

    if (call.isMSRP == true){
		trace("notify; Deferred message call");
		return;
	}
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
            // or this just usual hangup during the call
        } else if (call.state == STATE_HOLD) {
            $('#callState').html('...Call on hold...');
            enableHoldButton();
        } else if (call.state == STATE_TALK) {
            $('#callState').html('...Talking...');
            enableHoldButton();
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
    trace("notifyCallbackHold", call.id, isHold);
    if (currentCall != null && currentCall.id == call.id) {
        currentCall = call;
        if (call.iHolded) {
            getElement('holdButton').style.background = "url(assets/unhold.png)";            
        } else {
            getElement('holdButton').style.background = "url(assets/hold.png)";            
        }
    }
}

function notifyCost(cost) {
}

function notifyError(error, sipObject) {

    trace("notifyError", error);

    if (sipObject.message.reason){
		trace("notifyMessage.reason", "Protocol - "+sipObject.message.reason.protocol+", Cause - "+sipObject.message.reason.cause+", Text - "+sipObject.message.reason.text+", Raw - "+sipObject.message.reason.raw);    
    }

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
    trace("notifyVideoFormat", call);

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

function notifyOpenVideoView(isViewed){
	trace("notifyOpenVideoView", isViewed);
	if (isViewed){
		openVideoView();
	}else{
		closeVideoView();
	}
}

function notifyMessage(messageObject,sipObject) {
    trace('notifyMessage', messageObject.id, messageObject.from, messageObject.body, messageObject.state);
    trace("notifyMessage raw", '<br>' + sipObject.message.raw.replace(/\r\n|\r|\n/g,'<br>'));
    if (sipObject.message.reason){
		trace("notifyMessage.reason", "Protocol - "+sipObject.message.reason.protocol+", Cause - "+sipObject.message.reason.cause+", Text - "+sipObject.message.reason.text+", Raw - "+sipObject.message.reason.raw);    
    }
    openChatView();        
    
    
    //var x=document.f.t.value;
    //var y=x.replace(/\r\n|\r|\n/g,'<br>');
    
    
    
    var messageTo = messageObject.to.toLowerCase();
    if ((messageObject.recipients!=null)&&(messageObject.recipients.length!=0)){
	messageTo = messageTo+";"+messageObject.recipients;
    }

    var messageContent = messageObject.body;
    if (messageObject.state=="IMDN_FAILED" || messageObject.state=="ERROR" || messageObject.state=="FORBIDDEN"){
		messageContent = "<div class=msg_failed>"+messageContent+"</div>";
	}else if (messageObject.state=="SENT"){
    	messageContent = "<div class=msg_sent>"+messageContent+"</div>";
    }else if (messageObject.state=="ACCEPTED"){
    	messageContent = "<div class=msg_accepted>"+messageContent+"</div>";
    }else if (messageObject.state=="DELIVERED" || messageObject.state=="RECEIVED"){
    	messageContent = "<div class=msg_delivered>"+messageContent+"</div>";
    }
	if (messageObject.id != null){
		divMessage = document.getElementById(messageObject.id);
	}
	
    if (messageObject.from == callerLogin) { //check if it outcoming or incoming message
        createChat(messageTo);
        var chatTextarea = $('#chat' + encodeId(messageTo) + ' .chatTextarea'); //set current textarea for
        var isScrolled = (chatTextarea[0].scrollHeight - chatTextarea.height() + 1) / (chatTextarea[0].scrollTop + 1); // is chat scrolled down? or may be you are reading previous messages.
        if (divMessage != null){
        	divMessage.innerHTML='<div  class=myNick>' + messageObject.from + '</div>' + messageContent;
        }else{
        	chatTextarea.append('<div id="'+messageObject.id+'"><div  class=myNick>' + messageObject.from + '</div>' + messageContent + '</div><br>'); //add message to chat
        }
    } else {
        createChat(messageObject.from.toLowerCase());
        var chatTextarea = $('#chat' + encodeId(messageObject.from.toLowerCase()) + ' .chatTextarea'); //set current textarea
        var isScrolled = (chatTextarea[0].scrollHeight - chatTextarea.height() + 1) / (chatTextarea[0].scrollTop + 1); // is chat scrolled down? or may be you are reading previous messages.
		chatTextarea.append('<div class=yourNick>' + messageObject.from + '</div>' + messageContent + '<br>'); //add message to chat
    }

    if (isScrolled == 1) {
        chatTextarea[0].scrollTop = chatTextarea[0].scrollHeight; //autoscroll if you are not reading previous messages
    }
}

function notifyAddCall(call) {
    trace("notifyAddCall; callId - " + call.id + ", another side - " + call.anotherSideUser+", isMSRP - "+ call.isMSRP);
	if (call.isMSRP == true){
		trace("notifyAddCall; Added deferred message call");
		return;
	}
    if (currentCall != null && call.incoming == true) {
        //hangup(call.id);
	trace("New line call: "+call.id);
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
  openCallView();
  $('#caller').html(call.anotherSideUser);

  $('#holdButton').click(function() {
    setStatusHold(call.id, !call.isHolded);
	});

  $('#transferButton').click(function() {
    openTransferView(call);
  });
}

function removeCallView(call) {
    closeCallView();
    $('#caller').html('');
    $('#callState').html('');
    $('#holdButton').css('background', 'url(assets/hold.png)');
}


function notifyRemoveCall(call) {
    trace("notifyRemoveCall", call.id);
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
    $("#loginMainButton").hide();
    $("#callerLogin").show().html(callerLogin);
}

function toLogOffState() {
    trace("toLogOffState");
    $("#loginMainButton").show();
    $('#callerLogin').hide().html('');
}

function toHangupState() {
    trace("toHangupState");
    $('#callButton').html("Hangup");
    /*$('#callButton').css('background', '#C00');*/
    $('#callButton').removeClass('call').addClass('hangup');
    disableCallButton();
}

function toCallState() {
    trace("toCallState");
    $('#callButton').html("Call");
    /*$('#callButton').css('background', '#090');*/
    $('#callButton').removeClass('hangup').addClass('call');
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
        $('#domain').val(getCookie('domain'));
        $('#outbound_proxy').val(getCookie('outbound_proxy'));
        $('#port').val(getCookie('port'));
    }

}

function closeLoginView() {
    $('#loginDiv').css('visibility', 'hidden');
}

function openConnectingView(str, timeout) {
    trace("openConnectingView", str, timeout);
   	if (timeout != 0) {
        window.setTimeout("closeConnectingView();", timeout);
    }
   	getElement('connectingDiv').style.visibility = "visible";
    getElement('connectingText').innerHTML = str;
}

function closeConnectingView() {
    getElement('connectingDiv').style.visibility = "hidden";
}

function openInfoView(str, timeout, height) {
   	if (timeout != 0) {
        window.setTimeout("closeInfoView();", timeout);
    }
   	getElement('infoDiv').style.visibility = "visible";
   	getElement('infoDiv').style.height = height+"px";
    getElement('infoText').innerHTML = str;
}

function closeInfoView() {
    getElement('infoDiv').style.visibility = "hidden";
}

function openIncomingView(call) {
    trace("openIncomingView", call.caller, call.visibleNameCaller);
    $('#incomingDiv').show();
    $('#callerField').html(call.caller + " '" + call.visibleNameCaller + "'");
    
    $('#answerButton').click(function() {
        answer(call.id);
        closeIncomingView();
    });
    $('#hangupButton').click(function() {
        hangup(call.id);
        closeIncomingView();
    });
}

function closeIncomingView() {
    trace("closeIncomingView");
    $('#incomingDiv').hide();
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
    if (call.state != STATE_HOLD) {
        setStatusHold(call.id, true);
    }
    getElement('transfer').style.visibility = "visible";
}

function closeTransferView() {
    trace("closeTransferView");
    getElement('transfer').style.visibility = "hidden";
}
/*-----------------*/

/* ------------- Additional interface functions --------- */

//returns id
function encodeId(calleeName){
    return String(calleeName).replace(/:/g,MAGIC_SEQUENCE_COLON).replace(/@/g,MAGIC_SEQUENCE_AT).replace(/\./g,MAGIC_SEQUENCE_DOT).replace(/,/g,MAGIC_SEQUENCE_COMMA).replace(/=/g,MAGIC_SEQUENCE_EQ).replace(/;/g,MAGIC_SEQUENCE_SEMICOLON);
}

//returns calleName
function decodeId(calleeNameId){
   return String(calleeNameId).replace(new RegExp(MAGIC_SEQUENCE_COLON,'g'),":").replace(new RegExp(MAGIC_SEQUENCE_AT,'g'),"@").replace(new RegExp(MAGIC_SEQUENCE_DOT,'g'),".").replace(new RegExp(MAGIC_SEQUENCE_COMMA,'g'),",").replace(new RegExp(MAGIC_SEQUENCE_EQ,'g'),"=").replace(new RegExp(MAGIC_SEQUENCE_SEMICOLON,'g'),";");
}

// Functions createChat creates chat with the callee. 
// It contains all chat window functionality including send message function 

function createChat(calleeName) {

    //var closetab = '<a href="" id="close' + calleeName + '" class="close">&times;</a>';
    //$("#tabul").append('<li id="tab' + calleeName + '" class="ntabs">' + calleeName + '&nbsp;' + closetab + '</li>'); //add tab with the close button
    
    if (!$('li').is('#tab' + encodeId(calleeName))) {
        var closetab = '<a href="" id="close' + encodeId(calleeName) + '" class="close">&times;</a>';
        var shortCalleeName = calleeName;

        // We will cut too long calleeNames to place it within chat tab
        if (calleeName.length > 21) {
            shortCalleeName = calleeName.substr(0, 21) + '...';
        }


        $("#tabul").append('<li id="tab' + encodeId(calleeName) + '" class="ntabs"> ' + shortCalleeName + '&nbsp;' + closetab + '</li>'); //add tab with the close button


        $('#tabcontent').append('<div class=chatBox id=chat' + encodeId(calleeName) + '>') //add chatBox
        $('#chat' + encodeId(calleeName)).append('<div class=chatTextarea></div>')//add text area for chat messages
            .append('<input class=messageInput type=textarea>')//add input field
            .append('<input class=messageSend type=button value=Send>'); //add send button

        $("#tabul li").removeClass("ctab"); //remove select from all tabs
        $("#tab" + encodeId(calleeName)).addClass("ctab"); //select new tab
        $(".chatBox").hide(); //hide all chatBoxes
        $("#chat" + encodeId(calleeName)).show(); //show new chatBox

        // Bind send message on click Enter in message inout field

        $('#chat' + encodeId(calleeName) + ' .messageInput').keydown(function(event) {
            if (event.keyCode == '13') {
                $(this).next().click(); // click on sendMessage button
            } else if (event.keyCode == '27') {
                $(this).val('');
            }
        });

        // Bind send message function
        $('#chat' + encodeId(calleeName) + ' .messageSend').click(function() {
            var calleeName = $(this).parent().attr('id').substr(4); //parse id of current chatBox, take away chat word from the beginning
	    	calleeName = decodeId(calleeName);
            var messageText = $(this).prev().val(); //parse text from input
            var semicolonIndex = calleeName.indexOf(";");
	    var recipients;
	    //multipart mixed support
	    if (semicolonIndex!=-1){
		var splat = calleeName.split(";");
		//example adhoc;tel:12345,tel:5678
		//adhoc
		calleeName = splat[0];
		//tel:12345,tel:5678
		recipients = splat[1];
	    }
	    var msgObject = new Object();
	    msgObject.id = generateUUID();
	    msgObject.to = calleeName;
	    msgObject.recipients = recipients;
	    msgObject.body = messageText;
	    msgObject.contentType = "message/cpim";
	    sendMessage(msgObject); //send message
            $(this).prev().val(''); //clear message input
        });

        // Bind selecting tab
        $("#tab" + encodeId(calleeName)).bind("click", function() {
            $("#tabul li").removeClass("ctab"); //hide all tabs
            $("#tab" + encodeId(calleeName)).addClass("ctab"); //select clicked tab
            $(".chatBox").hide(); //chide all chatBoxes
            $("#chat" + encodeId(calleeName)).show(); //show new chatBox
        });

        // Bind closing tab on click 
        $("#close" + encodeId(calleeName)).click(function() {
            //close this tab
            $(this).parent().hide();
            $("#chat" + encodeId(calleeName)).hide();

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
        $("#tab" + encodeId(calleeName)).show(); //show our tab
        $("#tab" + encodeId(calleeName)).addClass("ctab"); //select our tab
        $(".chatBox").hide(); //hide all chatboxes
        $("#chat" + encodeId(calleeName)).show(); //show our chatBox

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
	
    // hold button
    $("#holdButton").click(function() {
      changeStatusHold(currentCall.id);
    });
    
    // open login view
    $("#loginMainButton").click(function() {
      openLoginView();
    });
    
    // logout
    $("#logoutButton").click(function() {
      logoff();
      $(this).hide();      
    });

    // login
    $("#loginButton").click(function() {
        login();
    });

    // click on caller login show logout button
    $("#callerLogin").click(function() {
      $('#logoutButton').toggle();
    });

    // every time when we change callee field - we set parameter callee
    // that parameter used around the code 
    
    $("#calleeText").keyup(function() {
      callee1 = $(this).val();
    });

    $("#sendRawRequestButton").click(function() {
      sendRawRequest();
    });
    
    $("#holdManagedCallButton").click(function() {
      holdManagedCall();
    });

    $("#unholdManagedCallButton").click(function() {
      unholdManagedCall();
    });
	        		    
    $("#hangupManagedCallButton").click(function() {
      hangupManagedCall();
    });
    
    $("#answerManagedCallButton").click(function() {
      answerManagedCall();
    });	

    //Bind click on different buttons
    $("#callButton").click(function() {
        if (! $(this).hasClass('disabled')) {
          if ($("#callButton").html() == 'Call') {
              call();
          } else {
              hangup(currentCall.id);
          }
        }
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

    $("#transferCansel").click(function() {
      closeTransferView();
    });

    $(".iconButton").click(function() {
      $(this).toggleClass('iconPressed');
    });
    
    //micButton opens mic slider
    $("#micButton").click(function() {
      if ($(this).hasClass('iconPressed')) {
        $('#micSlider').show();
        $('#micBack').show();
      } else {
        $('#micSlider').hide();
        $('#micBack').hide();
      }
    });
    
    //micButton opens mic slider
    $("#soundButton").click(function() {
      if ($(this).hasClass('iconPressed')) {
        $('#speakerSlider').show();
        $('#speakerBack').show();
      } else {
        $('#speakerSlider').hide();
        $('#speakerBack').hide();
      }
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
    
	$(".closeButton_incoming_call").click(function() {
		ignore(currentCall.id);
    closeIncomingView();
  });    

    //enable drag and resize objects
    $("#loginDiv").draggable({handle: '.bar', stack:"#loginDiv"});
    $("#incomingDiv").draggable({handle: '.bar', stack:"#incomingDiv"});
    $("#settingsDiv").draggable({handle: '.bar', stack:"#settingsDiv"});
    $("#transfer").draggable({handle: '.bar', stack:"#transfer"});
    $("#chatDiv").draggable({handle: '.bar', stack:"#chatDiv"});
    $("#video_requestUnmuteDiv").draggable({handle: '.bar', stack:"#video_requestUnmuteDiv"});
    $("#video_requestUnmuteDiv").resizable({ minHeight: 180, minWidth: 215, aspectRatio: true});

    //Bind click on number buttons
    $(".numberButton").click(function() {
        if (currentCall != null) {
            sendDTMF(currentCall.id, $(this).html());
        } else if (currentCall == null) {
            $("#calleeText").val($("#calleeText").val() + $(this).html());
        }
    });

    // this function set changing in button styles when you press any button
    $(".button").mousedown(function() {
      if (! $(this).hasClass('disabled')) {$(this).addClass('pressed');}
    }).mouseup(function() {
      $(this).removeClass('pressed');
    }).mouseout(function() {
      $(this).removeClass('pressed');
    });
    
    // Bind click on chatButton
    $("#chatButton").click(function() {
        if (isLogged) {
            if (callee1 != '') {
                openChatView();
                createChat(callee1.toLowerCase());
            } else {
                openConnectingView("Callee number is wrong", 3000);
            }
        } else {
            openLoginView();
        }
    });

    /* Autofill Aut. name field when you fil Login field/
    comment this feature while working on IMS development
    $('#username').keyup(function() {
        $('#authname').val($(this).val());
    });
    */
    
    
    // this functions resize flash when you resize video window
    $('#video_requestUnmuteDiv').resize(function() {
        $('#jsSWFDiv').height($(this).height() - 40);
    });
    
    // Mic slider set mic volume when you slide it
		$("#micSlider").slider({
			orientation: "vertical",
			range: "min",
			min: 0,
			max: 100,
      		value: 50,
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

    // Transfer ok button make transfer
    $('#transferOk').click(function() {
      transfer(currentCall.id, $('#transferInput').val());
      closeTransferView();  
    });

});
