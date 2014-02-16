package com.flashphoner.phone_app;

import com.flashphoner.sdk.rtmp.Config;
import com.flashphoner.sdk.rtmp.IRtmpClient;
import com.flashphoner.sdk.softphone.SoftphoneCallState;
import com.flashphoner.sdk.call.ISipCall;
import com.wowza.wms.livestreamrecord.model.ILiveStreamRecord;
import com.wowza.wms.livestreamrecord.model.LiveStreamRecorderFLV;
import com.wowza.wms.stream.IMediaStream;
import com.wowza.wms.stream.MediaStreamMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.util.*;

/**
 * Created with IntelliJ IDEA.
 * User: Alexey
 * Date: 10.02.14
 * Time: 18:07
 * To change this template use File | Settings | File Templates.
 */
public class Recorder {

    private static Map<String, String> streamMap = new HashMap<String, String>();

    private static Set<String> recordingCallIds = new HashSet<String>();

    static {
        String streamMapSetting = ClientConfig.getInstance().getProperty("stream_map");
        if (streamMapSetting != null && !streamMapSetting.isEmpty()) {
            streamMap = Utils.parseStreamMap(streamMapSetting);
        }
    }

    private static Logger log = LoggerFactory.getLogger("Recorder");

    protected Map<IMediaStream, ILiveStreamRecord> recordingMap = new HashMap<IMediaStream, ILiveStreamRecord>();


    protected IRtmpClient rtmpClient;

    public Recorder(IRtmpClient rtmpClient) {
        this.rtmpClient = rtmpClient;
    }

    protected void startRecording() {

        log.info("startRecording rtmpClient: " + rtmpClient);

        String login = rtmpClient.getRtmpClientConfig().getAuthenticationName();

        ISipCall call = rtmpClient.getSoftphone().getCurrentCall();
        if (call == null || !SoftphoneCallState.TALK.equals(call.getState())) {
            log.info("Current established call is not found for login: " + login + " call: " + call);
            return;
        }

        String callId = call.getId();
        String caller = call.getCaller();
        String callee = call.getCallee();
        log.info("talk callId: " + callId + " login: " + login + " caller: " + caller + " callee: " + callee);

        synchronized (recordingCallIds) {
            if (recordingCallIds.contains(callId)) {
                log.info("The call is already in recording process: " + callId);
                return;
            } else {
                recordingCallIds.add(callId);
            }
        }

        String folder = caller + "-" + callee + "-" + callId;
        String folderPath = Config.WOWZA_HOME + "/content/" + folder;
        if (!(new File(folderPath).mkdir())) {
            log.error("Can't create dir: " + folderPath);
            return;
        }
        if (log.isDebugEnabled()) {
            log.debug("Recording folder is ready: " + folderPath);
        }

        byte recordingBitMask = findRecordingBitMask(login + "@" + rtmpClient.getRtmpClientConfig().getDomain());
        if (recordingBitMask == 0) {
            if (log.isDebugEnabled()) {
                log.debug("No recordingBitMask for login: " + login);
            }
            return;
        }

        MediaStreamMap mediaStreamMap = rtmpClient.getClient().getVHost().getApplication(rtmpClient.getRtmpClientConfig().getApplicationName()).getAppInstance("_definst_").getStreams();
        List<IMediaStream> streams = mediaStreamMap.getStreams();


        for (IMediaStream stream : streams) {
            if (isRecordingAllowed(stream, callId, login, recordingBitMask)) {
                record(caller, callee, stream, folderPath);
            } else {
                log.info("Recording is not allowed: caller: " + caller + " callee: " + callee + " stream: " + stream.getName() + " streamObj: " + stream + " recordingBitMask: " + recordingBitMask);
            }
        }


    }

    private boolean isRecordingAllowed(IMediaStream stream, String callId, String login, byte recordingBitMask) {

        boolean recordOutgoingAudioVideo = (recordingBitMask >> 2 & 0x01) == 1;
        boolean recordIncomingAudio = (recordingBitMask >> 1 & 0x01) == 1;
        boolean recordIncomingVideo = (recordingBitMask & 0x01) == 1;

        log.info("isRecordingAllowed recordOutgoingAudioVideo: " + recordOutgoingAudioVideo + " recordIncomingAudio: " + recordIncomingAudio + " recordIncomingVideo: " + recordIncomingVideo+" stream: "+stream.getName()+" callId: "+callId+" login: "+login+" mask: "+recordingBitMask);

        String streamName = stream.getName();
        if (stream.getStreamType().equalsIgnoreCase("live")) {
            if (streamName.indexOf("VIDEO_INCOMING_" + login) != -1 && recordIncomingVideo) {
                return true;
            } else if (streamName.indexOf("INCOMING_" + login) != -1 && recordIncomingAudio) {
                return true;
            }
        } else if (stream instanceof PhoneRtmp2VoipStream) {
            if (streamName.equalsIgnoreCase(callId)) {
                return recordOutgoingAudioVideo;
            } else {
                String mappedTo = streamMap.get(streamName);
                if (mappedTo != null && mappedTo.indexOf(login) != -1) {
                    log.info("Allowed mapped stream: streamName: " + streamName + " mappedTo: " + mappedTo + " login: " + login);
                    return true;
                }
            }
        }

        return false;

    }

    private void record(String caller, String callee, IMediaStream recordingStream, String folderPath) {

        String filePath = folderPath + "/" + recordingStream.getName() + ".flv";
        boolean append = true;
        LiveStreamRecorderFLV liveStreamRecorderFLV = new LiveStreamRecorderFLV();
        liveStreamRecorderFLV.setStartOnKeyFrame(false);
        liveStreamRecorderFLV.startRecording(recordingStream, filePath, append, new HashMap<String, Object>(), ILiveStreamRecord.SPLIT_ON_DISCONTINUITY_NEVER);
        recordingMap.put(recordingStream, liveStreamRecorderFLV);
        log.info("Starting recording stream: " + recordingStream + " filePath: " + filePath + " append: " + append);
    }

    private byte findRecordingBitMask(String login) {
        byte bitMask = 0;
        String recordMap = Config.getInstance().getProperty("record_map");
        if (recordMap != null && !recordMap.isEmpty()) {
            String[] masks = recordMap.split(",");
            for (String mask : masks) {
                String[] namePatternStreamMask = mask.split(":");
                String namePattern = namePatternStreamMask[0];
                String streamMask = namePatternStreamMask[1];
                /**
                 * Example
                 * record_map=.*1001.*:7,1002.*:3
                 *
                 * 7 is binary 111
                 * 1 - outgoing audio+video is ENABLED for recording
                 *      1 - incoming audio is ENABLED for recording
                 *          1 - incoming video is ENABLED for recording
                 *
                 * 3 is binary 011
                 *
                 * 0 - outgoing audio+video is DISABLED for recording
                 *      1 - incoming audio is ENABLED for recording
                 *          1 - incoming video is ENABLED for recording
                 */

                if (login.matches(namePattern)) {
                    bitMask = Byte.parseByte(streamMask);
                    break;
                }
            }
        }

        if (bitMask == 0) {
            log.info("BitMask was not found for login: " + login + " in recordMap: " + recordMap);
        }

        return bitMask;
    }

    protected void stopRecording(String callId) {
        String login = rtmpClient.getRtmpClientConfig().getAuthenticationName();
        log.info("stopRecording login: " + login);
        Iterator<ILiveStreamRecord> it = recordingMap.values().iterator();
        while (it.hasNext()) {
            it.next().stopRecording();
        }
        recordingCallIds.remove(callId);
    }

}
