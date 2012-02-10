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
import com.flashphoner.sdk.sip.SipMessageObject;
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
    public void registered(SipMessageObject sipHeader) {
        Logger.logger.info(4, "RtmpClient.registered()");
        getClient().call("registered", null, sipHeader.toAMFObj());
    }

    /**
     * Notifies flash-client about balance value
     *
     * @param balance   balance header value
     * @param sipHeader SipMessageObject object, wich contains raw SIP message data
     */
    public void notifyBalance(String balance, SipMessageObject sipHeader) {
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
        streamStart(rtmpClientConfig.getLogin(), call.getId());
    }


    /**
     * Notifies flash-client about RING status of call
     *
     * @param call      ISoftphoneCall
     * @param sipHeader SipMessageObject object, wich contains raw SIP message data
     */
    public void ring(ISoftphoneCall call, SipMessageObject sipHeader) {
        Logger.logger.info(4, "RtmpClient.ring() " + call.getId());
        if (sipHeader == null) {
            sipHeader = new SipMessageObject();
        }
        getClient().call("ring", null, call.toAMFDataObj(), sipHeader.toAMFObj());
    }

    /**
     * Notifies flash-client about RINGING status of call
     *
     * @param call      ISoftphoneCall
     * @param sipHeader SipMessageObject object, wich contains raw SIP message data
     */
    public void ringing(ISoftphoneCall call, SipMessageObject sipHeader) {
        Logger.logger.info(4, "RtmpClient.ringing() " + call.getId());
    }

    /**
     * Notifies flash-client about SESSION_PROGRESS status of call
     *
     * @param call      ISoftphoneCall
     * @param sipHeader SipMessageObject object, wich contains raw SIP message data
     */
    public void sessionProgress(ISoftphoneCall call, SipMessageObject sipHeader) {
        Logger.logger.info(4, "RtmpClient.sessionProgress()");
        if (sipHeader == null) {
            sipHeader = new SipMessageObject();
        }
        getClient().call("sessionProgress", null, call.toAMFDataObj(), sipHeader.toAMFObj());
    }

    /**
     * Notifies flash-client about TALK status of call and starts incoming stream
     *
     * @param call      ISoftphoneCall
     * @param sipHeader SipMessageObject object, wich contains raw SIP message data
     */
    public void talk(ISoftphoneCall call, SipMessageObject sipHeader) {
        Logger.logger.info(4, "RtmpClient.talk() " + call.getId());
        if (sipHeader == null) {
            sipHeader = new SipMessageObject();
        }
        getClient().call("talk", null, call.toAMFDataObj(), sipHeader.toAMFObj());
    }

    /**
     * Notifies flash-client about hold status
     *
     * @param call      ISoftphoneCall
     * @param sipHeader SipHeader object, wich contains raw SIP message data
     */
    public void notifyHold(ISoftphoneCall call, SipMessageObject sipHeader) {
        Logger.logger.info(4, "RtmpClient.notifyHold() " + call.getId());
        if (sipHeader == null) {
            sipHeader = new SipMessageObject();
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
    public void finish(ISoftphoneCall call, SipMessageObject sipHeader) {
        Logger.logger.info(4, "RtmpClient.finish() " + call.getId());
        if (sipHeader == null) {
            sipHeader = new SipMessageObject();
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
    public void busy(ISoftphoneCall call, SipMessageObject sipHeader) {
        Logger.logger.info(4, "RtmpClient.busy() " + call.getId());
        if (sipHeader == null) {
            sipHeader = new SipMessageObject();
        }
        getClient().call("busy", null, call.toAMFDataObj(), sipHeader.toAMFObj());
    }

    /**
     * Notifies flash-client about fail
     *
     * @param errorCode
     * @param sipHeader SipHeader object, wich contains raw SIP message data
     */
    public void fail(String errorCode, SipMessageObject sipHeader) {
        Logger.logger.info(4, "RtmpClient.fail() " + errorCode);
        if (sipHeader == null) {
            sipHeader = new SipMessageObject();
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
