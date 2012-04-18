package com.flashphoner.api
{
	import com.flashphoner.Logger;
	
	import flash.media.Microphone;
	import flash.utils.ByteArray;

	public class AGC
	{	
		
		//variables				
		private var ema:Number=0;
		private var minCount:int=0;			
		private var maxCount:int=0;
		private var emaPrev:Number;
		
		private var gain:Number=100;			
		
		private var emaMax:Number=0;	
		
		//Coefficients		
		private var EMA_ALPHA:Number = 0.5;		
		private var K_LEVEL_MAX:Number = 100;		
		private var K_LEVEL_MIN:Number = 40;		
		private var DOWN_AGRESSIVE_FACTOR:Number = 1.01;		
		private var UP_AGRESSIVE_FACTOR:Number = 1.005;
		private var GAIN_LEVEL:Number=8;
		private var MAX_GAIN:Number=100;
		private var MIN_GAIN:Number=80;
		public var TRACE_AGC:Boolean=false;
		public var K_LEVEL_SUP:Number = 300;
		public var K_LEVEL_MAX_DELTA:Number = 180;
		
		
		public function AGC()			
		{			
		}
		
		public function setPolicy(policy:String):void{
			//Example: min_level=20,max_level=80,agressive_down=1.01,agressive_up=1.05,ema_alpha=0.5,gain_level=8,max_gain=100,min_gain=80,trace=true
			if (policy !=null || policy.length!=0){
				var params:Array = policy.split(",");
				for (var i:int=0;i<params.length;i++){
					var param:String = params[i];
					var nameValue:Array = param.split("=");
					var name:String = nameValue[0];
					var value:String = nameValue[1]
					Logger.info("AGC param: name="+name+" value="+value);
					
					if (name=="min_level"){
						K_LEVEL_MIN = Number(value);
					}else if (name=="max_level"){
						K_LEVEL_MAX = Number(value);
					}else if (name=="agressive_down"){
						DOWN_AGRESSIVE_FACTOR = Number(value);
					}else if (name=="agressive_up"){
						UP_AGRESSIVE_FACTOR = Number(value);
					} else if (name=="ema_alpha"){
						EMA_ALPHA = Number(value);	
					}else if (name=="gain_level"){
						GAIN_LEVEL = Number(value);
					}else if (name=="max_gain"){
						MAX_GAIN = Number(value);
					}else if (name=="min_gain"){
						MIN_GAIN = Number(value);
					}else if (name=="trace"){
						TRACE_AGC = Boolean(value);
					}else if (name=="sup_level"){
						K_LEVEL_SUP = Number(value);
					}else if (name=="max_level_delta"){
						K_LEVEL_MAX_DELTA = Number(value);
					}
				}
			}
			
			Logger.info("AGC initialized");
			Logger.info("min_level: "+K_LEVEL_MIN);
			Logger.info("max_level: "+K_LEVEL_MAX);
			Logger.info("agressive_down: "+DOWN_AGRESSIVE_FACTOR);
			Logger.info("agressive_up: "+UP_AGRESSIVE_FACTOR);
			Logger.info("ema_alpha: "+EMA_ALPHA);			
			Logger.info("gain_level: "+GAIN_LEVEL);
			Logger.info("min_gain: "+MIN_GAIN);
			Logger.info("max_gain: "+MAX_GAIN);
			Logger.info("trace: "+TRACE_AGC);
			Logger.info("K_LEVEL_SUP:"+K_LEVEL_SUP);
			Logger.info("K_LEVEL_MAX_DELTA:"+K_LEVEL_MAX_DELTA);
		}
		
		public function process(data:ByteArray,mic:Microphone):AGCResult {				
			
			var energy:Number=0;
			var outputPowerNormal:Number = Math.pow(10,GAIN_LEVEL/10);
			
			var N:int=0;
			while(data.bytesAvailable){				
				var sample:Number = data.readFloat();
				energy+=sample*sample;
				N++;
			}
			
			if (energy==0){
				energy=1;
			}
			
			var K:Number =Math.min(Math.sqrt(outputPowerNormal*N/energy),K_LEVEL_SUP);				
			
			
			if (ema==0){
				ema = K;
			}else{
				ema = EMA_ALPHA*K+(1-EMA_ALPHA)*ema;
			}
			
			emaMax = Math.max(emaMax,ema);
			
			
			if (ema > K_LEVEL_MAX && ema < K_LEVEL_MAX+K_LEVEL_MAX_DELTA && ema > emaPrev){
				maxCount=maxCount+1
				gain = Math.min(mic.gain*(Math.pow(UP_AGRESSIVE_FACTOR,maxCount)),MAX_GAIN);					
			}else{
				maxCount=0;
			}
			
			if (ema < K_LEVEL_MIN){					
				minCount=minCount+1					
				gain = Math.max(mic.gain/Math.pow(DOWN_AGRESSIVE_FACTOR,minCount),MIN_GAIN);
			}else{
				minCount=0;
			}
			
			emaPrev = ema;
			
			if (TRACE_AGC){
				var logMsg:String = "ema: "+ema+" K: "+K+" gain: "+gain;			
				Logger.debug(logMsg);			
				var result:AGCResult = new AGCResult();
				if (mic.gain != gain){
					mic.gain = gain;
					var resultObj:Object = new Object();
					resultObj.ema=ema;
					resultObj.K=K;
					resultObj.gain=gain;
					resultObj.emaMax=emaMax;
					result.result = resultObj;
					result.hasResult = true;
					return result;
				}else{
					result.hasResult = false;
					return result;
				}
			}else {
				return null;
			}
		}	
	}
}