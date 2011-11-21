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
package com.flashphoner.phone_app;

import com.flashphoner.sdk.rtmp.AbstractRtmpClient;
import com.flashphoner.sdk.rtmp.Config;
import com.flashphoner.sdk.rtmp.IConfig;
import com.flashphoner.sdk.rtmp.RtmpClientConfig;
import com.flashphoner.sdk.sip.SipHeader;
import com.flashphoner.sdk.softphone.ISoftphoneCall;
import com.flashphoner.sdk.softphone.InstantMessage;
import com.flashphoner.sdk.softphone.Logger;
import com.flashphoner.sdk.softphone.exception.LicenseRestictionException;
import com.flashphoner.sdk.softphone.exception.SoftphoneException;
import com.wowza.wms.amf.AMFDataObj;
import com.wowza.wms.client.IClient;
import com.wowza.wms.logging.WMSLogger;
import com.wowza.wms.logging.WMSLoggerFactory;

import javax.sip.RequestEvent;
import java.util.Map;
import java.util.Timer;

/**
 * Implementation of IRtmpClient class via {@link AbstractRtmpClient}.<br/>
 * RtmpClient is a main class of Flashphoner server side application responsible for RTMP-SIP bridge.<br/>
 * See more info in {@link com.flashphoner.sdk.rtmp.IRtmpClient} and in {@link AbstractRtmpClient} class.
 */
public class RtmpClient extends AbstractRtmpClient {

    /**
     * Create new RtmpClient instance, see AbstractRtmpClient constructor
     *
     * @param login
     * @param pwd
     * @param client
     * @param sipProviderAddress
     * @param sipProviderPort
     * @param visibleName
     * @param regRequired
     * @param appName
     * @param mode
     */
    public RtmpClient(String login, String pwd, IClient client, String sipProviderAddress, int sipProviderPort, String visibleName, boolean regRequired, String appName, String mode) {
        super(login, pwd, client, sipProviderAddress, sipProviderPort, visibleName, regRequired, appName, mode);
    }

    public RtmpClient(String login, String pwd, IClient client, String sipProviderAddress, int sipProviderPort, String visibleName, boolean regRequired, String appName, String mode, Integer width, Integer height) {
        super(login, pwd, client, sipProviderAddress, sipProviderPort, visibleName, regRequired, appName, mode, width, height);
    }

    public RtmpClient(String login, String pwd, IClient client, String sipProviderAddress, int sipProviderPort, String visibleName, boolean regRequired, String appName, String mode, Integer width, Integer height, String supportedResolutions) {
        super(login, pwd, client, sipProviderAddress, sipProviderPort, visibleName, regRequired, appName, mode, width, height, supportedResolutions);
    }

    public RtmpClient(String login, String authenticationName, String pwd, IClient client, String sipProviderAddress, int sipProviderPort, String visibleName, boolean regRequired, String appName, String mode, Integer width, Integer height, String supportedResolutions) {
        super(login, pwd, client, sipProviderAddress, sipProviderPort, visibleName, regRequired, appName, mode, width, height, supportedResolutions);
        setAuthenticationName(authenticationName);
    }

    /**
     * Create new RtmpClient instance, see AbstractRtmpClient constructor
     *
     * @param login
     * @param pwd
     * @param client
     * @param regRequired
     * @param appName
     * @param mode
     */
    public RtmpClient(String login, String pwd, IClient client, boolean regRequired, String appName, String mode) {
        super(login, pwd, client, regRequired, appName, mode);
    }

    /**
     * Create new RtmpClient instance, see AbstractRtmpClient constructor
     *
     * @param login
     * @param pwd
     * @param client
     * @param appName
     * @param mode
     */
    public RtmpClient(final String login, final String pwd,
                      final IClient client, final String appName, String mode) {
        super(login, pwd, client, appName, mode);
    }

    /**
     * Create new RtmpClient instance, see AbstractRtmpClient constructor
     *
     * @param login
     * @param pwd
     * @param regRequired
     * @param appName
     * @param mode
     */
    public RtmpClient(final String login, final String pwd,
                      final boolean regRequired, final String appName, String mode) {
        super(login, pwd, regRequired, appName, mode);
    }

    /**
     * Create new RtmpClient instance, see AbstractRtmpClient constructor
     *
     * @param login
     * @param pwd
     * @param appName
     * @param mode
     */
    public RtmpClient(final String login, final String pwd, final String appName, String mode) {
        super(login, pwd, appName, mode);
    }

    /**
     * Use this constructor as super(...) in extended classes
     *
     * @param login              sip login for VoIP server
     * @param authenticationName sip authentication name
     * @param pwd                sip password
     * @param sipProviderAddress sip provider registrar or proxy server
     * @param sipProviderPort    sip provider port
     * @param visibleName        visible name of caller
     * @param regRequired        required register on VoIP server
     * @param appName            Woza server side application name
     * @param mode               "flashphoner" or "click2call" mode
     */
    public RtmpClient(String login, String authenticationName, String pwd, IClient client, String sipProviderAddress, int sipProviderPort, String visibleName, boolean regRequired, String appName, String mode) {
        super(login, authenticationName, pwd, client, sipProviderAddress, sipProviderPort, visibleName, regRequired, appName, mode);
    }

    /**
     * @param rtmpClientConfig config contains all parameters for the instance creation
     * @param iClient
     */
    public RtmpClient(RtmpClientConfig rtmpClientConfig, IClient iClient) {
        super(rtmpClientConfig, iClient);
    }

    /**
     * Notifies flash-client about softphone registered
     *
     * @param sipHeader
     */
    public void registered(SipHeader sipHeader) {
        Logger.logger.info(4, "RtmpClient.registered()");
        getClient().call("registered", null, sipHeader.toAMFObj());
    }

    /**
     * Notifies flash-client about balance value
     *
     * @param balance   balance header value
     * @param sipHeader SipHeader object, wich contains raw SIP message data
     */
    public void notifyBalance(String balance, SipHeader sipHeader) {
        Logger.logger.info(4, "RtmpClient.notifyBalance()");
        getClient().call("notifyBalance", null, balance, sipHeader.toAMFObj());
    }

    /**
     * Notifies flash-client about incommin call
     *
     * @param call - call
     */
    public void incommingCall(ISoftphoneCall call) {
        Logger.logger.info(4, "RtmpClient.incommingCall() " + call.getId());
        streamStart(login, call.getId());
    }


    /**
     * Notifies flash-client about RING status of call
     *
     * @param call      ISoftphoneCall
     * @param sipHeader SipHeader object, wich contains raw SIP message data
     */
    public void ring(ISoftphoneCall call, SipHeader sipHeader) {
        Logger.logger.info(4, "RtmpClient.ring() " + call.getId());
        if (sipHeader == null) {
            sipHeader = new SipHeader();
        }
        getClient().call("ring", null, call.toAMFDataObj(), sipHeader.toAMFObj());
    }

    /**
     * Notifies flash-client about RINGING status of call
     *
     * @param call      ISoftphoneCall
     * @param sipHeader SipHeader object, wich contains raw SIP message data
     */
    public void ringing(ISoftphoneCall call, SipHeader sipHeader) {
        Logger.logger.info(4, "RtmpClient.ringing() " + call.getId());
    }

    /**
     * Notifies flash-client about SESSION_PROGRESS status of call
     *
     * @param call      ISoftphoneCall
     * @param sipHeader SipHeader object, wich contains raw SIP message data
     */
    public void sessionProgress(ISoftphoneCall call, SipHeader sipHeader) {
        Logger.logger.info(4, "RtmpClient.sessionProgress()");
        if (sipHeader == null) {
            sipHeader = new SipHeader();
        }
        getClient().call("sessionProgress", null, call.toAMFDataObj(), sipHeader.toAMFObj());
    }

    /**
     * Notifies flash-client about TALK status of call and starts incoming stream
     *
     * @param call      ISoftphoneCall
     * @param sipHeader SipHeader object, wich contains raw SIP message data
     */
    public void talk(ISoftphoneCall call, SipHeader sipHeader) {
        Logger.logger.info(4, "RtmpClient.talk() " + call.getId());
        if (sipHeader == null) {
            sipHeader = new SipHeader();
        }
        getClient().call("talk", null, call.toAMFDataObj(), sipHeader.toAMFObj());
    }

    /**
     * Notifies flash-client about hold status
     *
     * @param call      ISoftphoneCall
     * @param sipHeader SipHeader object, wich contains raw SIP message data
     */
    public void notifyHold(ISoftphoneCall call, SipHeader sipHeader) {
        Logger.logger.info(4, "RtmpClient.notifyHold() " + call.getId());
        if (sipHeader == null) {
            sipHeader = new SipHeader();
        }
        getClient().call("hold", null, call.toAMFDataObj(), sipHeader.toAMFObj());
    }

    /**
     * Notifies flash-client about hold status
     *
     * @param call   ISoftphoneCall
     * @param isHold is hold true
     */
    public void callbackHold(ISoftphoneCall call, Boolean isHold) {
        Logger.logger.info(4, "RtmpClient.callbackHold()");
        getClient().call("callbackHold", null, call.toAMFDataObj(), isHold);
    }

    /**
     * Notifies flash-client about FINISH status of call
     *
     * @param call      ISoftphoneCall
     * @param sipHeader SipHeader object, wich contains raw SIP message data
     */
    public void finish(ISoftphoneCall call, SipHeader sipHeader) {
        Logger.logger.info(4, "RtmpClient.finish() " + call.getId());
        if (sipHeader == null) {
            sipHeader = new SipHeader();
        }
        streamAudioStop(call.getId());
        streamVideoStop(call.getId());
        getClient().call("finish", null, call.toAMFDataObj(), sipHeader.toAMFObj());
    }

    /**
     * Notifies flash-client about abonent BUSY
     *
     * @param call      ISoftphoneCall
     * @param sipHeader SipHeader object, wich contains raw SIP message data
     */
    public void busy(ISoftphoneCall call, SipHeader sipHeader) {
        Logger.logger.info(4, "RtmpClient.busy() " + call.getId());
        if (sipHeader == null) {
            sipHeader = new SipHeader();
        }
        getClient().call("busy", null, call.toAMFDataObj(), sipHeader.toAMFObj());
    }

    /**
     * Creates outgoing call
     *
     * @param caller      login, which initiates this call
     * @param callee      login, which callable, call's target
     * @param visibleName visible name of caller, which may be displayed on SIP endpoint screen
     * @param isVideoCall is this call with video support
     * @return ISoftphoneCall
     * @throws SoftphoneException
     */
    public ISoftphoneCall call(final String caller, final String callee, final String visibleName, final Boolean isVideoCall) throws SoftphoneException, LicenseRestictionException {
        Logger.logger.info(4, "RtmpClient.call() " + callee);
        ISoftphoneCall call = getSoftphone().call(caller, callee, visibleName, isVideoCall);
        streamStart(login, call.getId());
        return call;
    }

    /**
     * Creates outgoing call
     *
     * @param caller      login, which initiates this call
     * @param callee      login, which callable, call's target
     * @param visibleName visible name of caller, which may be displayed on SIP endpoint screen
     * @param isVideoCall is this call with video support
     * @param inviteParameters additional parameters for INVITE-request
     * @return ISoftphoneCall
     * @throws SoftphoneException
     */
    public ISoftphoneCall call(final String caller, final String callee, final String visibleName, final Boolean isVideoCall, Map<String, String> inviteParameters) throws SoftphoneException, LicenseRestictionException {
        Logger.logger.info(4, "RtmpClient.call() " + callee);
        ISoftphoneCall call = getSoftphone().call(caller, callee, visibleName, isVideoCall, inviteParameters);
        streamStart(login, call.getId());
        return call;
    }
    /**
     * Answer incoming call
     *
     * @param callId      SIP callId which call is answered
     * @param isVideoCall is video supported for this answer
     * @throws SoftphoneException
     */
    public void answer(final String callId, final Boolean isVideoCall) throws SoftphoneException {
        Logger.logger.info(4, "RtmpClient.answer() " + callId);
        getSoftphone().answer(callId, isVideoCall);
    }

    /**
     * Update call session to video
     *
     * @param callId SIP callId which call is updated
     * @throws SoftphoneException
     */
    public void updateCallToVideo(final String callId) throws SoftphoneException {
        Logger.logger.info(4, "RtmpClient.updateCallToVideo() " + callId);
        getSoftphone().updateCallToVideo(callId);
    }


    /**
     * Hangup by callId
     *
     * @param callId SIP callId which call is hanguped
     * @throws SoftphoneException
     */
    public void hangup(final String callId) throws SoftphoneException {
        Logger.logger.info(4, "RtmpClient.hangup() " + callId);
        getSoftphone().hangup(callId);
        streamAudioStop(callId);
        streamVideoStop(callId);
    }

    /**
     * Transfer by callId and callee
     *
     * @param callId SIP callId which call is transferred
     * @param callee
     * @throws SoftphoneException
     */
    public void transfer(final String callId, final String callee) throws SoftphoneException {
        Logger.logger.info(4, "RtmpClient.transfer() " + callId);
        getSoftphone().transfer(callId, callee);
    }

    /**
     * Hold by callId and isHold
     *
     * @param callId SIP callId which call is holded
     * @param isHold
     * @throws SoftphoneException
     */
    public void hold(final String callId, final Boolean isHold) throws SoftphoneException {
        Logger.logger.info(4, "RtmpClient.hold() " + callId + "; holding - " + isHold);
        getSoftphone().hold(callId, isHold);
    }

    /**
     * Send DTMF
     *
     * @param callId SIP callId for which call DTMF is sended
     * @param dtmf
     * @throws SoftphoneException
     */
    public void sendDtmf(final String callId, final String dtmf) throws SoftphoneException {
        Logger.logger.info(4, "RtmpClient.sendDtmf() " + dtmf);
        getSoftphone().sendDtmf(callId, dtmf);
    }

    /**
     * Notifies flash-client about fail
     *
     * @param errorCode
     * @param sipHeader SipHeader object, wich contains raw SIP message data
     */
    public void fail(String errorCode, SipHeader sipHeader) {
        Logger.logger.info(4, "RtmpClient.fail() " + errorCode);
        if (sipHeader == null) {
            sipHeader = new SipHeader();
        }
        if (getClient() != null) {
            getClient().call("fail", null, errorCode, sipHeader.toAMFObj());
        }
    }

    /**
     * Notifies flash-client about video format
     *
     * @param call
     */
    public void notifyVideoFormat(ISoftphoneCall call) {
        Logger.logger.info(4, "RtmpClient.notifyVideoFormat() " + call.getId());
        if (getClient() != null) {
            getClient().call("notifyVideoFormat", null, call.toAMFDataObj());
        }
    }

    /**
     * Retrives Flashphoner config
     *
     * @return Flashphoner config
     */
    public IConfig getConfig() {
        return Config.getInstance();
    }

    @Override
    public void notifyRequest(RequestEvent requestEvent) {
        Logger.logger.info("Notify request: " + requestEvent.getRequest().toString());
        //getClient().call("notifyRequest", null, requestObj);
    }

    public void notifyMessage(InstantMessage instantMessage) {
        Logger.logger.info("rtmpClient notifyMessage: " + instantMessage);
        AMFDataObj messageObj = new AMFDataObj();
        messageObj.put("from", instantMessage.getFrom());
        messageObj.put("to", instantMessage.getTo());
        messageObj.put("body", instantMessage.getBody());
        messageObj.put("contentType", instantMessage.getContentType());
        messageObj.put("state", instantMessage.getState());
        getClient().call("notifyMessage", null, messageObj);
    }

    //speex, pcma, pcmu

    public void notifyAudioCodec(String audioCodec) {
        Logger.logger.info(4, "RtmpClient.notifyAudioCodec() " + audioCodec);
        AMFDataObj codecObj = new AMFDataObj();
        codecObj.put("name", audioCodec.toLowerCase());
        if (getClient() != null) {
            getClient().call("notifyAudioCodec", null, codecObj);
        }
    }
}
