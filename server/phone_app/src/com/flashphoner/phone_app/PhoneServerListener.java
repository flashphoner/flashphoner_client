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

import com.flashphoner.jmx.UpAndRunningChecker;
import com.flashphoner.sdk.rtmp.Config;
import com.wowza.wms.server.IServer;
import com.wowza.wms.server.IServerNotify;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


/**
 * This interface's methods invoked when server stop or start.<br/>
 * Flashphoner uses this interface during starting server.<br/>
 * If <code>mode=debug</code> is configured in flashphoner.properties config, Flashphoner starts tcpdump process on server starting and close this process on server stopping.
 */
public class PhoneServerListener implements IServerNotify {

    private static Logger log = LoggerFactory.getLogger(PhoneServerListener.class);

    public void onServerCreate(IServer server) {
    }

    public void onServerInit(IServer server) {
        try {

            Config.getInstance();

            log.info("Initializing flashphoner properties: " + Config.getInstance().getProperties());

            log.info("Flashphoner build: " + Config.BUILD + " deployed.");

        } catch (Throwable e) {
            log.error("onServerInit error", e);
        }


        try {
            UpAndRunningChecker.register();
        } catch (Exception e) {
            log.error("keepAlive bean error", e);
        }
        
        Config.preLoad();

    }

    public void onServerShutdownStart(IServer server) {
    }

    public void onServerShutdownComplete(IServer server) {

    }

}
