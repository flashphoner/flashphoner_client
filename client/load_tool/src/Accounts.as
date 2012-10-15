package
{
	import com.flashphoner.Logger;
	import com.flashphoner.api.Call;
	import com.flashphoner.api.Flash_API;
	import com.flashphoner.api.data.PhoneConfig;
	
	import flash.events.Event;
	import flash.events.IOErrorEvent;
	import flash.events.SecurityErrorEvent;
	import flash.events.TimerEvent;
	import flash.net.URLLoader;
	import flash.net.URLRequest;
	import flash.sampler.startSampling;
	import flash.utils.Timer;
	
	import mx.collections.ArrayCollection;
	import mx.controls.Alert;
	import mx.core.Application;


	[Binable]
	/**
	 * Class loading all Accounts and stores the probabilities of events
	 **/
	public class Accounts
	{
		
		public var accounts:ArrayCollection = new ArrayCollection();
		
		public static var allUsernames:ArrayCollection = new ArrayCollection();		
		
		private static var accountsObj:Accounts;
		private var from:int;
		private var to:int;
		private var timer:Timer;
		
		/**
		 * Minimum count of calls
		 **/
		public var minCountCall:int = 8;
		/**
		 * Maximum count of calls
		 **/
		public var maxCountCall:int = 12;
		/**
		 * Minimum time of call
		 **/
		public var minTimeCall:int = 120;
		/**
		 * Probability login -> logoff
		 **/
		public var loginLogoff:int = 0;
		/**
		 * Probability login -> any action
		 **/
		public var loginAction:int = 0;
		
		/**
		 * Probability incomming call -> hangup call
		 **/
		public var incomHangup:int = 0;
		/**
		 * Probability incomming call -> answer
		 **/
		public var incomAnswer:int = 0;
		/**
		 * Probability call to user -> hangup
		 **/
		public var callHangup:int = 0;

		/**
		 * Probability talk -> hangup
		 **/
		public var talkHangup:int = 0;
		/**
		 * Probability talk -> hold
		 **/
		public var talkHolding:int = 0;
		/**
		 * Probability talk -> stop start video
		 **/
		public var talkStopStartVideo = 0;		
		/**
		 * Probability talk -> tranfer call
		 **/
		public var talkTransfer:int = 0;

		/**
		 * Probability holding call -> hangup
		 **/
		public var holdingHangup:int = 0;
		/**
		 * Probability holding -> unhold
		 **/
		public var holdingUnhold:int = 0;
		
		/**
		 * Probability holded -> hangup
		 **/
		public var holdedHangup:int = 0;
		/**
		 * Probability holded -> transfer
		 **/
		public var holdedTransfer:int = 0;

		/**
		 * Allow call himself
		 **/
		public var callMe:Boolean = false;
		/**
		 * Data of current statistic
		 **/
		public var statisticCollection:ArrayCollection = new ArrayCollection();
		/**
		 * Count of calls in Talk state
		 **/
		public var callsOfTalkState:int = 0;
		
		/**
		 * Update data of statistic by all accounts
		 **/
		public function updateStatistic():void{
			statisticCollection.removeAll();
			statisticCollection.addItem({state:"accounts",count:accounts.length});
			var countLogoff:int = 0;
			var countLogin:int = 0;
			var countIncom:int = 0;
			var countCall:int = 0;
			var countTalk:int = 0;
			var countHolding:int = 0;
			var countHolded:int = 0;
			var countAllCalls:int = 0;
			var sendingVideo = 0;
			for each (var temp:* in accounts){
				var account:Account = Account(temp);
				if(account.flashAPI.modelLocator.logged){
					countLogin++;
				}else{
					countLogoff++;
				}
				for each (var call:Call in account.flashAPI.calls){
					countAllCalls++;
					if (call.state == Call.STATE_RING && call.incoming){
						countIncom++;
					} else if (call.state == Call.STATE_RING && !call.incoming){
						countCall++;
					} else if (call.state == Call.STATE_TALK){
						if (call.isVideoCall){
							sendingVideo++;	
						}
						countTalk++;
					} else if (call.state ==Call.STATE_HOLD && call.iHolded){
						countHolding++;
					} else if (call.state ==Call.STATE_HOLD && call.iHolded){
						countHolded++;
					}
				}
			}	
			callsOfTalkState = countTalk;
			statisticCollection.addItem({state:"logoff",count:countLogoff});
			statisticCollection.addItem({state:"login",count:countLogin});
			statisticCollection.addItem({state:"allCalls",count:countAllCalls});
			statisticCollection.addItem({state:"incom",count:countIncom});
			statisticCollection.addItem({state:"call",count:countCall});
			statisticCollection.addItem({state:"talk",count:countTalk});
			statisticCollection.addItem({state:"sending video",count:sendingVideo});
			statisticCollection.addItem({state:"holding",count:countHolding});
			statisticCollection.addItem({state:"holded",count:countHolded});
		}
		/**
		 * Get object of singelton
		 **/
		public static function getInstance():Accounts{
			if (accountsObj == null){
				accountsObj = new Accounts();
				accountsObj.startTimer();
			}
			
			return accountsObj;
		}
		/**
		 * Initialize accounts from file 
		 * @param from from number in file
		 * @param to to number in file
		 **/
		public function initAccounts(from:int, to:int):void{
			this.from = from;
			this.to = to;
			var loader:URLLoader = new URLLoader();
			var qwe:Object = Application.application.parameters;
			var config:String = "general.xml";
			var request:URLRequest = new URLRequest(config);
			loader.load(request);
			loader.addEventListener(Event.COMPLETE, onComplete);
			loader.addEventListener(SecurityErrorEvent.SECURITY_ERROR,seurityErrorHandler);
			loader.addEventListener(IOErrorEvent.IO_ERROR,ioErrorHandler);
		}
		
		private function seurityErrorHandler(event:SecurityErrorEvent):void{
			throw new Error(event.toString());
		} 
		
		private function ioErrorHandler(event:IOErrorEvent):void{
			throw new Error(event.toString());
		}
		
		/**
		 * Handler on readed the data file
		 **/
		private function onComplete(event:Event):void
		{	
			var loader:URLLoader = event.target as URLLoader;
			if (loader != null)
			{
				var xml:XML = new XML(loader.data);
				var from_A:int = int(xml.from);
				var to_A:int = int(xml.to);

				for (var i:int = from_A; i <= to_A; i++){
					var temp:String = xml['account_'+i];
					var array:Array = temp.split(",");
					Accounts.allUsernames.addItem(array[0]);
					if (i >= from && i <= to){
						var account:Account = new Account();
						account.username = array[0];
						account.outboundProxy = array[1];
						account.port = array[2];
						account.password = array[3];
						Accounts.getInstance().accounts.addItem(account);
					}
				}
				Application.application.accountsLoaded();
			}
			else
			{
				Alert.show("Can not load xml settings. Default settings will be used.","",Alert.OK);
			}
		} 
		
		/**
		 * Start load tool for all accounts
		 **/
		public function startTest():void{
			for each (var temp:* in accounts){
				var account:Account = temp as Account;
				account.startTest();
			}
		}	
		/**
		 * Stop load tool for all accounts
		 **/
		public function stopTest():void{
			for each (var temp:* in accounts){
				var account:Account = temp as Account;
				account.stopTest();
			}
			accounts = new ArrayCollection();
			allUsernames = new ArrayCollection();
		}	
		
		/**
		 * Start timer for update statistics
		 **/
		public function startTimer():void{
			if (timer!=null){
				timer.removeEventListener(TimerEvent.TIMER,timerHandler);
				timer.stop();
				timer = null;
			}
			timer = new Timer(500);
			timer.addEventListener(TimerEvent.TIMER,timerHandler);					
			timer.start();			
		}
		/**
		 * Handler which execute update statistics
		 **/
		private function timerHandler(timeEvent:TimerEvent):void{
			updateStatistic();
		}
		
	}
}