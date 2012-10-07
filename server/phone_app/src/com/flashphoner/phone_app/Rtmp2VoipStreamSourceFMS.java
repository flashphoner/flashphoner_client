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

import com.flashphoner.sdk.rtmp.IRtmpClient;
import com.flashphoner.sdk.rtmp.IRtmpClientsCollection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;

/**
 * Created by IntelliJ IDEA.
 * User: Alex
 * Date: Oct 7, 2012
 * Time: 6:56:55 AM
 * To change this template use File | Settings | File Templates.
 */
public class Rtmp2VoipStreamSourceFMS extends PhoneRtmp2VoipStream {

    private static Logger log = LoggerFactory.getLogger(Rtmp2VoipStreamSourceFMS.class);

    private static Map<String, String> streamMap = new HashMap<String, String>();

    private Timer timer = new Timer();

    static {
        String str = ClientConfig.getInstance().getProperty("stream_map");
        log.info("stream_map property: " + str);
        if (str != null) {
            parse(str);
        }
    }

    static void parse(String str) {
        //stream_map = stream1,login1;stream2,login2
        String[] entries = str.trim().split(";");
        for (String entry : entries) {
            String[] nameValue = entry.trim().split(",");
            streamMap.put(nameValue[0].trim(), nameValue[1].trim());
        }
        log.info("parsed streamMap: " + streamMap);
    }

    @Override
    public void startPublishing() {
        String usernameByStreamName = streamMap.get(this.getName());
        if (usernameByStreamName == null) {
            log.warn("Username was not found by streamName: " + getName());
            return;
        }
        checkingIfUserCallEstablished(usernameByStreamName);
    }

    @Override
    public void stopPublishing() {
        if (timer != null) {
            timer.cancel();
            rtmpClient = null;
        }
        super.stopPublishing();
    }

    private void checkingIfUserCallEstablished(final String username) {
        TimerTask task = new TimerTask() {
            @Override
            public void run() {
                log.info("Waiting for user call established: " + username);
                IRtmpClientsCollection clients = getRtmpClients();
                if (clients == null) {
                    log.info("IRtmpClientsCollection is empty. Waiting for connection...");
                    return;
                }
                IRtmpClient _rtmpClient = clients.findByLogin(username);
                if (hasEstablishedCall(_rtmpClient)) {
                    log.info("User connected and has established call: " + username + ". Ready to plug in external stream");
                    rtmpClient = _rtmpClient;
                } else {
                    rtmpClient = null;
                }
            }
        };
        timer.schedule(task, 0, 1000);

    }

    private boolean hasEstablishedCall(IRtmpClient rtmpClient) {
        if (rtmpClient == null) {
            return false;
        }
        return rtmpClient.getSoftphone().hasEstablishedCall();
    }

    protected void writeVideo(byte[] data) {
        if (rtmpClient != null) {
            rtmpClient.writeVideo(data, -1, getVideoTC());
        }
    }

    protected void writeAudio(byte[] data) {
        if (rtmpClient != null) {
            rtmpClient.writeAudio(data, -1);
        }
    }
}


