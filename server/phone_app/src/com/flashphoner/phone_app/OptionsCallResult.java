/*
 * FLASHPHONER COMPANY CONFIDENTIAL
 * __________________________________________
 *
 * [2009] - [2011] Flashphoner company
 * All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Flashphoner company and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Flashphoner company
 * and its suppliers and may be covered by U.S. and Foreign Patents,
 * patents in process, and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Flashphoner company.
 */

package com.flashphoner.phone_app;

import com.flashphoner.sdk.sip.SipMessageObject;
import com.flashphoner.sdk.softphone.Logger;
import com.flashphoner.sdk.softphone.Softphone;
import com.flashphoner.sdk.softphone.exception.SoftphoneException;
import com.wowza.wms.amf.AMFDataList;
import com.wowza.wms.client.IClient;
import com.wowza.wms.module.IModuleCallResult;
import com.wowza.wms.module.ModuleBase;
import com.wowza.wms.request.RequestFunction;

import javax.sip.message.Request;
import javax.sip.message.Response;

/**
 * Created by IntelliJ IDEA.
 * User: Alex
 * Date: Feb 14, 2012
 * Time: 7:50:27 PM
 * To change this template use File | Settings | File Templates.
 */
public class OptionsCallResult extends ModuleBase implements IModuleCallResult {

    private RtmpClient rtmpClient;
    private SipMessageObject sipMessageObject;

    public OptionsCallResult(RtmpClient rtmpClient, SipMessageObject sipMessageObject) {
        this.rtmpClient = rtmpClient;
        this.sipMessageObject = sipMessageObject;
    }

    @Override
    public void onResult(IClient client, RequestFunction requestFunction, AMFDataList params) {
        try {
            int responseStatus = params.getInt(PARAM1);
            Logger.logger.info("OptionsCallResult responseStatus: " + responseStatus);
            rtmpClient.getSoftphone().sendResponse((Request) sipMessageObject.getMessage(), responseStatus);
        } catch (Exception e) {
            Logger.logger.error("Can not send OK response", e);
        }
    }
}
