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
	
	import flash.events.*;
	import flash.utils.*;
	
	import mx.collections.ArrayCollection;
	
	internal class MainCommand implements ICommand
	{		
		private var hangupTimer:Timer;
		
		public function MainCommand()
		{
		}	
		
		public function execute( event : CairngormEvent ) : void
		{	
			Logger.info("PhoneCommand.execute() event.type "+event.type);
			
			var flashAPI:Flash_API = (event as MainEvent).flashAPI;
			var modelLocator:ModelLocator = flashAPI.modelLocator;		
			
			if (event.type == MainEvent.CONNECTED){				
				if (!PhoneConfig.REGISTER_REQUIRED){				
					modelLocator.logged = true;		
				}						
			}
			if (event.type == MainEvent.REGISTERED){
				
				if (modelLocator.mode != "click2call"){
					SoundControl.playRegisterSound();
				}
				modelLocator.logged = true;		
				flashAPI.dropRegisteredTimer();
			}	
			
			if (event.type == MainEvent.DISCONNECT){
				SoundControl.stopRingSound();
				modelLocator.logged = false;
				modelLocator.login = null;
				modelLocator.pwd = null;
				flashAPI.calls = new ArrayCollection();
			}		
			
			if (event.type == MainEvent.AUDIO_CODEC_CHANGED_EVENT){
				var codec:Object = (event as MainEvent).obj;
				flashAPI.soundControl.changeAudioCodec(codec);
			}
			
		}
	}
}
