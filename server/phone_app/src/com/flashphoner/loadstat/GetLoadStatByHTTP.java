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

package com.flashphoner.loadstat;

import com.wowza.wms.application.WMSProperties;
import com.wowza.wms.http.IHTTPProvider;
import com.wowza.wms.http.IHTTPRequest;
import com.wowza.wms.http.IHTTPResponse;
import com.wowza.wms.vhost.HostPort;
import com.wowza.wms.vhost.IVHost;

import java.io.IOException;

/**
 * Created by IntelliJ IDEA.
 * User: Alex
 * Date: Feb 29, 2012
 * Time: 1:48:14 PM
 * To change this template use File | Settings | File Templates.
 */
public class GetLoadStatByHTTP implements IHTTPProvider {


    @Override
    public void onBind(IVHost ivHost, HostPort hostPort) {
        //To change body of implemented methods use File | Settings | File Templates.
    }

    @Override
    public void onHTTPRequest(IVHost ivHost, IHTTPRequest ihttpRequest, IHTTPResponse ihttpResponse) {
        long connections = ivHost.getConnectionCounter().getCurrent();
        try {
            String report = "connections = " + connections;
            ihttpResponse.getOutputStream().write(report.getBytes());
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onUnbind(IVHost ivHost, HostPort hostPort) {
        //To change body of implemented methods use File | Settings | File Templates.
    }

    @Override
    public void setProperties(WMSProperties wmsProperties) {
        //To change body of implemented methods use File | Settings | File Templates.
    }
}
