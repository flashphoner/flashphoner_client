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
	import com.flashphoner.api.data.ModelLocator;
	import com.flashphoner.api.data.PhoneConfig;
	
	import flash.events.TimerEvent;	
	import flash.utils.Timer;

	/**
	 * Class which contain data of call anf method for hangup,trasfer,hold.
	 **/	 	
	[Bindable]
	public class Call
	{	
		
		public static const STATE_RING:String = "RING";
		public static const STATE_HOLD:String = "HOLD";		
		public static const STATE_TALK:String = "TALK";
		public static const STATE_FINISH:String = "FINISH";
		public static const STATE_BUSY:String = "BUSY";
		public static const STATE_SESSION_PROGRESS:String = "SESSION_PROGRESS";
		
		/**
		 * Identifier of call
		 **/
		public var id:String;
		/**
		 * State of call (RING,HOLD,TALK,FINISH,BUSY,SESSION_PROGRESS)
		 **/
		public var state:String;	
		/**
		 * Flag on execute hold operation
		 * true - if user execute call.hold(true)
		 * false - if user execute call.hold(false)
		 **/		
		public var iHolded:Boolean = false;
		
		/**
		 * Sip state of call
		 **/
		public var sip_state:String;
		/**
		 * Not initiator of the call
		 **/
		public var callee:String;
		/**
		 * Initiator of the call
		 **/
		public var caller:String;		
		/**
		 * Not initiators visible name of the call
		 **/
		public var visibleNameCallee:String;
		/**
		 * Initiators visible name of the call
		 **/
		public var visibleNameCaller:String;
		/**
		 * Player video format (CIF,QCIF)  
		 **/
		public var playerVideoHeight:int;
		
		public var playerVideoWidth:int;
		/**
		 * Streamer video format (CIF,QCIF)  
		 **/
		public var streamerVideoHeight:int;
		
		public var streamerVideoWidth:int;
		/**
		 * Time of call  
		 **/
		public var timeOfCall:int = 0;
		private var timer:Timer;
		/**
		 * Another side logged user of call
		 **/
		public var anotherSideUser:String;
		
		/**
		 * Flag on incomming call
		 **/
		public var incoming:Boolean = false;

		public var isMSRP:Boolean = false;
		
		public var isVideoSended:Boolean = false;
		
		private var callServerProxy:CallServerProxy;
		
		internal var flash_API:Flash_API;
		
		/**
		 * @param flash_API Api to be used for this call
		 **/
		public function Call(flash_API:Flash_API)
		{
			this.flash_API = flash_API;
			callServerProxy = new CallServerProxy(this,flash_API.phoneServerProxy.nc);
		}
		
		/**
		 * Ignore this call
		 **/
		public function ignore():void{
			SoundControl.stopRingSound();
		}
		
		/**
		 * Hangup this call
		 **/
		public function hangup():void{
			callServerProxy.unpublish();	
			callServerProxy.hangup();										
			SoundControl.stopRingSound();
		}
		/**
		 * Change state of call (HOLD/TALK)
		 */
		public function setStatusHold(isHold:Boolean):void{
			if (state == Call.STATE_TALK || state == Call.STATE_HOLD){
				callServerProxy.hold(isHold);
			}
		}
		
		/**
		 * Transfer call to another user
		 * @param callee Target transfer call
		 **/
		public function transfer(callee:String):int{
			var modelLocator:ModelLocator = flash_API.modelLocator;
			if (PhoneConfig.CHECK_VALIDATION_CALLEE){
				var reg:RegExp = /[a-zа-яё]/i;
				if (callee != null && callee != ""){
					if ((callee.indexOf("sip:") == 0)){
						if (callee.indexOf("@") == -1 || callee.indexOf("@") == callee.length-1){
							return 1;
						}
					}else{
						if (callee.search(reg) != -1){
							if (callee.indexOf("@") != -1){
								return 1;
							}
							if (callee.indexOf(":") != -1){
								return 1;
							}
							callee = "sip:"+callee+"@"+modelLocator.sipProviderAddress+":"+modelLocator.sipProviderPort;
						}
					}
				}else{
					return 1;
				}
			}			
			for each (var tempCall:Call in flash_API.calls){
				if (tempCall.state == Call.STATE_TALK && tempCall.id != id){
					tempCall.setStatusHold(true);
				}
			}
			callServerProxy.transfer(callee);
			SoundControl.stopRingSound();
			return 0;
		}		

		/**
		 * Answer on incoming call
		 * @param isVideoCall true - if answer with video (default - false).
		 **/ 
		public function answer(isVideoCall:Boolean = false):void{
			SoundControl.stopRingSound();
			for each (var tempCall:Call in flash_API.calls){
				if (tempCall.state == Call.STATE_TALK && tempCall.id != id){
					tempCall.setStatusHold(true);
				}
			}
			callServerProxy.answer(isVideoCall);			
		}
		/**
		 * Start/stop sending video to the server
		 * @param flag true - if start send video.
		 **/ 
		public function setSendVideo(flag:Boolean):void{
			callServerProxy.setSendVideo(flag);		
		} 
		
		/**
		 * Send dtmf command to the sip provider
		 * @param dtmf DTMF command
		 **/ 
		public function sendDTMF(dtmf:String):void{
			new DtmfPlayer(dtmf.toUpperCase()).play();
			callServerProxy.sendDtmf(dtmf);			
		}		
		
		/**
		 * @private
		 * Publish video and audio streams
		 **/ 
		internal function publish():void{
			callServerProxy.publish(flash_API.modelLocator.login);
		}
		/**
		 * @private
		 * Unpublish video and audio streams
		 **/ 
		internal function unpublish():void{
			callServerProxy.unpublish();
		}		
		/**
		 * @private
		 * Start timer of call
		 **/
		internal function startTimer():void{
			if (timer!=null){
				timer.removeEventListener(TimerEvent.TIMER,timerHandler);
				timer.stop();
				timer = null;
			}
			timeOfCall = 0;
			timer = new Timer(999);
			timer.addEventListener(TimerEvent.TIMER,timerHandler);					
			timer.start();			
		}

		/**
		 * @private
		 * Stop timer of call
		 **/
		internal function stopTimer():void{
			timeOfCall = 0;
			if (timer != null){
				timer.removeEventListener(TimerEvent.TIMER,timerHandler);
				timer.stop();
				timer = null;
			}
		}

		private function timerHandler(timeEvent:TimerEvent):void{
			timeOfCall++;
		}	
		
	}
}
