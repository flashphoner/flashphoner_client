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
	import com.flashphoner.api.data.PhoneConfig;
	import com.flashphoner.api.management.VideoControl;
	
	import flash.events.AsyncErrorEvent;
	import flash.events.NetStatusEvent;
	import flash.media.Camera;
	import flash.media.H264Profile;
	import flash.media.H264VideoStreamSettings;
	import flash.net.NetConnection;
	import flash.net.NetStream;
	import flash.net.Responder;

	internal class CallServerProxy
	{
		private var outStream:NetStream;
		
		private var nc:NetConnection;
		private var flashCall:Call;
		
		private var sendVideo:Boolean = false;
		
		public function CallServerProxy(call:Call,nc:NetConnection)
		{		
			this.nc = nc;
			this.flashCall = call;
		}
		
		public function sendDtmf(dtmf:String):void{
			Logger.info("CallServerProxy.sendDtmf() "+dtmf);
			var dtmfObject:Object = new Object();
			dtmfObject.callId = flashCall.id;
			dtmfObject.dtmf = dtmf;
			nc.call("sendDtmf", null, dtmfObject);
		}
		
		public function hangup():void{
			Logger.info("CallServerProxy.hangup() call.id: "+ flashCall.id);
			nc.call("hangup", null, flashCall.id);
		}
		
		public function transfer(callee:String):void{
			Logger.info("CallServerProxy.transfer() call.id: "+flashCall.id+";callee: "+callee);
			var transferObject:Object = new Object();
			transferObject.callId = flashCall.id;
			transferObject.callee = callee;			
			nc.call("transfer", null, transferObject);
		}		
		
		public function hold(isHold:Boolean):void{
			Logger.info("CallServerProxy.setStatusHold() call.id: "+flashCall.id+";isHold: "+isHold);
			var holdObject:Object = new Object();
			holdObject.callId = flashCall.id;
			holdObject.isHold = isHold;
			nc.call("hold",null,holdObject);
		}		
		
		public function answer(isVideoCall:Boolean):void{
			Logger.info("CallServerProxy.answer() call.id: "+flashCall.id);
			var answerObject:Object = new Object();
			answerObject.callId = flashCall.id;
			answerObject.hasVideo = isVideoCall;
			nc.call("answer",null,answerObject);	
		}
		
		public function publish(login:String):void{
			Logger.info("CallServerProxy.publish() login: "+login+";call.id: "+flashCall.id);			
			if (outStream == null){
				outStream = new NetStream(nc);
				outStream.addEventListener(AsyncErrorEvent.ASYNC_ERROR,asyncErrorHandler);
				outStream.addEventListener(NetStatusEvent.NET_STATUS,onNetStatus);									
				outStream.attachAudio(flashCall.flash_API.soundControl.getMicrophone());
				outStream.audioReliable = PhoneConfig.AUDIO_RELIABLE;
				outStream.videoReliable = PhoneConfig.VIDEO_RELIABLE;
				
				if (PhoneConfig.VIDEO_ENABLED && sendVideo){					
					setVideoCompressionSettings(outStream);					
				}		
				/* outStream.publish(login+"_"+flashCall.id);
				WSP-1703 - Removed "login_" from stream name. No need now.
				*/
				outStream.publish((flashCall.incoming ? "0":"1") + "_" + flashCall.id);
			}					
		}
		
		private function setVideoCompressionSettings(outStream:NetStream):void{			
			if (PhoneConfig.MAJOR_PLAYER_VERSION >= 11 && PhoneConfig.AVOID_FLV2H264_TRANSCODING){
				Logger.info("Player 11. Using h.264 compresstion settings...")
				var settings:flash.media.H264VideoStreamSettings= new flash.media.H264VideoStreamSettings();					
				settings.setProfileLevel(H264Profile.BASELINE, flash.media.H264Level.LEVEL_3);					
				outStream.videoStreamSettings = settings;				
			}
			var cam:Camera = flashCall.flash_API.videoControl.getCam();
			outStream.attachCamera(cam);
			Logger.info("attach video stream: "+cam.width+"x"+cam.height);
		}
		
		public function unpublish():void{	
			Logger.info("CallServerProxy.unpublish() call.id: "+flashCall.id);
			if (outStream != null){				
				outStream.removeEventListener(AsyncErrorEvent.ASYNC_ERROR,asyncErrorHandler);
				outStream.removeEventListener(NetStatusEvent.NET_STATUS,onNetStatus);		
				outStream.close();
				outStream=null;
			}		
		}		
		public function setSendVideo(flag:Boolean):void{
			sendVideo = flag;
			
			if (outStream == null){
				return;
			}
			
			if (PhoneConfig.VIDEO_ENABLED && sendVideo && flashCall != null){
				
				if (flashCall.state_video != "sendrecv") {
					nc.call("updateCallToVideo",null,flashCall.id);
				}
				
				flashCall.isVideoSended = true;
				setVideoCompressionSettings(outStream);
			}
			
			if (!sendVideo){
				outStream.attachCamera(null);
			}		
		} 
		
		private function asyncErrorHandler(event: AsyncErrorEvent):void {
		}
		
		private function onNetStatus(event : NetStatusEvent) : void{
		}
	}
}
