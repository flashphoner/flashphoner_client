package com.flashphoner.api2.stream
{

import com.flashphoner.Logger;
import com.flashphoner.api2.media.LocalMediaControl;
import com.flashphoner.api2.media.RemoteMediaControl;
import com.flashphoner.api2.Main;

import flash.events.AsyncErrorEvent;
import flash.events.NetStatusEvent;
import flash.net.*;
import flash.media.H264VideoStreamSettings;
import flash.media.H264Level;
import flash.media.H264Profile;

public class Stream
	{
		private var application:Main;
		private var ncStream:NetStream;

        private var usingLocalMedia:Boolean;
        private var hasAudio:Boolean;
        private var hasVideo:Boolean;

		public function Stream(application:Main, nc:NetConnection)
		{
			this.application = application;
            this.ncStream = new NetStream(nc);
            this.ncStream.bufferTime = 0;
            this.ncStream.addEventListener(AsyncErrorEvent.ASYNC_ERROR,asyncErrorHandler);
            this.ncStream.addEventListener(NetStatusEvent.NET_STATUS,onNetStatus);
        }

        public function setup(localMediaControl:LocalMediaControl, remoteMediaControl:RemoteMediaControl,
                              hasAudio:Boolean, hasVideo:Boolean):void {
            this.hasAudio = hasAudio;
            this.hasVideo = hasVideo;
            if (localMediaControl != null) {
                //publish
                this.usingLocalMedia = true;
                //attach video
                var settings:H264VideoStreamSettings= new H264VideoStreamSettings();
                settings.setProfileLevel(H264Profile.BASELINE, H264Level.LEVEL_3);
                ncStream.videoStreamSettings = settings;
                localMediaControl.attachStream(ncStream, hasAudio, hasVideo);
                ncStream.publish(getPublishStreamName());
            } else {
                //subscribe
                this.usingLocalMedia = false;
                remoteMediaControl.attachStream(ncStream);
                ncStream.play(getPlayStreamName());
            }
        }

        public function release():void {
            if (usingLocalMedia) {
                //ncStream.publish(false);
            } else {
                ncStream.play(false);
            }
            ncStream.close();
        }

        public function isUsingLocalMedia():Boolean {
            return this.usingLocalMedia;
        }

        private function onNetStatus(event : NetStatusEvent) : void{
            var eventInfoStr:String = "";
            for(var id:String in event.info) {
                var value:Object = event.info[id];
                eventInfoStr += id + "=" + value + "; ";
            }
            Logger.info("NetStream " + event + " - " + eventInfoStr);
        }

        private function asyncErrorHandler(event: AsyncErrorEvent):void {
            Logger.info("NetStream async error: " + event);
        }

        private function getPublishStreamName():String {
            return "OUT_" + application.getId();
        }

        private function getPlayStreamName():String {
            return "IN_" + application.getId();
        }

	}
}