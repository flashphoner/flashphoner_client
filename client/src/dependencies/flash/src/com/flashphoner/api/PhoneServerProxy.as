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
package com.flashphoner.api
{	
	import com.flashphoner.Logger;
	
	import flash.events.*;
	import flash.media.Camera;
	import flash.media.H264Profile;
	import flash.net.*;
	import flash.system.Security;
	import flash.system.SecurityPanel;
	import flash.utils.Timer;
	import flash.utils.setTimeout;
	
	import mx.controls.Alert;
	
	/**
	 * Media server outgoing communication class
	 * **/
	internal class PhoneServerProxy
	{			
		internal var nc:NetConnection;		
		
		public var hasDisconnectAttempt:Boolean;
		
		public var phoneSpeaker:PhoneSpeaker;
		
		private var flash_API:FlashAPI;
		
		private var isConnected:Boolean;
		
		private var outStreams:Object = {};
		
		public function PhoneServerProxy(flash_API:FlashAPI)
		{		
			this.flash_API = flash_API;

			nc = new NetConnection();
			nc.client = new PhoneCallback(flash_API);
			phoneSpeaker = new PhoneSpeaker(nc,flash_API);
			isConnected = false;
			
		}
		
		public function connect(WCSUrl:String, obj:Object):void {
			nc.addEventListener(NetStatusEvent.NET_STATUS,netStatusHandler);
			nc.connect(WCSUrl,obj);
		}
		
		public function disconnect():void {
			hasDisconnectAttempt = true;
			nc.close();
		}
		
		public function netStatusHandler(event : NetStatusEvent) : void
		{		
			var eventInfoStr:String = "";
			for(var id:String in event.info) {
				var value:Object = event.info[id];
				eventInfoStr += id + "=" + value + "; ";
			}
			Logger.info("NetConnection " + event + " - " + eventInfoStr);

			if(event.info.code == "NetConnection.Connect.Success")
			{
				isConnected = true;
			} else if(event.info.code == "NetConnection.Connect.Failed")
			{
				hasDisconnectAttempt = false;
			} else if (event.info.code == 'NetConnection.Connect.Rejected')
			{
				Alert.show("Connect rejected,\n permission to server denied.");
				hasDisconnectAttempt = false;
			} else if (event.info.code == 'NetConnection.Connect.Closed')
			{				
				outStreams = {};
				hasDisconnectAttempt = false;
				isConnected = false;
			}		
		}
		
		
		public function publish(streamName:String, hasAudio:Boolean, hasVideo:Boolean):void{
			Logger.info("publish() streamName: "+streamName);
			var outStream:NetStream = outStreams[streamName];
			if (outStream == null){
				outStream = new NetStream(nc);
				outStream.addEventListener(AsyncErrorEvent.ASYNC_ERROR,asyncErrorHandler);
				outStream.addEventListener(NetStatusEvent.NET_STATUS,onNetStatus);									

				if (flash_API.configuration.audioReliable != null){
					outStream.audioReliable = flash_API.configuration.audioReliable;
				}
				if (flash_API.configuration.videoReliable != null){
					outStream.videoReliable = flash_API.configuration.videoReliable;
				}
				
				if (hasAudio){
					outStream.attachAudio(flash_API.getMicrophone());
				}
				if (hasVideo){
					setVideoCompressionSettings(outStream);
				}
				outStream.publish(streamName);
				outStreams[streamName] = outStream;
			} else {
				if (hasAudio){
					outStream.attachAudio(flash_API.getMicrophone());
				}
				if (hasVideo){
					setVideoCompressionSettings(outStream);
				}
			}
		}
		
		public function unpublish(streamName:String):void{	
			Logger.info("unpublish() name: "+streamName);
			var outStream:NetStream = outStreams[streamName];
			if (outStream != null){				
				outStream.removeEventListener(AsyncErrorEvent.ASYNC_ERROR,asyncErrorHandler);
				outStream.removeEventListener(NetStatusEvent.NET_STATUS,onNetStatus);		
				outStream.close();
				outStreams[streamName] = null;
			}		
		}
		
		public function hold(streamName:String):void{
			Logger.info("hold() name: "+streamName);
			var outStream:NetStream = outStreams[streamName];
			if (outStream != null){				
				outStream.attachCamera(null);
				outStream.attachAudio(null);
			}
		}
		
		public function enableVideo(streamName:String):void{
			var outStream:NetStream = outStreams[streamName];
			if (outStream != null){
				setVideoCompressionSettings(outStream);
			}
		}
		
		public function disableVideo(streamName:String):void{
			var outStream:NetStream = outStreams[streamName];
			if (outStream != null){
				outStream.attachCamera(null);
			}			
		}
		
		private function setVideoCompressionSettings(outStream:NetStream):void{			
			if (flash_API.getFlashPlayerMajorVersion() >= 11){
				Logger.info("Player 11. Using h.264 compresstion settings...")
				var settings:flash.media.H264VideoStreamSettings= new flash.media.H264VideoStreamSettings();					
				settings.setProfileLevel(H264Profile.BASELINE, flash.media.H264Level.LEVEL_3);					
				outStream.videoStreamSettings = settings;				
			}
			flash_API.videoControl.attachStream(outStream);
		}

		
		public function getStatistics(streamName:String):Object {
			var outgoingStreams:Object = new Object();
			var outStream:NetStream = outStreams[streamName];
			if (outStream != null) {
				outgoingStreams.info = outStream.info;
				outgoingStreams.audio = new Object();
				outgoingStreams.video = new Object();
				
			}
			return outgoingStreams;
		}
		
		private function asyncErrorHandler(event: AsyncErrorEvent):void {
			Logger.info("NetStream async error: " + event);
		}
		
		private function onNetStatus(event : NetStatusEvent) : void{
			var eventInfoStr:String = "";
			for(var id:String in event.info) {
				var value:Object = event.info[id];
				eventInfoStr += id + "=" + value + "; ";
			}			
			Logger.info("NetStream " + event + " - " + eventInfoStr);
		}
		
		
		public function pong():void{
			nc.call("pong", null);		
		}
		
	}
}
