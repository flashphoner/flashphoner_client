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
package com.flashphoner.phone
{
	import com.flashphoner.api.Flash_API;
	import com.flashphoner.phone.views.CallView;
	import com.flashphoner.phone.views.IncomingView;
	import com.flashphoner.phone.views.InstantMessageChatView;
	import com.flashphoner.phone.views.MicrophoneSettingsView;
	import com.flashphoner.phone.views.PhoneButton;
	import com.flashphoner.phone.views.SipAccountView;
	import com.flashphoner.phone.views.TabChatView;
	import com.flashphoner.phone.views.TransferView;
	
	import flash.display.DisplayObject;
	import flash.display.DisplayObjectContainer;
	
	import mx.collections.ArrayCollection;
	import mx.controls.List;
	
	/**
	 * Data of phone widget
	 **/
	public class DataPhone
	{
		private static var data:DataPhone;
		/** 
		 * Get instance of a singelton
		 **/		
		public static function getInstance():DataPhone{
			if (data == null){
				data = new DataPhone();
				data.flash_API = new Flash_API(new APINotifyPhone());
				data.version = data.flash_API.getVersion();
			}
			return data;
		}
		
		[Bindable]
		public var version:String;
		
		/** 
		 * Flash_API used for phone widget
		 **/		
		public var flash_API:Flash_API;
		
		/**
		 * Controller of events
		 **/
		public var viewController:ViewControllerPhone = new ViewControllerPhone();
		
		/**
		 * list of calls in phone
		 **/
		public var listCalls:List;
		
		/**
		 * Instance of incomming view
		 **/
		public var incommingView:IncomingView = new IncomingView();
		
		/**
		 * Instance of transfer view
		 **/
		public var transferView:TransferView = new TransferView();		

		/**
		 * Instance of sip account view
		 **/
		public var sipAccountView:SipAccountView = new SipAccountView();

		/**
		 * Instance of microphone settings view
		 **/
		public var microphoneSettingsView:MicrophoneSettingsView = new MicrophoneSettingsView();
		
		public var tabChatView:TabChatView = new TabChatView();

		/**
		 * Get object of CallView which corresponds call
		 * @param callId identifier of call
		 **/
		public function getCallView(callId:String):CallView{
			var index:Number = flash_API.getIndexByCallId(callId);
			var obj:* = listCalls.indexToItemRenderer(index);
			return obj as CallView;
			
		}
	}
}
