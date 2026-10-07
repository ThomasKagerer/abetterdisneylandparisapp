(function(root){
class Dwell{
 constructor(){this.id=null;this.since=0;this.last=0;this.notified=new Set();}
 observe(id,now,valid=true,arrived=false){
  if(!valid||!id){this.id=null;this.since=0;this.last=0;return null;}
  if(id!==this.id||now-this.last>45000||now<this.last){this.id=id;this.since=now;}
  this.last=now;
  if((arrived||now-this.since>=300000)&&!this.notified.has(id)){this.notified.add(id);return id;}
  return null;
 }
}
root.DisneyQueueDwell={Dwell};if(typeof module!=='undefined')module.exports=root.DisneyQueueDwell;
})(typeof self!=='undefined'?self:globalThis);
