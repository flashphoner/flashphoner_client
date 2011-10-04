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
	import com.flashphoner.Logger;
	import com.flashphoner.api.Call;
	import com.flashphoner.api.Flash_API;
	import com.flashphoner.phone.views.ConnectingView;
	
	import flash.display.DisplayObject;
	import flash.filters.BevelFilter;
	import flash.utils.setTimeout;
	
	import mx.core.Application;
	import mx.managers.PopUpManager;
		
	public class ViewControllerPhone
	{
		private var connectingView:ConnectingView;
					
		public function ViewControllerPhone()
		{
		}

		public function failRegisterView():void{
			if (connectingView!=null){
				Logger.info("PhoneView.failRegisterView()");
				connectingView.text="Register fail";
				setTimeout(disconnect,3000);
			}	
		}
		public function sipPortsBusyView():void{
			showConnectingView();
			if (connectingView!=null){
				Logger.info("PhoneView.sipPortsBusyView()");
				connectingView.text="All sip ports is busy";
				connectingView.beClosed = true;
				setTimeout(disconnect,3000);		
			}
		}
		
		public function wrongSipProviderAddressView():void{
			showConnectingView();
			if (connectingView!=null){
				Logger.info("PhoneView.wrongSipProviderAddressView()");
				connectingView.text="Wrong sip provider address";
				connectingView.beClosed = true;
				setTimeout(disconnect,3000);		
			}
		}	
		
		public function waitingForRegisteredConnectionView():void{
			if (connectingView!=null && !connectingView.beClosed){
				Logger.info("PhoneView.waitingForRegisteredConnectionView()");
				connectingView.text="Waiting for registered event...";
			}	
		}
		
		public function hideConnectingView():void{
			if (connectingView!=null){
				PopUpManager.removePopUp(connectingView);
				connectingView=null;
			}
		}
		
		public function showConnectingView():void{
			if (connectingView==null){
				connectingView = new ConnectingView();
				PopUpManager.addPopUp(connectingView,DisplayObject(Application.application),true);
				PopUpManager.centerPopUp(connectingView);
			}
				
		}
		
		public function closedConnectingView():void{
			if (connectingView!=null){
				connectingView.text="Connection closed success";
				setTimeout(hideConnectingView,3000);		
			}				
		}
		
		public function calleeNotFoundView():void{
			showConnectingView();
			if (connectingView!=null){
				connectingView.text="Callee not found!";
				setTimeout(hideConnectingView,3000);		
			}	
		}
		public function mediaPortsBusyView():void{
			showConnectingView();
			if (connectingView!=null){
				Logger.info("PhoneView.mediaPortsBusyView()");
				connectingView.text="All media ports is busy";
				setTimeout(hideConnectingView,3000);		
			}
		}
		
		public function showIncomingView(call:Call):void{
			Logger.info("PhoneView.showIncomingView()");
			DataPhone.getInstance().incommingView.call = call;
			PopUpManager.addPopUp(DataPhone.getInstance().incommingView,DisplayObject(Application.application),true);
			PopUpManager.centerPopUp(DataPhone.getInstance().incommingView);
		}
		
		public function hideIncomingView():void{
			Logger.info("PhoneView.hideIncomingView()");
			PopUpManager.removePopUp(DataPhone.getInstance().incommingView);
		}
		
		public function showTransferView(call:Call):void{
			Logger.info("PhoneView.showTransferView()");
			DataPhone.getInstance().transferView.call = call;
			if (call.state != Call.STATE_HOLD){
				call.setStatusHold(true);	
			}
			PopUpManager.addPopUp(DataPhone.getInstance().transferView,DisplayObject(Application.application),true);
			PopUpManager.centerPopUp(DataPhone.getInstance().transferView);
		}
		
		public function hideTransferView():void{
			Logger.info("PhoneView.hideTransferView()");
			PopUpManager.removePopUp(DataPhone.getInstance().transferView);
		}		

		public function failConnectionView():void{
			if (connectingView!=null){
				Logger.info("PhoneView.failConnectionView()");
				connectingView.text="Connection fail";
				setTimeout(hideConnectingView,3000);
			}	
		}
		
		public function registerAttemptExpire():void{
			if (connectingView!=null){
				Logger.info("PhoneView.registerAttemptExpire()");
				connectingView.text="Check SIP account settings";
				setTimeout(disconnect,3000);
			}			
		}
		
		private function disconnect():void{
			DataPhone.getInstance().flash_API.logoff();
		}
		
		public function pushMessageToInstantMessageChatView(messageObject:Object):void{
			Logger.info("pushMessageToInstantMessageChatView");
			PopUpManager.addPopUp(DataPhone.getInstance().tabChatView,DisplayObject(Application.application));
			PopUpManager.centerPopUp(DataPhone.getInstance().tabChatView);
			DataPhone.getInstance().tabChatView.pushMessage(messageObject);				
		}	
		
	}
}
