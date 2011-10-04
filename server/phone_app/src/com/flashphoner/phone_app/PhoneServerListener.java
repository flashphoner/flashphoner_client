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

import com.flashphoner.sdk.rtmp.Config;
import com.flashphoner.sdk.softphone.Logger;
import com.wowza.wms.server.IServer;
import com.wowza.wms.server.IServerNotify;

import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * This interface's methods invoked when server stop or start.<br/>
 * Flashphoner uses this interface during starting server.<br/>
 * If <code>mode=debug</code> is configured in flashphoner.properties config, Flashphoner starts tcpdump process on server starting and close this process on server stopping.
 */
public class PhoneServerListener implements IServerNotify {

    public void onServerCreate(IServer server) {
    }

    public void onServerInit(IServer server) {
        try {

            Config.getInstance();

            Logger.logger.info(4, "Initializing flashphoner properties: " + Config.getInstance().getProperties());

            Logger.logger.info(4, "Flashphoner build: " + Config.BUILD + " deployed.");

        } catch (Throwable e) {
            Logger.logger.error(e);
        }

    }

    public void onServerShutdownStart(IServer server) {
    }

    public void onServerShutdownComplete(IServer server) {

    }

}
