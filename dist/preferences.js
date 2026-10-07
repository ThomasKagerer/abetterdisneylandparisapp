(function(root){'use strict';
function normalize(value={}){if(!value||typeof value!=='object')value={};const c=value.child,child=c&&Number.isFinite(c.age)&&c.age>=0&&c.age<=17&&Number.isFinite(c.height)&&c.height>=40&&c.height<=220?{age:c.age,height:c.height}:null;return {singleRiderAlerts:value.singleRiderAlerts===true,child};}
function load(storage,key){try{return normalize(JSON.parse(storage.getItem(key+':preferences')||'{}'));}catch{return normalize();}}
function childFromFields(age,height){if(typeof age!=='string'||typeof height!=='string'||!age.trim()||!height.trim())return null;return normalize({child:{age:Number(age),height:Number(height)}}).child;}
root.DisneyPreferences={normalize,load,childFromFields};if(typeof module!=='undefined')module.exports=root.DisneyPreferences;
})(typeof globalThis!=='undefined'?globalThis:this);
