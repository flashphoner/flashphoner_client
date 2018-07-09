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

        private var hasAudio:Boolean;
        private var hasVideo:Boolean;
        private var remoteControl:RemoteMediaControl;
        private var localMediaControl:LocalMediaControl;

		public function Stream(application:Main, nc:NetConnection)
		{
			this.application = application;
            this.ncStream = new NetStream(nc);
            this.ncStream.bufferTime = 0;
            this.ncStream.addEventListener(AsyncErrorEvent.ASYNC_ERROR,asyncErrorHandler);
            this.ncStream.addEventListener(NetStatusEvent.NET_STATUS,onNetStatus);
        }

        public function setup(localMediaControl:LocalMediaControl, remoteMediaControl:RemoteMediaControl,
                              hasAudio:Boolean, hasVideo:Boolean, name:String, bufferTime:Number):void {
            this.hasAudio = hasAudio;
            this.hasVideo = hasVideo;
            if (localMediaControl != null) {
                //publish
                this.localMediaControl = localMediaControl;
                //attach video
                var settings:H264VideoStreamSettings= new H264VideoStreamSettings();
                settings.setProfileLevel(H264Profile.BASELINE, H264Level.LEVEL_3);
                ncStream.videoStreamSettings = settings;
                localMediaControl.attachStream(ncStream, hasAudio, hasVideo);
                ncStream.publish(name);
            } else {
                this.remoteControl = remoteMediaControl;
                //subscribe
                remoteMediaControl.attachStream(ncStream);
                if (bufferTime) {
                    ncStream.bufferTime = bufferTime;
                }
                ncStream.play(name);
            }
        }

        public function release():void {
            if (this.localMediaControl != null) {
                this.localMediaControl.removeStream();
            } else {
                ncStream.play(false);
            }
            ncStream.close();
        }

        private function onNetStatus(event : NetStatusEvent) : void{
            var eventInfoStr:String = "";
            for(var id:String in event.info) {
                var value:Object = event.info[id];
                eventInfoStr += id + "=" + value + "; ";
            }
            if (event.info.code == "NetStream.Video.DimensionChange") {
                remoteControl.onVideoResolutionChange();
            }
            Logger.info("NetStream " + event + " - " + eventInfoStr);
        }

        private function asyncErrorHandler(event: AsyncErrorEvent):void {
            Logger.info("NetStream async error: " + event);
        }

        public function getStatistics():Object {
            var stream:Object = new Object();
            if (this.ncStream) {
                stream.info = ncStream.info;
                stream.audio = new Object();
                stream.video = new Object();
            }
            return stream;
        }

	}
}