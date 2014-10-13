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
	import com.adobe.cairngorm.model.IModelLocator;
	import com.flashphoner.Logger;
	import com.flashphoner.api.data.ErrorCodes;
	import com.flashphoner.api.data.PhoneConfig;
	import com.flashphoner.api.interfaces.APINotify;
	import com.flashphoner.api.js.APINotifyJS;
	
	import flash.display.DisplayObjectContainer;
	import flash.events.*;
	import flash.external.ExternalInterface;
	import flash.media.*;
	import flash.net.*;
	import flash.system.Capabilities;
	import flash.utils.Timer;
	
	import mx.collections.ArrayCollection;
	import mx.core.Application;
	
	/**
	 * Model object
	 * **/	
	[Bindable]
	public class PhoneModel implements IModelLocator 
	{	
		private static var phoneModel:PhoneModel;
		
		public var app : DisplayObjectContainer;
		private var phoneController:PhoneController;
		public var parameters:Object = null;		

		public static function getInstance():PhoneModel {
			if (phoneModel == null){
				phoneModel = new PhoneModel();
			}	
			return phoneModel;				
		}
				
		
		
		public function PhoneModel()
		{	
			super();
			if (Application.application == null || Application.application.parameters == null){
				return;
			}
			setFlashPlayerMajorVersion();
			phoneController = new PhoneController();	
		}	
		
		
		private function setFlashPlayerMajorVersion():void {
			Logger.info("setFlashPlayerMajorVersion");
			var flashPlayerVersion:String = Capabilities.version;			
			var osArray:Array = flashPlayerVersion.split(' ');
			var osType:String = osArray[0];
			var versionArray:Array = osArray[1].split(',');
			PhoneConfig.MAJOR_PLAYER_VERSION = parseInt(versionArray[0]);
			Logger.info("majorVersion "+PhoneConfig.MAJOR_PLAYER_VERSION);
		}
		
	}
	
	
}
