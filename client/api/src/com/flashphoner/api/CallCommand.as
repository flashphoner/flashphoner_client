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
	import flash.utils.*;
	
	internal class CallCommand implements ICommand
	{		
		private var hangupTimer:Timer;
		
		public function CallCommand()
		{
		}	
				
		public function execute( event : CairngormEvent ) : void
		{	
			Logger.info("PhoneCommand.execute() event.type "+event.type);
			
			var call:Call = (event as CallEvent).call;
			var flashAPI:Flash_API = call.flash_API;
			var modelLocator:ModelLocator = flashAPI.modelLocator;
			
			if (event.type==CallEvent.TALK){
				Logger.info("MainEvent.TALK "+call.id);
				SoundControl.stopRingSound();				

				call.startTimer();
				call.publish();						
				flashAPI.phoneServerProxy.phoneSpeaker.play("INCOMING_"+modelLocator.login+"_"+call.id);
				if (PhoneConfig.VIDEO_ENABLED){
					flashAPI.phoneServerProxy.phoneSpeaker.playVideo("VIDEO_INCOMING_"+modelLocator.login+"_"+call.id);
				}
			}
			
			if (event.type==CallEvent.HOLD){
				call.unpublish();
			}
			 
			if (event.type == CallEvent.SESSION_PROGRESS){
				Logger.info("MainEvent.SESSION_PROGRESS");
		 		SoundControl.stopRingSound();
				
				call.publish();	 		
		 		flashAPI.phoneServerProxy.phoneSpeaker.play("INCOMING_"+modelLocator.login+"_"+call.id);
		 	}
			
			if (event.type==CallEvent.IN){
				SoundControl.playRingSound();
			}
			
			if (event.type ==CallEvent.OUT){
				SoundControl.playRingSound();
			}
			
			if (event.type == MainEvent.VIDEO_FORMAT_CHANGED){
				flashAPI.videoControl.changeFormat(call.streamerVideoWidth,call.streamerVideoHeight);
				//flashAPI.phoneServerProxy.phoneSpeaker.changeFormat(call.playerVideoWidth,call.playerVideoHeight);
			}			
			
			if (event.type == CallEvent.BUSY){
				SoundControl.playBusySound();		
				SoundControl.stopRingSound();														
			}
			if (event.type == CallEvent.FINISH){
				SoundControl.playFinishSound();		
				SoundControl.stopRingSound();														
				
				call.stopTimer();
				call.unpublish();
				flashAPI.unholdAnyCall();
				flashAPI.removeCall(call.id);
				flashAPI.phoneServerProxy.phoneSpeaker.stopAudio(call.id);
				flashAPI.phoneServerProxy.phoneSpeaker.stopVideo(call.id);
			}				
			
		}
	}
}
