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
package com.flashphoner.api.management
{
		
	import com.flashphoner.Logger;
	import com.flashphoner.api.data.PhoneConfig;
	
	import flash.events.*;
	import flash.media.*;
	import flash.net.NetConnection;
	import flash.net.NetStream;
	
	import mx.core.UIComponent;
	import com.flashphoner.api.SoundControl;
	
	/**
	 * Phone speaker and video window implementation
	 * **/	
	public class PhoneSpeaker extends UIComponent
	{	
		private var videoContainer:UIComponent;		
		private var video:Video;
		private var incomingStream:NetStream;
		private var incomingVideoStream:NetStream;
		private var netConnection:NetConnection;
		/**
		 * Playing flag for audio
		 **/
		public  var playing:Boolean;
		/**
		 * Playing flag for video
		 **/
		public var playingVideo:Boolean;

		private  var currentVolume:int = 100;
		private var streamNameAudio:String;
		private var streamNameVideo:String;
		
		/**
		 * Construstor to create video object
		 * @param netConnection connection for playing audio and video
		 **/
		public function PhoneSpeaker(netConnection:NetConnection):void
		{
			this.netConnection = netConnection;
			video = new Video();
			addChild(video);			
			video.width = 215;
			video.height = 138;
			video.clear();			
		}
		
		private function nsOnStatus(infoObject:NetStatusEvent):void
		{
			Logger.info("PhoneSpeaker.nsOnStatus()");
			
			if (incomingStream==null){
				return;
			}			
					
			if (infoObject.info.code == "NetStream.Play.Start"){
				playing = true;
				SoundControl.stopRingSound();
			}		
					
			else if (infoObject.info.code == "NetStream.Play.StreamNotFound" || infoObject.info.code == "NetStream.Play.Failed"||infoObject.info.code == "NetStream.Play.Stop"){
				Logger.info("incomingStream.onStatus() "+infoObject.info.description);
				playing = false;
			}
				
		}
		
		private function nsVideoOnStatus(infoObject:NetStatusEvent):void
		{
			Logger.info("PhoneSpeaker.nsVideoOnStatus()");
			
			if (incomingVideoStream==null){
				return;
			}			
					
			if (infoObject.info.code == "NetStream.Play.Start"){
				playingVideo = true;
				SoundControl.stopRingSound();
			}		
					
			else if (infoObject.info.code == "NetStream.Play.StreamNotFound" || infoObject.info.code == "NetStream.Play.Failed"||infoObject.info.code == "NetStream.Play.Stop"){
				Logger.info("incomingVideoStream.nsVideoOnStatus() "+infoObject.info.description);
				playingVideo = false;
			}
				
		}
		
		/**
		 * Stop playing audio stream for call
		 * @param callId identifier for call
		 **/
		public function stopAudio(callId:String):void{
			Logger.info("PhoneSpeaker.stopAudio() - "+callId +"; current stream name - "+streamNameAudio);
			if (incomingStream!=null && streamNameAudio.indexOf(callId) != -1){				
				try{
					incomingStream.play(false);
				}catch (e:Error){
					Logger.error(e.message);
				}
				incomingStream = null;
				playing = false;
			}
		}
		
		/**
		 * Stop playing video stream for call
		 * @param callId identifier for call
		 **/
		public function stopVideo(callId:String):void{
			Logger.info("PhoneSpeaker.stopVideo() - "+callId);
			if (incomingVideoStream!=null && PhoneConfig.VIDEO_ENABLED && streamNameVideo.indexOf(callId) != -1){
				try{
					incomingVideoStream.play(false);
				}catch(e:Error){
					Logger.error(e.message);
				}
				incomingVideoStream = null;	
				playingVideo = false;
				video.clear();
				video.attachNetStream(null);			
			}		
		}
		
		/**
		 * Play audio stream
		 * @param streamName name of audio stream
		 **/
		public function play(streamName:String):void{
			Logger.info("PhoneSpeaker play streamName="+streamName +"; currentStremName="+streamNameAudio);
			if (streamName != streamNameAudio){
				if (incomingStream != null){
					stopAudio(streamNameAudio);
				}
				incomingStream = startNewIncomingStream(streamName,nsOnStatus);
				streamNameAudio = streamName;
			}	
		}

		/**
		 * Play video stream
		 * @param streamName name of video stream
		 **/
		public function playVideo(streamName:String):void{
			Logger.info("PhoneSpeaker playVideo streamName="+streamName+" playingVideo="+playingVideo);
			if (streamName != streamNameVideo){
				if (incomingVideoStream != null){
					stopVideo(streamNameVideo);
				}
				incomingVideoStream = startNewIncomingStream(streamName,nsVideoOnStatus);
				streamNameVideo = streamName;
			}	
		}
		
		private function startNewIncomingStream(streamName:String, listener:Function):NetStream{
			Logger.info("PhoneSpeaker startNewIncomingStream streamName="+streamName);
			
			var stream:NetStream = new NetStream(netConnection);
			
			stream.addEventListener(NetStatusEvent.NET_STATUS, listener);
			
			var streamClientObj:Object = new Object();
			stream.client = streamClientObj;
			stream.bufferTime = PhoneConfig.BUFFER_TIME;
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
			if (incomingStream != null){
				var soundTransform:SoundTransform = new  SoundTransform;	
				soundTransform.volume = currentVolume/100;
				incomingStream.soundTransform = soundTransform;
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
						
	}
}
