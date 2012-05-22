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
		
	import com.adobe.cairngorm.commands.ICommand;
	import com.adobe.cairngorm.control.CairngormEvent;
	import com.flashphoner.Logger;
	import com.flashphoner.api.data.ModelLocator;
	import com.flashphoner.api.data.PhoneConfig;
	import com.flashphoner.api.management.VideoControl;
	
	import flash.events.*;
	import flash.media.SoundCodec;
	import flash.utils.*;
	
	internal class CallCommand implements ICommand
	{		
		private var hangupTimer:Timer;
		
		public function CallCommand()
		{
		}
		
		public function publishPlay(call:Call,login:String, phoneSpeaker:PhoneSpeaker):void{			
			Logger.info("publishPlay");
			call.publish();	 		
			phoneSpeaker.play("INCOMING_"+login+"_"+call.id);
			if (PhoneConfig.VIDEO_ENABLED){
				phoneSpeaker.playVideo("VIDEO_INCOMING_"+login+"_"+call.id);
			}
		}
				
		public function execute( event : CairngormEvent ) : void
		{	
			Logger.info("PhoneCommand.execute() event.type "+event.type);
			
			var call:Call = (event as CallEvent).call;
			var flashAPI:Flash_API = call.flash_API;			
			
			if (event.type==CallEvent.TALK){
				Logger.info("MainEvent.TALK "+call.id);
				call.startTimer();
				if (!call.isMSRP){
					SoundControl.stopRingSound();					
					flashAPI.publishPlay(call);
				}
			}
			
			if (event.type==CallEvent.HOLD){
				if (!call.isMSRP){				
					call.unpublish();
				}
			}
			 
			if (event.type == CallEvent.SESSION_PROGRESS){
				Logger.info("MainEvent.SESSION_PROGRESS");
				if (!call.isMSRP){
		 			SoundControl.stopRingSound();			
					flashAPI.play(call);
				}
		 	}
			
			if (event.type==CallEvent.IN){				
				if (!call.isMSRP && flashAPI.callsSize() == 1){
					Logger.info("CallCommand incoming ringing sound ...");					
					SoundControl.playInRingSound();
				}
			}
			
			if (event.type ==CallEvent.OUT){
				if (!call.isMSRP && flashAPI.callsSize() == 1){
					Logger.info("CallCommand outgoing ringing sound ...");					
					SoundControl.playOutRingSound();
				}
			}
			
			if (event.type == MainEvent.VIDEO_FORMAT_CHANGED){
				flashAPI.videoControl.changeFormat(call.streamerVideoWidth,call.streamerVideoHeight);
			}			
			
			if (event.type == CallEvent.BUSY){
				if (!call.isMSRP){
					SoundControl.playBusySound();		
					SoundControl.stopRingSound();
				}
			}
			if (event.type == CallEvent.FINISH){
				call.stopTimer();
				flashAPI.removeCall(call.id);
				if (!call.isMSRP){
					flashAPI.soundControl.disableAGC();
					if (flashAPI.callsSize() == 0){
						SoundControl.playFinishSound();
					}
					SoundControl.stopRingSound();														
				
					call.unpublish();
					flashAPI.unholdAnyCall();
					flashAPI.phoneServerProxy.phoneSpeaker.stopAudio(call.id);
					flashAPI.phoneServerProxy.phoneSpeaker.stopVideo(call.id);
				}
			}				
			
		}
	}
}
