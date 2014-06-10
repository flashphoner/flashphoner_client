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

var flashphoner;
var flashphoner_UI;
var flashphonerLoader;
var flashphonerListener;

// One call become two calls during TRANSFER case
// there is why we need at least two kinds of calls here
var holdedCall = null;
var currentCall = null;
// not sure if "callee" is reserved word so I will use callee /Pavel
var callee = '';
var callerLogin = '';
var registerRequired;
var isLogged = false;

var needOpenTransferView = false;
var connectingViewBeClosed = false;
var traceEnabled = true;
var intervalId = -1;
var proportion = 0;

var testInviteParameter = {};
testInviteParameter['param1'] = "value1";
testInviteParameter['param2'] = "value2";

var messenger;

var logs="";

$(document).ready(function () {
    toLogOffState();
    openConnectingView("Loading...", 0);
    flashphonerLoader = new FlashphonerLoader();
});


function login() {
    trace("Phone - login");
    connectingViewBeClosed = false;

    if ($("#outbound_proxy").val() == "") {
        $("#outbound_proxy").val($("#domain").val());
    }

    var loginObject = {};
    loginObject.login = $('#username').val();
    loginObject.password = $('#password').val();
    loginObject.authenticationName = $('#authname').val();
    loginObject.domain = $('#domain').val();
    loginObject.outboundProxy = $('#outbound_proxy').val();
    loginObject.port = $('#port').val();
    loginObject.useProxy = $('#checkboxUseProxy').attr("checked") ? true : false;
    loginObject.registerRequired = flashphonerLoader.registerRequired;
    loginObject.useDTLS = flashphonerLoader.useDTLS;
    loginObject.useSelfSigned = !isMobile.any();
    if (flashphonerLoader.contactParams != null && flashphonerLoader.contactParams.length != 0) {
        loginObject.contactParams = flashphonerLoader.contactParams;
    }

    trace("Phone - loginObject login: "+loginObject.login+" authenticationName: "+loginObject.authenticationName+" registerRequired: "+registerRequired+" useDTLS: "+loginObject.useDTLS);

    var result = flashphoner.login(loginObject, flashphonerLoader.urlServer);
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
    trace("Phone - loginByToken "+ token);
    connectingViewBeClosed = false;
    var result = flashphoner.loginByToken(flashphonerLoader.urlServer, token, document.URL);

    closeLoginView();
    openConnectingView("Connecting...", 0);
}

function getInfoAboutMe() {
    trace("Phone - getInfoAboutMe");
    return flashphoner.getInfoAboutMe();
}

function logoff() {
    trace("Phone - logoff");
    flashphoner.logoff();
}

function msrpCall(callee) {
    trace("Phone - msrpCall "+callee);
    flashphoner.msrpCall({callee: callee, visibleName: 'Caller', hasVideo: false, inviteParameters: testInviteParameter, isMsrp: true});
}

function call() {
    trace("Phone - call "+callee);
    if (isLogged) {
        var hasAccess;
        if (isVideoCall()){
            hasAccess = hasAccessToAudioAndVideo;
        } else {
            hasAccess = hasAccessToAudio;
        }
        if (!hasAccess()) {
            if (intervalId == -1) {
                intervalId = setInterval('if (isVideoCall() ? hasAccessToAudioAndVideo() : hasAccessToAudio()){flashphoner_UI.closeRequestUnmute(); clearInterval(intervalId); intervalId = -1; call();}', 500);
            }
            if (isVideoCall()){
                flashphoner_UI.getAccessToAudioAndVideo();
            } else {
                flashphoner_UI.getAccessToAudio();
            }
        } else if (hasAccess()) {
            var result = flashphoner.call({callee: callee, visibleName: 'Caller', hasVideo: isVideoCall(), inviteParameters: testInviteParameter, isMsrp: false});
            if (result == 0) {
                toHangupState();
                flashphonerListener.onCall();
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

function notifyMessage(message, notificationResult, sipObject) {
    messenger.notifyMessage(message, notificationResult, sipObject);
}

function sendMessage(to, body, contentType) {
    trace("Phone - sendMessage "+ to+" body: "+ body+" contentType: "+ contentType);
    var message = new Object();
    message.from = callerLogin;
    message.to = to;
    message.body = body;
    message.contentType = contentType;
    message.deliveryNotification = flashphonerLoader.imdnEnabled;
    messenger.sendMessage(message);
}


function answer(callId) {
    trace("Phone - answer "+ callId);
    var hasAccess;
    if (isVideoCall()){
        hasAccess = hasAccessToAudioAndVideo;
    } else {
        hasAccess = hasAccessToAudio;
    }
    if (!hasAccess()) {
        if (intervalId == -1) {
            intervalId = setInterval('if (isVideoCall() ? hasAccessToAudioAndVideo() : hasAccessToAudio()){flashphoner_UI.closeRequestUnmute(); clearInterval(intervalId); intervalId = -1; answer(currentCall.id);}', 500);
        }
        if (isVideoCall()){
            flashphoner_UI.getAccessToAudioAndVideo();
        } else {
            flashphoner_UI.getAccessToAudio();
        }
    } else if (hasAccess()) {
        flashphoner.answer(callId, isVideoCall());
        flashphonerListener.onAnswer(callId);
    } else {
        openConnectingView("Microphone is not plugged in", 3000);
    }
}

function hangup(callId) {
    trace("Phone - hangup "+ callId);
    flashphoner.hangup(callId);
    flashphonerListener.onHangup();
}

function sendDTMF(callId, dtmf) {
    trace("Phone - sendDTMF callId: "+ callId +" dtmf: "+ dtmf);
    flashphoner.sendDTMF(callId, dtmf);
}

function setStatusHold(callId, isHold) {
    trace("Phone - setStatusHold callId: "+ callId+" isHold: "+ isHold);
    flashphoner.setStatusHold(callId, isHold);
    disableHoldButton();
}

function transfer(callId, target) {
    trace("Phone - transfer callId: "+ callId+" target: "+ target);
    flashphoner.transfer(callId, target);
}

function hasAccessToAudioAndVideo() {
    return hasAccessToAudio() && hasAccessToVideo();
}

function hasAccessToAudio() {
    return flashphoner.hasAccessToAudio();
}

function hasAccessToVideo() {
    return flashphoner.hasAccessToVideo();
}


function sendVideoChangeState() {
    trace("Phone - sendVideoChangeState currentCall: "+currentCall.id);
    var sendVideoButton = getElement('sendVideo');
    if (sendVideoButton.value == 'Send video') {
        sendVideoButton.value = "Stop video";
        flashphoner.setSendVideo(currentCall.id, true);
    } else {
        sendVideoButton.value = "Send video";
        flashphoner.setSendVideo(currentCall.id, false);
    }
}

function changeRelationMyVideo(relation) {
    trace("Phone - changeRelationMyVideo "+ relation);
    flashphoner.changeRelationMyVideo(relation);
}

function getMicVolume() {
    var ret = flashphoner.getMicVolume();
    trace("Phone - getMicVolume "+ret);
    return ret;
}
function getVolume() {
    var ret = flashphoner.getVolume();
    trace("Phone - getVolume "+ret);
    return ret;
}

function setCookie(key, value) {
    trace("Phone - setCookie key: "+ key+" value: "+ value);
    flashphoner.setCookie(key, value);
}

function getCookie(key) {
    trace("Phone - getCookie "+ key);
    return flashphoner.getCookie(key);
}

function getVersion() {
    var ret = flashphoner.getVersion();
    trace("Phone - getVersion "+ret);
    return ret;
}
/* ------------------ Notify functions ----------------- */

function addLogMessage(message) {
    trace("Phone - addLogMessage: "+message);
}

function notifyFlashNotFound() {
    closeConnectingView();
    getElement('phoneScreen2').innerHTML = "<a href='http://www.adobe.com/go/getflashplayer' style='margin-left: 17px;'><img src='http://www.adobe.com/images/shared/download_buttons/get_flash_player.gif' alt='Get Adobe Flash player'/></a>";
}

function notifyConfigLoaded() {
    notifyReady();
    flashphoner = flashphonerLoader.getFlashphoner();
    flashphoner_UI = flashphonerLoader.getFlashphonerUI();
    flashphonerListener = flashphonerLoader.getFlashphonerListener();
    messenger = new Messenger(flashphoner);
    if (flashphonerLoader.useWebRTC) {
        $('#micButton').css('visibility', 'hidden');
        $('#sendVideo').css('visibility', 'hidden');
    } else {
        $('#micButton').css('visibility', 'visible');
        $('#sendVideo').css('visibility', 'visible');
    }
    //todo refactoring
    //$('#versionOfProduct').html(getVersion());
    if (flashphonerLoader.getToken()) {
        loginByToken(flashphonerLoader.getToken());
    } else {
        closeConnectingView();
    }
}

function notifyRequestUnmuteResult(accessGranted) {
    console.log("Access to microphone granted: " + accessGranted);
}


function notifyRegisterRequired(registerR) {
    registerRequired = registerR;
}

function notifyCloseConnection() {
    trace("Phone - notifyCloseConnection");
    currentCall = null;
    toLogOffState();
    toCallState();
    isLogged = false;
    closeIncomingView();
    closeVideoView();
    closeCallView();
    getElement('sendVideo').value = "Send video";
}

function notifyConnected() {
    trace("Phone - notifyConnected");
    if (registerRequired) {
        if (!connectingViewBeClosed) {
            openConnectingView("Waiting for registering...", 0);
        }
    } else {
        toLogState();
        callerLogin = getInfoAboutMe().login;
        getElement("callerLogin").innerHTML = callerLogin;
        isLogged = true;
        closeConnectingView();
    }
    //You can set speex quality here
    //flashphoner.setSpeexQuality(10);
}

function notifyRegistered(sipObject) {
    trace("Phone - notifyRegistered "+sipObject.message.raw);
    if (registerRequired) {
        toLogState();
        callerLogin = getInfoAboutMe().login;
        getElement("callerLogin").innerHTML = callerLogin;
        isLogged = true;
        connectingViewBeClosed = true;
        closeConnectingView();
        flashphoner.playSound("REGISTER");
        flashphonerListener.onRegistered();
    }

    if (flashphonerLoader.subscribeEvent != null && flashphonerLoader.subscribeEvent.length != 0) {
        subscribeReg();
    }

    sendXcapRequest();
}

function notifyRecordComplete(recordReport) {
    trace("Phone - notify record complete: " + recordReport.mixedFilename);
}


function notifySubscription(subscriptionObject, sipObject) {
    trace("Phone - notify subscription event: " + subscriptionObject.event + " expires: " + subscriptionObject.expires + " status: " + subscriptionObject.status+" terminate: "+subscriptionObject.terminate);
    trace("Phone - notify subscription body: " + subscriptionObject.requestBody);
    if (subscriptionObject.event == "reg") {
        if (subscriptionObject.terminate){
            terminate();
        }
    }
}

function terminate() {
    trace("Phone - terminate and logoff");
    logoff();
}

function sendXcapRequest() {
    if (flashphonerLoader.xcapUrl != null && flashphonerLoader.xcapUrl.length != 0) {
        flashphoner.sendXcapRequest(flashphonerLoader.xcapUrl);
    }

}

function notifyXcapResponse(xcapResponse) {
    trace("Phone - notifyXcapResponse " + xcapResponse);
    var xml = $.parseXML(xcapResponse);
    var history = $(xml).find("history-list").find("history");
    if (history != null && history.length != 0) {
        if (flashphonerLoader.msrpCallee != null && flashphonerLoader.msrpCallee.length != 0) {
            msrpCall(flashphonerLoader.msrpCallee);
        }
    }
}


function subscribeReg() {
    var subscribeObj = new Object();
    subscribeObj.event = flashphonerLoader.subscribeEvent;
    subscribeObj.expires = 3600;
    flashphoner.subscribe(subscribeObj);
}

function notifyBalance(balance) {
}

//callback for flashphoner.getStats();
function notifyStats(stats) {
    console.log(JSON.stringify(stats, null, '\t'));
}

function onCallFinished(){
    trace("Phone - onCallFinished");
    // if that hangup during transfer procedure?
    if (holdedCall != null) {
        trace("Phone - Existing holdedCall detected: "+holdedCall.id+" currentCall: "+currentCall.id);
        currentCall = holdedCall; //holded call become current
        holdedCall = null; //make variable null
        createCallView(currentCall);
    } else {
        trace("Phone - no existing holdedCall. Just close call states.")
        closeIncomingView();
        closeVideoView();
        toCallState();
        flashphoner.stopSound("RING");
        flashphoner.playSound("FINISH");
    }
    getElement('sendVideo').value = "Send video";
    // or this just usual hangup during the call
}

function onCurrentCallNotify(call){
    trace("Phone - onCurrentCallNotify: "+currentCall.id+" state: "+call.state);
    currentCall = call;
    if (call.state == STATE_FINISH) {
        onCallFinished();
    } else if (call.state == STATE_HOLD) {
        $('#callState').html('...Call on hold...');
        enableHoldButton();
    } else if (call.state == STATE_TALK) {
        $('#callState').html('...Talking...');
        enableHoldButton();
        flashphoner.stopSound("RING");
        var sendVideoButton = getElement('sendVideo');
        if (isVideoCall() && call.state_video == "sendrecv" && sendVideoButton.value == 'Send video'){
            sendVideoChangeState();
        }
    } else if (call.state == STATE_RING) {
        $('#callState').html('...Ringing...');
        if (isRingSoundAllowed()){
            flashphoner.playSound("RING");
        }
    } else if (call.state == STATE_RING_MEDIA){
        $('#callState').html('...Ringing...');
        flashphoner.stopSound("RING");
    } else if (call.state == STATE_BUSY) {
        flashphoner.playSound("BUSY");
    } else if (call.state == STATE_SESSION_PROGRESS){
        $('#callState').html('...Call in Progress...');
        flashphoner.stopSound("RING");
    }
}

function isRingSoundAllowed(){
    try{
        if (flashphonerLoader.suppressRingOnActiveAudioStream && flashphoner.hasActiveAudioStream()){
            trace("Phone - isRingSoundAllowed false");
            return false;
        }
    }catch(error){
    }
    trace("Phone - isRingSoundAllowed true");
    return true;
}

function onNotCurrentCallNotify(call){
    trace("Phone - onNotCurrentCallNotify call.id: "+call.id+" holdedCall: "+holdedCall.id+" call.state: "+call.state);
    if (holdedCall.id == call.id) {
        if (call.state == STATE_FINISH) {
            trace("It seems we received FINISH state on holdedCall. Just do null the holdedCall.");
            /* that mean if
             - user1 call user2
             - user2 transfer to user3
             - user3 just thinking (not answer, not hangup)
             - user2 hangup during him thinking
             then we delete old holded call from user1 memory
             */
            holdedCall = null;
            getElement('sendVideo').value = "Send video";
        }
        enableHoldButton();
    }
}

function notify(call,sipObject) {
    trace("Phone - notify call id: "+ call.id+" state: "+call.state+" callee: "+call.callee+" caller: "+call.caller+" incoming: "+call.incoming+" isVideoCall: "+call.isVideoCall);
    trace("Phone - currentCall.id: "+currentCall.id);
    trace("Phone - sipObject: "+sipObject);
    if (currentCall.id == call.id) {
        onCurrentCallNotify(call);
    } else {
        onNotCurrentCallNotify(call);
    }
}

function notifyCallbackHold(call, isHold) {
    trace("Phone - notifyCallbackHold call: "+ call +" isHold: "+ isHold);
    if (currentCall != null && currentCall.id == call.id) {
        currentCall = call;
        if (needOpenTransferView) {
            getElement('transfer').style.visibility = "visible";
        }
        if (isHold) {
            getElement('holdButton').style.background = "url(assets/unhold.png)";
            $('#holdButton').unbind('click');
            $('#holdButton').click(function () {
                setStatusHold(call.id, false);
            });

        } else {
            getElement('holdButton').style.background = "url(assets/hold.png)";
            $('#holdButton').unbind('click');
            $('#holdButton').click(function () {
                setStatusHold(call.id, true);
            });
        }
    }
}

function notifyCost(cost) {
}

function notifyBugReport(filename) {
    trace("Created bug report; filename - " + filename);
}

function notifyError(error) {

    trace("Phone - notifyError "+ error);

    if (error == CONNECTION_ERROR) {
        openInfoView("Can`t connect to server.", 3000, 30);

    } else if (error == AUTHENTICATION_FAIL) {
        openInfoView("Register fail, please check your SIP account details.", 3000, 30);
        window.setTimeout("logoff();", 3000);

    } else if (error == USER_NOT_AVAILABLE) {
        openInfoView("User not available.", 3000, 30);

        /*  Deprecated error

         else if (error == TOO_MANY_REGISTER_ATTEMPTS) {
         openInfoView("Connection error", 3000, 30);
         toLoggedOffState();
         */

    } else if (error == LICENSE_RESTRICTION) {
        openInfoView("You trying to connect too many users, or license is expired", 3000, 90);

    } else if (error == LICENSE_NOT_FOUND) {
        openInfoView("Please get a valid license or contact Flashphoner support", 5000, 90);

    } else if (error == INTERNAL_SIP_ERROR) {
        openInfoView("Unknown error. Please contact support.", 3000, 60);

    } else if (error == REGISTER_EXPIRE) {
        openInfoView("No response from VOIP server during 15 seconds.", 3000, 60);

    } else if (error == SIP_PORTS_BUSY) {
        openInfoView("SIP ports are busy. Please open SIP ports range (30000-31000 by default).", 3000, 90);
        connectingViewBeClosed = true;
        window.setTimeout("logoff();", 3000);

    } else if (error == MEDIA_PORTS_BUSY) {
        openInfoView("Media ports are busy. Please open media ports range (31001-32000 by default).", 3000, 90);

    } else if (error == WRONG_SIPPROVIDER_ADDRESS) {
        openInfoView("Wrong domain.", 3000, 30);
        connectingViewBeClosed = true;
        window.setTimeout("logoff();", 3000);

    } else if (error == CALLEE_NAME_IS_NULL) {
        openInfoView("Callee name is empty.", 3000, 30);

    } else if (error == WRONG_FLASHPHONER_XML) {
        openInfoView("Flashphoner.xml has errors. Please check it.", 3000, 60);
    } else if (error == PAYMENT_REQUIRED) {
        openInfoView("Payment required, please check your balance.", 3000, 60);
    }

    flashphonerListener.onError();
    closeConnectingView();
    toCallState();
}

function notifyVideoFormat(call) {
    trace("Phone - notifyVideoFormat "+ call);

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
        $('#video').height(newHeight - 40); //and resize flash for new video window
    }
}

function notifyOpenVideoView(isViewed) {
    trace("Phone - notifyOpenVideoView "+ isViewed);
    if (isViewed) {
        openVideoView();
    } else {
        closeVideoView();
    }
}

function notifyMessageReceived(messageObject) {
    trace("Phone - notifyMessageReceived "+ messageObject);

    if (messageObject.contentType == "application/im-iscomposing+xml" || messageObject.contentType == "message/fsservice+xml") {
        trace("ignore message: "+messageObject.body);
        if (flashphonerLoader.disableUnknownMsgFiltering) {
            messageObject.body = escapeXmlTags(messageObject.body);
            showMessage(messageObject);
        }
        return;
    }

    //convert body
    var body = convertMessageBody(messageObject.body, messageObject.contentType);
    if (body) {
        messageObject.body = body;
        showMessage(messageObject);
    } else {
        trace("Not displaying message " + messageObject.body + ", body is null after convert");
        if (flashphonerLoader.disableUnknownMsgFiltering) {
            messageObject.body = escapeXmlTags(messageObject.body);
            showMessage(messageObject);
        }
    }
}

function showMessage(messageObject) {
    var from = messageObject.from.toLowerCase();
    openChatView();
    createChat(from);
    var chatDiv = $('#chat' + removeNonDigitOrLetter(from) + ' .chatTextarea'); //set current textarea
    addMessageToChat(chatDiv, from, messageObject.body, "yourNick", messageObject.id);
    flashphoner.playSound("MESSAGE");
}

function convertMessageBody(messageBody, contentType) {
    trace("Phone - convertMessageBody " + contentType);
    if (contentType == "application/fsservice+xml") {
        var xml = $.parseXML(messageBody);
        var missedCallNotification;
        var fsService = $(xml).find("fs-services").find("fs-service");
        var action = fsService.attr("action");
        if (action == "servicenoti-indicate") {
            var caw = parseMsn(fsService,"caw");
            if (!!caw){
                missedCallNotification = caw;
            }else{
                missedCallNotification = parseMsn(fsService,"mcn");
            }
        } else if (action == "serviceinfo-confirm") {
            //service status confirmation
            missedCallNotification = "Service status: " + $(fsService.find("mcn").find("mcn-data")).attr("status");
        }
        if(missedCallNotification !== undefined) return missedCallNotification;

    } else if (contentType == "application/vnd.oma.push") {
        var xml = $.parseXML(messageBody);
        /**
         * application/vnd.oma.push will contain xml with app information
         * Try to handle this information or discard xml
         */
        var content;
        if ($(xml).find("ums-service")) {
            //voice mail service message
            content = $(xml).find("ni-data").attr("content");
        }
        return content;
    }

    return messageBody;

}

function parseMsn(fsService,mcn){
    trace("Phone - parseMcn: "+mcn);
    var caw = fsService.find(mcn);
    var ret = null;
    if (!!caw){
        var cawData = caw.find(mcn+"-data");
        if (!!cawData) {
            var sender = $(cawData).attr("sender");
            if (!!sender){
                trace("Phone - Missed call: " + sender);
                ret = "Missed call from " + sender;
            }
        }
    }
    return ret;
}

function addMessageToChat(chatDiv, from, body, className, messageId) {
    trace("Phone - addMessageToChat: messageId: "+messageId+" from: "+from+" message body: "+body);
    var idAttr = (messageId != null) ? "id='" + messageId + "'" : "";
    var isScrolled = (chatDiv[0].scrollHeight - chatDiv.height() + 1) / (chatDiv[0].scrollTop + 1); // is chat scrolled down? or may be you are reading previous messages.
    var messageDiv = "<div " + idAttr + " class='" + className + "'>" + from + " " + body + "</div>";
    chatDiv.append(messageDiv); //add message to chat
    if (isScrolled == 1) {
        chatDiv[0].scrollTop = chatDiv[0].scrollHeight; //autoscroll if you are not reading previous messages
    }
}

function notifyMessageSent(messageObject) {
    trace("Phone - notifyMessageSent "+ messageObject);
    createChat(messageObject.to.toLowerCase());
    var chatDiv = $('#chat' + removeNonDigitOrLetter(messageObject.to.toLowerCase()) + ' .chatTextarea'); //set current textarea for
    addMessageToChat(chatDiv, messageObject.from, messageObject.body, "myNick", messageObject.id);
}

function notifyMessageAccepted(message) {
    trace("Phone - notifyMessageAccepted "+ message);
    var messageDiv = $('#' + message.id);
    messageDiv.addClass("myNick message_accepted");
}

function notifyMessageDelivered(message) {
    trace("Phone - notifyMessageDelivered "+ message);
    var messageDiv = $('#' + message.id);
    messageDiv.addClass("myNick message_delivered");
}

function notifyMessageDeliveryFailed(message) {
    trace("Phone - notifyMessageDeliveryFailed "+ message);
    var messageDiv = $('#' + message.id);
    messageDiv.addClass("myNick message_delivery_failed");
    messageDiv.innerHTML = messageDiv.innerHTML + "- Delivery failed to " + message.recipients;
}

function notifyMessageFailed(message) {
    trace("Phone - notifyMessageFailed "+ message);
    var messageDiv = $('#' + message.id);
    messageDiv.addClass("myNick message_failed");
}

function notifyAddCall(call) {
    trace("Phone - notifyAddCall "+ call.id+" call.incoming: "+call.incoming+" call.state: "+call.state);
    if (currentCall!=null && !call.incoming){
        holdedCall = currentCall;
        currentCall = call;
        createCallView(currentCall);
        trace("Phone - It seems like a hold: holdedCall: "+holdedCall.id+" currentCall: "+currentCall.id);
    } else {
        currentCall = call;
        createCallView(currentCall);
        if (call.incoming == true) {
            openIncomingView(call);
            toHangupState();
            flashphonerListener.onIncomingCall(call.id);
        }
        trace("Phone - It seems like a new call currentCall: "+currentCall.id +" state: "+currentCall.state);
    }
}

function createCallView(call) {
    trace("createCallView call: "+call.id+" state: "+call.state);
    openCallView();
    $('#caller').html(call.anotherSideUser);

    if (call.state == STATE_HOLD) {
        $('#callState').html('...Call on hold...');
        enableHoldButton();
    } else if (call.state == STATE_TALK) {
        $('#callState').html('...Talking...');
        enableHoldButton();
    } else if (call.state == STATE_RING) {
        $('#callState').html('...Ringing...');
    }

    $('#holdButton').unbind('click');
    $('#holdButton').click(function () {
        setStatusHold(call.id, true);
    });

    $('#transferButton').unbind('click');
    $('#transferButton').click(function () {
        openTransferView();
    });
}

function removeCallView(call) {
    closeCallView();
    $('#caller').html('');
    $('#callState').html('');
    $('#holdButton').css('background', 'url(assets/hold.png)');
}

function isCurrentCall(call) {
    return currentCall != null && currentCall.id == call.id;
}

function notifyRemoveCall(call) {
    trace("Phone - notifyRemoveCall "+ call.id+" currentCall: "+currentCall.id);
    if (isCurrentCall(call)) {
        currentCall = null;
        removeCallView(call)
        flashphonerListener.onRemoveCall();
    }
}

function notifyVersion(version) {
    getElement('versionOfProduct').innerHTML = version;
}
/* ----------------------------------------------------------------------- */

/* --------------- Additional functions ------------------- */

function toLogState() {
    trace("Phone - toLogState");
    $("#callerLogin").show().html(callerLogin);
    $("#loginMainButton").hide();
}

function toLogOffState() {
    trace("Phone - toLogOffState");
    $("#loginMainButton").show();
    $('#callerLogin').hide().html('');
}

function toHangupState() {
    trace("Phone - toHangupState");
    $('#callButton').html("Hangup");
    /*$('#callButton').css('background', '#C00');*/
    $('#callButton').removeClass('call').addClass('hangup');
    disableCallButton();
}

function toCallState() {
    trace("Phone - toCallState");
    $('#callButton').html("Call");
    /*$('#callButton').css('background', '#090');*/
    $('#callButton').removeClass('hangup').addClass('call');
    disableCallButton();
}

function disableCallButton() {
    trace("Phone - disableCallButton");
    $('#callButton').addClass('disabled');
    window.setTimeout(enableCallButton, 3000);

    function enableCallButton() {
        $('#callButton').removeClass('disabled');
    }
}


function enableHoldButton() {
    trace("Phone - enableHoldButton");
    var button = $('#holdButton');
    button.css('visibility', 'inherit');
}

function disableHoldButton() {
    trace("Phone - disableHoldButton");
    var button = $('#holdButton');
    button.css('visibility', 'hidden');
}


function openLoginView() {
    if (flashphonerLoader.getToken()) {
        loginByToken(flashphonerLoader.getToken());
    } else {
        trace("Phone - openLoginView");
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
    trace("Phone - openConnectingView: message - " + str + "; timeout - " + timeout);
    if (timeout != 0) {
        window.setTimeout("closeConnectingView();", timeout);
    }
    getElement('connectingDiv').style.visibility = "visible";
    getElement('connectingText').innerHTML = str;
}

function closeConnectingView() {
    trace("Phone - closeConnectingView");
    getElement('connectingDiv').style.visibility = "hidden";
}

function openInfoView(str, timeout, height) {
    trace("Phone - openInfoView str: "+ str+" timeout: "+ timeout);
    if (timeout != 0) {
        window.setTimeout("closeInfoView();", timeout);
    }
    getElement('infoDiv').style.visibility = "visible";
    getElement('infoDiv').style.height = height + "px";
    getElement('infoText').innerHTML = str;
}

function closeInfoView(timeout) {
    trace("Phone - closeInfoView "+timeout);
    if (timeout) {
        window.setTimeout("getElement('infoDiv').style.visibility = 'hidden';", timeout);
    } else {
        getElement('infoDiv').style.visibility = "hidden";
    }
}

function openIncomingView(call) {
    trace("Phone - openIncomingView "+ call)// call.caller, call.visibleNameCaller

    //form Caller-ID information displayed to user
    var displayedCaller = "";
    if (call.caller !== undefined) displayedCaller += call.caller;
    if (call.visibleNameCaller !== undefined) displayedCaller += " '" + call.visibleNameCaller + "'";

    $('#incomingDiv').show();
    $('#callerField').html(displayedCaller);

    $('#answerButton').unbind('click');
    $('#answerButton').click(function () {
        answer(call.id);
        closeIncomingView();
    });
    $('#hangupButton').unbind('click');
    $('#hangupButton').click(function () {
        trace("Phone - openIncomingView hangup "+call.id);
        hangup(call.id);
        closeIncomingView();
    });
}

function closeIncomingView() {
    trace("Phone - closeIncomingView");
    $('#incomingDiv').hide();
}

function openSettingsView() {
    trace("Phone - openSettingsView");
    getElement('settingsDiv').style.visibility = "visible";
}
function closeSettingsView() {
    trace("Phone - closeSettingsView");
    getElement('settingsDiv').style.visibility = "hidden";
}

function getElement(str) {
    return document.getElementById(str);
}

/* ----- VIDEO ----- */

function openVideoView() {
    flashphoner_UI.openVideoView();
}

function closeVideoView() {
    trace("Phone - closeVideoView");
    $('#video_requestUnmuteDiv').removeClass().addClass('closed');
}

/* ----- CHAT ----- */

function openChatView() {
    trace("Phone - openChatView");
    $('#chatDiv').css('visibility', 'visible');
}
function closeChatView() {
    trace("Phone - closeChatView");
    $('#chatDiv').css('visibility', 'hidden');
}
/*-----------------*/

/* ----- CALL ----- */
function openCallView() {
    trace("Phone - openCallView");
    $('#callDiv').css('visibility', 'visible');
}
function closeCallView() {
    trace("Phone - closeCallView");
    $('#callDiv').css('visibility', 'hidden');
}
/*-----------------*/
/* ----- TRANSFER ----- */
function openTransferView() {
    trace("Phone - openTransferView");
    $('#transferOk').unbind('click');
    $('#transferOk').click(function () {
        if (currentCall.state == STATE_HOLD) {
            transfer(currentCall.id, $('#transferInput').val());
            closeTransferView();
        } else {
            needOpenTransferView = true;
            setStatusHold(currentCall.id, true);
        }
    });

    if (call.state != STATE_HOLD) {
        needOpenTransferView = true;
        setStatusHold(currentCall.id, true);
    } else {
        getElement('transfer').style.visibility = "visible";
    }
}

function closeTransferView() {
    trace("Phone - closeTransferView");
    needOpenTransferView = false;
    getElement('transfer').style.visibility = "hidden";
}

function submitBugReport(){
    var bugReportText = getElement('bugReportText').value;
    trace("submitBugReport "+bugReportText);
    if (flashphoner){
        flashphoner.submitBugReport({text:bugReportText, type: "no_media"});
    }
}

/*-----------------*/

/* ------------- Additional interface functions --------- */
function isVideoCall(){
    return $('#checkboxVideoCall').attr("checked") ? true : false;
}
// Functions createChat creates chat with the callee. 
// It contains all chat window functionality including send message function 

function createChat(calleeName) {

    //var closetab = '<a href="" id="close' + calleeName + '" class="close">&times;</a>';
    //$("#tabul").append('<li id="tab' + calleeName + '" class="ntabs">' + calleeName + '&nbsp;' + closetab + '</li>'); //add tab with the close button
    var shortCalleeName = calleeName;
    var fullCalleeName = shortCalleeName;
    var calleeNameId = removeNonDigitOrLetter(fullCalleeName);
    if (!$('li').is('#tab' + calleeNameId)) {
        var closetab = '<a href="" id="close' + calleeNameId + '" class="close">&times;</a>';

        // We will cut too long calleeNames to place it within chat tab
        if (shortCalleeName.length > 21) {
            shortCalleeName = shortCalleeName.substr(0, 21) + '...';
        }


        $("#tabul").append('<li id="tab' + calleeNameId + '" class="ntabs">' + shortCalleeName + '&nbsp;' + closetab + '</li>'); //add tab with the close button


        $('#tabcontent').append('<div class="chatBox" id="chat' + calleeNameId + '" title="' + shortCalleeName + '" fullCalleeName="' + fullCalleeName + '">'); //add chatBox
        $('#chat' + calleeNameId).append('<div class="chatTextarea"></div>')//add text area for chat messages
            .append('<input class="messageInput" type="textarea">')//add input field
            .append('<input class="messageSend" type="button" value="Send">'); //add send button

        $("#tabul li").removeClass("ctab"); //remove select from all tabs
        $("#tab" + calleeNameId).addClass("ctab"); //select new tab
        $(".chatBox").hide(); //hide all chatBoxes
        $("#chat" + calleeNameId).show(); //show new chatBox

        // Bind send message on click Enter in message inout field

        $('#chat' + calleeNameId + ' .messageInput').keydown(function (event) {
            if (event.keyCode == '13') {
                $(this).next().click(); // click on sendMessage button
            } else if (event.keyCode == '27') {
                $(this).val('');
            }
        });

        // Bind send message function
        $('#chat' + calleeNameId + ' .messageSend').click(function () {
            var fullCalleeName = $(this).parent().attr('fullCalleeName'); //parse id of current chatBox, take away chat word from the beginning
            var messageText = $(this).prev().val(); //parse text from input
            sendMessage(calleeName, messageText, flashphonerLoader.msgContentType); //send message
            $(this).prev().val(''); //clear message input
        });

        // Bind selecting tab
        $("#tab" + calleeNameId).bind("click", function () {
            $("#tabul li").removeClass("ctab"); //hide all tabs
            $("#tab" + calleeNameId).addClass("ctab"); //select clicked tab
            $(".chatBox").hide(); //chide all chatBoxes
            $("#chat" + calleeNameId).show(); //show new chatBox
        });

        // Bind closing tab on click 
        $("#close" + calleeNameId).click(function () {
            //close this tab
            $(this).parent().hide();
            $("#chat" + calleeNameId).hide();

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
        $("#tab" + calleeNameId).show(); //show our tab
        $("#tab" + calleeNameId).addClass("ctab"); //select our tab
        $(".chatBox").hide(); //hide all chatboxes
        $("#chat" + calleeNameId).show(); //show our chatBox

    }

}

function removeNonDigitOrLetter(calleeName) {
    return calleeName.replace(/\W/g, '')
}

function escapeXmlTags(stringXml) {
    return stringXml.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ---------------------------------------------------- */

// functions closeView is simplifying of many close....View functions
function close(element) {
    element.css('visibility', 'hidden');
}


/* --------------------- On document load we do... ------------------ */
function notifyReady() {

    // open login view
    $("#loginMainButton").click(function () {
        openLoginView();
    });

    // logout
    $("#logoutButton").click(function () {
        logoff();
        $(this).hide();
    });

    // login
    $("#loginButton").click(function () {
        login();
    });

    // click on caller login show logout button
    $("#callerLogin").click(function () {
        $('#logoutButton').toggle()
    });

    // every time when we change callee field - we set parameter callee
    // that parameter used around the code 
    $("#calleeText").keyup(function () {
        callee = $(this).val();
    });

    //Bind click on different buttons
    $("#callButton").click(function () {
        if ($("#callButton").html() == 'Call') {
            call();
        } else {
            if (currentCall) {
                trace("Phone - Hangup current call by click: "+currentCall.id);
                hangup(currentCall.id);
            } else {
                trace("Phone - ignore hangup command, provisional message from server not received yet");
            }
        }
    });

    $("#cameraButtonInCallee").click(function () {
        openVideoView();
    });

    $("#canselLoginDiv").click(function () {
        closeLoginView();
    });

    $("#sendVideo").click(function () {
        sendVideoChangeState();
    });

    $("#transferCansel").click(function () {
        closeTransferView();
    });

    $(".iconButton").click(function () {
        $(this).toggleClass('iconPressed');
    });

    //micButton opens mic slider
    $("#micButton").click(function () {
        if ($(this).hasClass('iconPressed')) {
            $('#micSlider').show();
            $('#micBack').show();
        } else {
            $('#micSlider').hide();
            $('#micBack').hide();
        }
    });

    //micButton opens mic slider
    $("#soundButton").click(function () {
        if ($(this).hasClass('iconPressed')) {
            $('#speakerSlider').show();
            $('#speakerBack').show();
        } else {
            $('#speakerSlider').hide();
            $('#speakerBack').hide();
        }
    });

    $("#cameraButton").click(function () {
        openVideoView();
    });

    $("#closeButton_video_requestUnmuteDiv").click(function () {
        closeVideoView();
    });

    $(".closeButton").click(function () {
        close($(this).parent());
    });

    //enable drag and resize objects
    $("#loginDiv").draggable({handle: '.bar', stack: "#loginDiv"});
    $("#incomingDiv").draggable({handle: '.bar', stack: "#incomingDiv"});
    $("#settingsDiv").draggable({handle: '.bar', stack: "#settingsDiv"});
    $("#transfer").draggable({handle: '.bar', stack: "#transfer"});
    $("#chatDiv").draggable({handle: '.bar', stack: "#chatDiv"});
    $("#video_requestUnmuteDiv").draggable({handle: '.bar', stack: "#video_requestUnmuteDiv"});
    $("#video_requestUnmuteDiv").resizable({ minWidth: 215, minHeight: 180, aspectRatio: true});

    var all_videos = $('#localVideoPreview, #remoteVideo');
    all_videos.each(function () {
        var el = $(this);
        el.attr('data-aspectRatio', el.height() / el.width());
        var width = $("#video_requestUnmuteDiv").width();
        el.attr('data-windowRatio', el.width() / (width == 1 ? 640 : width));
    });

    $("#video_requestUnmuteDiv").resize(function () {
        var width = $("#video_requestUnmuteDiv").width();
        var height = $("#video_requestUnmuteDiv").height();
        var newWidth = width == 1 ? 640 : width;
        $('#video').height((height == 1 ? 520 : height) - 40);
        $('#video').width(width == 1 ? 640 : width);
        $('#remoteVideo').height((height == 1 ? 520 : height) - 40);
        var localVideo = $('#localVideoPreview');
        localVideo.height(newWidth * localVideo.attr('data-windowRatio') * localVideo.attr('data-aspectRatio'));
        all_videos.each(function () {
            var el = $(this);
            el.width(newWidth * el.attr('data-windowRatio'));
        });
    }).resize();

    //Bind click on number buttons
    $(".numberButton").click(function () {
        if (currentCall != null && currentCall.state == STATE_TALK) {
            sendDTMF(currentCall.id, $(this).html());
        } else if (currentCall == null) {
            $("#calleeText").val($("#calleeText").val() + $(this).html());
            callee = callee + $(this).html();
        }
    });

    $(".testButton").click(function () {
        startUnitTests();
    });

    $(".bugReportButton").click(function () {
        submitBugReport();
    });

    // this function set changing in button styles when you press any button
    $(".button").mousedown(function () {
        $(this).addClass('pressed');
    }).mouseup(function () {
            $(this).removeClass('pressed');
        }).mouseout(function () {
            $(this).removeClass('pressed');
        });

    // Bind click on chatButton
    $("#chatButton").click(function () {
        if (isLogged) {
            if (callee != '') {
                openChatView();
                createChat(callee.toLowerCase());
            } else {
                openConnectingView("Callee number is wrong", 3000);
            }
        } else {
            openLoginView();
        }
    });

    /* Autofill Aut. name field when you fill Login field */
    $('#username').keyup(function () {
        $('#authname').val($(this).val());
    });

    /* Autofill Outb. proxy field when you fill "domain" field */
    $('#domain').keyup(function () {
        $('#outbound_proxy').val($(this).val());
    });

    // Mic slider set mic volume when you slide it
    $("#micSlider").slider({
        orientation: "vertical",
        range: "min",
        min: 0,
        max: 100,
        value: 60,
        slide: function (event, ui) {
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
        slide: function (event, ui) {
            flashphoner.setVolume(ui.value);
        }
    });

    $("#checkboxUseProxy").change(function () {
        if ($(this).attr("checked")) {
            flashphoner.setUseProxy(true);
        } else {
            flashphoner.setUseProxy(false);
        }
    });


};
