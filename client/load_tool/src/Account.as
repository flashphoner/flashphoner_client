package
{
	import com.flashphoner.api.Call;
	import com.flashphoner.Logger;
	import com.flashphoner.api.Flash_API;
	import com.flashphoner.api.data.PhoneConfig;
	import com.flashphoner.api.interfaces.APINotify;
	
	import flash.events.TimerEvent;
	import flash.utils.Timer;
	
	import mx.core.Application;

	[Bindable]
	/**
	 * Account that can execute commands Flashphoner_api with some probability
	 **/
	public class Account
	{
		/**
		 * Username of user in sip-format
		 **/
		public var username:String;
		/**
		 * Outbound proxy
		 **/
		public var outboundProxy:String;
		/**
		 * Port
		 **/
		public var port:String;		
		/**
		 * Password for user
		 **/
		public var password:String;
		/**
		 * flash_API which use account 
		 **/
		public var flashAPI:Flash_API;

		private var timer:Timer;
		
		/**
		 * Default constructor initialized flash_api and notifiers
		 **/
		public function Account()
		{
			var apiNotify:APINotifyImpl = new APINotifyImpl();
			flashAPI = new Flash_API(apiNotify);
			apiNotify.setAPI(flashAPI);
			flashAPI.initMedia();
			
		}
		
		private function login():void{
			Application.application.logs += username+" - execute login\n";
			var loginObject:Object = new Object();
			loginObject.username = username;
			loginObject.password = password;
			loginObject.outboundProxy = outboundProxy;
			loginObject.port = port;			
			flashAPI.login(loginObject);
		}
		/**
		 * Execute call to a random user command
		 **/
		private function callToUser():void{
			do{
				var randInt:int = PhoneConfig.getRandomInt(0,Accounts.allUsernames.length-1);				
				var callee:String = String(Accounts.allUsernames.getItemAt(randInt));
			}while (!Accounts.getInstance().callMe && callee == username);
			
			Application.application.logs += username+" - execute call to "+callee+"\n";
			flashAPI.call(callee, username);
		}
		
		/**
		 * Execute transfer command
		 **/
		private function transfer(call:Call):void{
			do{
				var randInt:int = PhoneConfig.getRandomInt(0,Accounts.allUsernames.length-1);				
				var callee:String = String(Accounts.allUsernames.getItemAt(randInt));
			}while (!Accounts.getInstance().callMe && callee == username);
			
			Application.application.logs += username+" - execute transfer to "+callee+"\n";
			call.transfer(callee);
		}
		
		/**
		 * Execute logoff command
		 **/
		private function logoff():void{
			Application.application.logs += username+" - execute logoff\n";
			flashAPI.logoff();
		}
		
		/**
		 * Start execute flashphoner api commands
		 **/
		public function startTest():void{
			if (timer!=null){
				timer.removeEventListener(TimerEvent.TIMER,timerHandler);
				timer.stop();
				timer = null;
			}
			timer = new Timer(PhoneConfig.getRandomInt(5,10)*1000,0);
			timer.addEventListener(TimerEvent.TIMER,timerHandler);					
			timer.start();			
		}
		
		/**
		 * Executor commands with some probability from user interface
		 **/
		private function timerHandler(timeEvent:TimerEvent):void{
			var value:int;
			
			var accounts:Accounts = Accounts.getInstance();
			if (!flashAPI.modelLocator.logged){				
				login();
			} else {
				value = PhoneConfig.getRandomInt(1,100);
				Logger.info("value="+value+" accounts.loginLogoff="+accounts.loginLogoff);				
				if (value <= accounts.loginLogoff){
					Logger.info("value <= accounts.loginLogoff ");
					logoff();
				}else if (value > accounts.loginLogoff && value <= accounts.loginLogoff+accounts.loginAction){
					Logger.info("value > accounts.loginLogoff && value <= accounts.loginLogoff+accounts.loginAction");
					for each (var call:Call in flashAPI.calls){
 						if (call.state == Call.STATE_RING && call.incoming){
 							Logger.info("call.state == Call.STATE_RING && call.incoming "+call.id);
							if (accounts.callsOfTalkState/2 > accounts.maxCountCall){
								Application.application.logs += username+" - execute hangup for callId "+call.id+"\n";
								call.hangup();
							}else if (accounts.callsOfTalkState/2 < accounts.minCountCall){
								Application.application.logs += username+" - execute ANSWER for callId "+call.id+"\n";
								call.answer();
							}else{
								value = PhoneConfig.getRandomInt(1,100);
								if (value <= accounts.incomAnswer){
									Application.application.logs += username+" - execute ANSWER for callId "+call.id+"\n";
									call.answer();
								}else if (value > accounts.incomAnswer && value <= accounts.incomAnswer+accounts.incomHangup){
									Application.application.logs += username+" - execute hangup for callId "+call.id+"\n";
									call.hangup();
								}
							}	
						} else if (call.state == Call.STATE_RING && !call.incoming){
							Logger.info("call.state == Call.STATE_RING && !call.incoming: "+call.id);
							value = PhoneConfig.getRandomInt(1,100);
							if (value <= accounts.callHangup){
								Application.application.logs += username+" - execute hangup for callId "+call.id+"\n";
								call.hangup();
							}				
						} else if (call.state == Call.STATE_TALK){
							Logger.info("call.state == Call.STATE_TALK: "+call.id);
							if (call.timeOfCall > accounts.minTimeCall){
								value = PhoneConfig.getRandomInt(1,100);
								if (value <= accounts.talkHangup){
									Application.application.logs += username+" - execute hangup for callId "+call.id+"\n";
									call.hangup();
								}else if (value > accounts.talkHangup && value <= accounts.talkHangup+accounts.talkHolding){
									Application.application.logs += username+" - execute HOLDING for callId "+call.id+"\n";
									call.setStatusHold(true);
								}else if (value > accounts.talkHangup+accounts.talkHolding && value <= accounts.talkHangup+accounts.talkHolding + accounts.talkTransfer){
									transfer(call);
								}else if (PhoneConfig.VIDEO_ENABLED){
									if (value >accounts.talkHangup+accounts.talkHolding + accounts.talkTransfer && value < accounts.talkHangup+accounts.talkHolding + accounts.talkTransfer + accounts.talkStopStartVideo ){
										if (call.isVideoCall){
											call.setSendVideo(false);
										}else{
											call.setSendVideo(true);
										}
									}
								}
							}
						} else if (call.state == Call.STATE_HOLD && call.iHolded){
							Logger.info("call.state == Call.STATE_HOLD && call.iHolded: "+call.id);						
							value = PhoneConfig.getRandomInt(1,100);
							if (value <= accounts.holdingHangup){
								Application.application.logs += username+" - execute hangup for callId "+call.id+"\n";
								call.hangup();
							}else if (value > accounts.holdingHangup && value <= accounts.holdingHangup+accounts.holdingUnhold){
								Application.application.logs += username+" - execute UNHOLDING for callId "+call.id+"\n";
								call.setStatusHold(false);
							}
						} else if (call.state == Call.STATE_HOLD && !call.iHolded){
							Logger.info("call.state == Call.STATE_HOLD && !call.iHolded: "+call.id);
							value = PhoneConfig.getRandomInt(1,100);
							if (value <= accounts.holdedHangup){
								Application.application.logs += username+" - execute hangup for callId "+call.id+"\n";
								call.hangup();
							}else if (value > accounts.holdedHangup && value <= accounts.holdedHangup+accounts.holdedTransfer){
								transfer(call);
							}
						}	
						
					}
					if (flashAPI.calls.length == 0){
						callToUser();
					}
				}
			}
		}
		
		/**
		 * Stop execute flashphoner api commands
		 **/ 		
		public function stopTest():void{
			timer.removeEventListener(TimerEvent.TIMER,timerHandler);
			timer.stop();
			timer = null;
			if (flashAPI.modelLocator.logged){
				flashAPI.logoff();
			}
		}
	}		
	 
}