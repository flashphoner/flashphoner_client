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
			nc.call("sendDtmf",null,dtmf,flashCall.id);
		}
		
		public function hangup():void{
			Logger.info("CallServerProxy.hangup() call.id: "+ flashCall.id);
			nc.call("hangup",null,flashCall.id);
		}
		
		public function transfer(callee:String):void{
			Logger.info("CallServerProxy.transfer() call.id: "+flashCall.id+";callee: "+callee);
			nc.call("transfer",null,flashCall.id,callee);
		}		
		
		public function hold(isHold:Boolean):void{
			Logger.info("CallServerProxy.setStatusHold() call.id: "+flashCall.id+";isHold: "+isHold);
			nc.call("hold",null,flashCall.id,isHold);
		}		
		
		public function answer(isVideoCall:Boolean):void{
			Logger.info("CallServerProxy.answer() call.id: "+flashCall.id);
			nc.call("answer",null,flashCall.id,isVideoCall);	
		}
		
		public function publish(login:String):void{
			Logger.info("CallServerProxy.publish() login: "+login+";call.id: "+flashCall.id);			
			if (outStream == null){
				outStream = new NetStream(nc);
				outStream.addEventListener(AsyncErrorEvent.ASYNC_ERROR,asyncErrorHandler);
				outStream.addEventListener(NetStatusEvent.NET_STATUS,onNetStatus);									
				outStream.attachAudio(flashCall.flash_API.soundControl.getMicrophone());		
				
				if (PhoneConfig.VIDEO_ENABLED && sendVideo){	 
					outStream.attachCamera(flashCall.flash_API.videoControl.getCam());
				}		
				outStream.publish(login+"_"+flashCall.id);
			}					
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
				if (!flashCall.isVideoSended){
					nc.call("updateCallToVideo",null,flashCall.id);
				}
				flashCall.isVideoSended = true;
				outStream.attachCamera(flashCall.flash_API.videoControl.getCam());
				nc.call("updateCallToVideo",null,flashCall.id);
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
