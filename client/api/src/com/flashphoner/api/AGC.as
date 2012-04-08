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
		
		private var gain:Number=100;			
		
		private var emaMax:Number=0;	
		
		//Coefficients		
		private var EMA_ALPHA:Number = 0.5;		
		private var AGC_LEVEL_MAX:Number = 10;		
		private var AGC_LEVEL_MIN:Number = 2;		
		private var DOWN_AGRESSIVE_FACTOR:Number = 1.05;		
		private var UP_AGRESSIVE_FACTOR:Number = 1.25;
		
		public function AGC()			
		{			
		}
		
		public function setPolicy(policy:String):void{
			//Example: policy=min_level=2,max_level=10,agressive_down=1.05,agressive_up=1.25,ema_alpha=0.5
			if (policy !=null || policy.length!=0){
				var params:Array = policy.split(",");
				for (var i:int=0;i<params.length;i++){
					var param:String = params[i];
					var nameValue:Array = param.split("=");
					var name:String = nameValue[0];
					var value:String = nameValue[1]
					Logger.info("AGC param: name="+name+" value="+value);
					
					if (name=="min_level"){
						AGC_LEVEL_MIN = Number(value);
					}else if (name=="max_level"){
						AGC_LEVEL_MAX = Number(value);
					}else if (name=="agressive_down"){
						DOWN_AGRESSIVE_FACTOR = Number(value);
					}else if (name=="agressive_up"){
						UP_AGRESSIVE_FACTOR = Number(value);
					} else if (name=="ema_alpha"){
						EMA_ALPHA = Number(value);	
					}
				}
			}
			
			Logger.info("AGC initialized");
			Logger.info("min_level: "+AGC_LEVEL_MIN);
			Logger.info("max_level: "+AGC_LEVEL_MAX);
			Logger.info("agressive_down: "+DOWN_AGRESSIVE_FACTOR);
			Logger.info("agressive_up: "+UP_AGRESSIVE_FACTOR);
			Logger.info("ema_alpha: "+EMA_ALPHA);			
		}
		
		public function process(data:ByteArray,mic:Microphone):AGCResult {
			
			var count:Number = data.length;
			var sum:Number = 0;		
			
			var i:int=0;
			while(data.bytesAvailable)     { 
				var sample:Number = data.readFloat();
				sum += sample*sample;
				i++;				
			} 
			
			var value:Number = Math.sqrt(sum);				
			
			if (ema==0){
				ema = value;
			}else{
				ema = EMA_ALPHA*value+(1-EMA_ALPHA)*ema;
			}
			
			emaMax = Math.max(emaMax,ema);
			
			if (ema > AGC_LEVEL_MAX){
				maxCount=Math.min(10,minCount+1);
				gain = mic.gain*(1/Math.pow(DOWN_AGRESSIVE_FACTOR,maxCount));					
			}else{
				maxCount=0;
			}
			
			if (ema < AGC_LEVEL_MIN){					
				minCount=Math.min(10,minCount+1);
				gain = Math.min(mic.gain*(Math.pow(UP_AGRESSIVE_FACTOR,minCount)),100); 
			}else{
				minCount=0;
			}				
			
			var logMsg:String = "ema: "+ema+" energy: "+value+" gain: "+gain+" emaMax: "+emaMax;			
			
			Logger.debug(logMsg);
			
			var result:AGCResult = new AGCResult();
			if (mic.gain != gain){
				mic.gain = gain;
				var resultObj:Object = new Object();
				resultObj.ema=ema;
				resultObj.energy=value;
				resultObj.gain=gain;
				resultObj.emaMax=emaMax;
				result.result = resultObj;
				result.hasResult = true;
				return result;
			}else{
				result.hasResult = false;
				return result;
			}
		}	
	}
}