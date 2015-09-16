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
	import flash.media.*;
	import flash.net.NetConnection;
	import flash.net.NetStream;
	
	import mx.core.UIComponent;
	
	/**
	 * Phone speaker and video window implementation
	 * **/	
	public class PhoneSpeaker extends UIComponent
	{	
		private var videoContainer:UIComponent;		
		private var video:Video;
		private var currentStream:NetStream;
		private var streams:Object = {};
		private var netConnection:NetConnection;

		private  var currentVolume:int = 100;
		private var currentStreamName:String;
		private var rePlay:Boolean = false;
		
		private var flashAPI:FlashAPI;
		
		/**
		 * Construstor to create video object
		 * @param netConnection connection for playing audio and video
		 **/
		public function PhoneSpeaker(netConnection:NetConnection, flashAPI:FlashAPI):void
		{
			this.flashAPI = flashAPI;
			this.netConnection = netConnection;
			video = new Video();
			addChild(video);			
			video.width = 215;
			video.height = 138;
			video.clear();			
		}
		
		private function nsOnStatus(event:NetStatusEvent):void
		{
			var eventInfoStr:String = "";
			for(var id:String in event.info) {
				var value:Object = event.info[id];
				eventInfoStr += id + "=" + value + "; ";
			}				
			Logger.info("PhoneSpeaker.nsOnStatus() " + event + " - " + eventInfoStr);
		}	
		
		
		/**
		 * Stop playing audio stream for call
		 * @param callId identifier for call
		 **/
		public function stop(streamName:String):void{
			Logger.info("PhoneSpeaker.stopAudio() - "+streamName +"; current stream name - "+streamName);
			var incomingStream:NetStream = streams[streamName];
			if (incomingStream != null) {
				incomingStream.removeEventListener(NetStatusEvent.NET_STATUS,nsOnStatus);
				try{
					incomingStream.play(false);
					incomingStream.close();
				}catch (e:Error){
					Logger.error(e.message);
				}
				incomingStream.close();
				streams[streamName] = null;
				if (currentStreamName == streamName){
					currentStream = null;
					currentStreamName = null;
					video.clear();
					video.attachNetStream(null);
				}
			}
		}
		
		/**
		 * Play audio stream
		 * @param streamName name of audio stream
		 **/
		public function play(streamName:String, rePlay:Boolean):void{
			Logger.info("PhoneSpeaker play streamName="+streamName +"; currentStremName="+currentStreamName);
			//If we have a new stream, we stop old and start new
			//This is mandatory for reInvite and update to video session
			var needReplay:Boolean = this.rePlay;  
			this.rePlay = rePlay;
			if (currentStream != null){
				if (currentStreamName == streamName && !needReplay){
					return;
				}
				stop(currentStreamName);
			}
			currentStream = startNewIncomingStream(streamName,nsOnStatus);
			currentStreamName = streamName;
			streams[streamName] = currentStream;
		}

		private function startNewIncomingStream(streamName:String, listener:Function):NetStream{
			Logger.info("PhoneSpeaker startNewIncomingStream streamName="+streamName);
			
			var stream:NetStream = new NetStream(netConnection);
			
			stream.addEventListener(NetStatusEvent.NET_STATUS, listener);
			
			var streamClientObj:Object = new Object();
			stream.client = streamClientObj;
			if (flashAPI.configuration.flashBufferTime != null) {
				stream.bufferTime = flashAPI.configuration.flashBufferTime;
			} else {
				stream.bufferTime = 0.2;
			}
			
			Logger.info("bufferTime "+stream.bufferTime);
				
			var soundTransform:SoundTransform = new SoundTransform();	
			soundTransform.volume=currentVolume/100;
						
			stream.soundTransform = soundTransform;					
			stream.play(streamName);
						
			video.attachNetStream(stream);
						
			return stream;			
		}
		
		/**
		 * Get current volume for speakers (1-100) 
		 **/
		public function getVolume():int{
			return currentVolume;
		}		
		
		/**
		 * Set current volume for speakers
		 * @param volume (1-100)
		 **/
		public function setVolume(volume:int):void{
			currentVolume = volume;
			if (currentStream != null){
				var soundTransform:SoundTransform = new  SoundTransform;	
				soundTransform.volume = currentVolume/100;
				currentStream.soundTransform = soundTransform;
			}
						
		}
		
		/**
		 * Change format of a video
		 * @param format (CIF/QCIF)
		 **/ 
		public function changeFormat(width:int, height:int):void{
			this.video.width=width;
			this.video.height=height;
			this.video.clear();			
		}
		
		public function getStatistics(streamName:String):Object {
			var incomingStreams:Object = new Object();
			var inStream:NetStream = streams[streamName];
			if (inStream != null) {
				incomingStreams.info = inStream.info;
				incomingStreams.audio = new Object();
				incomingStreams.video = new Object();
			}
			return incomingStreams;			
		}
						
	}
}
