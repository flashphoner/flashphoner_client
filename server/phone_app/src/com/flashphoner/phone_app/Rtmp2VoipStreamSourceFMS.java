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
            //use normal rtmpClient detection process for this stream
            rtmpClient = getRtmpClients().findByClient(getClient());
            return;
        }
        checkingIfUserCallEstablished(usernameByStreamName);
    }

    @Override
    public void stopPublishing() {
        if (timer != null) {
            timer.cancel();            
        }
        super.stopPublishing();
        rtmpClient = null;
    }

    private void checkingIfUserCallEstablished(final String username) {
        TimerTask task = new TimerTask() {
            @Override
            public void run() {
                if (log.isDebugEnabled()) {
                    log.debug("Checking for user call established: " + username);
                }
                IRtmpClientsCollection clients = getRtmpClients();
                if (clients == null) {
                    log.info("IRtmpClientsCollection is empty. Waiting for connection...");
                    return;
                }

                rtmpClient = clients.findByCalledInEstablishedCalls(username);
                if (rtmpClient != null) {
                    log.debug("Established, called: " + username + " rtmpClient: " + rtmpClient.getRtmpClientConfig().getLogin());
                } else {
                    log.debug("Call is not Established, called: " + username + " for stream: " + getName());                    
                }

            }
        };
        timer.schedule(task, 0, 1000);

    }

    protected void writeVideo(byte[] data) {
        if (rtmpClient != null) {
            rtmpClient.writeVideo(data, -1, getVideoTC());
        } else {
            if (log.isDebugEnabled()) {
                log.debug("writeVideo NULL rtmpClient this: " + getName());
            }
        }
    }

    protected void writeAudio(byte[] data) {
        if (rtmpClient != null) {
            rtmpClient.writeAudio(data, -1);
        } else {
            if (log.isDebugEnabled()) {
                log.debug("writeAudio NULL rtmpClient this: " + getName());
            }
        }
    }
}


