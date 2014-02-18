package com.flashphoner.phone_app;

import com.flashphoner.sdk.call.ISipCall;
import com.flashphoner.sdk.rtmp.Config;
import com.flashphoner.sdk.rtmp.IRtmpClient;
import com.wowza.wms.amf.AMFDataList;
import com.wowza.wms.client.IClient;
import com.wowza.wms.module.IModuleCallResult;
import com.wowza.wms.request.RequestFunction;
import com.wowza.wms.stream.IMediaStream;
import com.wowza.wms.stream.MediaStreamMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * Created with IntelliJ IDEA.
 * User: Alexey
 * Date: 10.02.14
 * Time: 18:54
 * To change this template use File | Settings | File Templates.
 */
public class TalkCallResult implements IModuleCallResult {

    private static Logger log = LoggerFactory.getLogger(TalkCallResult.class);

    private RtmpClient rtmpClient;

    public TalkCallResult(RtmpClient rtmpClient) {
        this.rtmpClient = rtmpClient;
    }

    @Override
    public void onResult(final IClient iClient, RequestFunction requestFunction, AMFDataList amfDataList) {
        log.info("onResult rtmpClient: " + rtmpClient);
        startRecording(iClient);
    }

    private void startRecording(final IClient iClient) {

        String recordMap = Config.getInstance().getProperty("record_map");
        if (recordMap == null || recordMap.isEmpty()) {
            if (log.isDebugEnabled()) {
                log.debug("recording is disabled");
            }
            return;
        }

        Thread t = new Thread() {

            public void run() {

                ISipCall call = rtmpClient.getSoftphone().getCurrentCall();
                if (log.isDebugEnabled()) {
                    log.debug("currentCall: " + call);
                }
                MediaStreamMap map = rtmpClient.getClient().getAppInstance().getStreams();
                for (int i = 0; i < 10; i++) {
                    if (call != null) {

                        String publishStreamName = rtmpClient.getRtmpClientConfig().getLogin()+"_"+call.getId();
                        IMediaStream stream = map.getStream(publishStreamName);

                        if (stream != null) {

                            long audioTC = stream.getAudioTC();

                            if (log.isDebugEnabled()) {
                                log.debug("Checking stream tc: " + audioTC + " stream: " + publishStreamName);
                            }

                            if (audioTC != 0) {
                                rtmpClient.startRecording();
                                return;
                            }
                        } else{
                            log.debug("Stream not found "+publishStreamName);
                        }
                    }

                    try {
                        Thread.sleep(1000);
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }

                log.info("No active outgoing  streams for rtmpClient: " + rtmpClient.getRtmpClientConfig().getLogin());
            }
        };
        t.start();


    }
}
