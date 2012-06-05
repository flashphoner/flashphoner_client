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

import com.flashphoner.sdk.rtmp.IRtmpClient;

import java.util.TimerTask;

/**
 * Hangup timer task
 */
@Deprecated
public class HangupTimerTask extends TimerTask {
    private IRtmpClient rtmpClient;

    public HangupTimerTask(IRtmpClient rtmpClient) {
        this.rtmpClient = rtmpClient;
    }

    public void run() {
        try {
            /** We not use HangupTimerTask anymore, so i commented that
             *
             * rtmpClient.getSoftphone().hangupAll();
             *
             */

        } catch (Throwable e) {
            e.printStackTrace();
        }
    }
}
