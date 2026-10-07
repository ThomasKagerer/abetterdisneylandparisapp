/* Distances are metres along the directed, surveyed pedestrian graph. */
(function(root){
const distance=(a,b)=>{const r=Math.PI/180,x=(b[1]-a[1])*r*Math.cos((a[0]+b[0])*r/2),y=(b[0]-a[0])*r;return Math.hypot(x,y)*6371000;};
class Heap{constructor(){this.a=[];}push(v){const a=this.a;let i=a.length;a.push(v);while(i){let p=(i-1)>>1;if(a[p][0]<=v[0])break;a[i]=a[p];i=p;}a[i]=v;}pop(){const a=this.a,r=a[0],v=a.pop();if(a.length){let i=0;while(2*i+1<a.length){let c=2*i+1;if(c+1<a.length&&a[c+1][0]<a[c][0])c++;if(a[c][0]>=v[0])break;a[i]=a[c];i=c;}a[i]=v;}return r;}}
class Router{
 constructor(data){this.data=data;this.adj=data.nodes.map(()=>[]);for(const [a,b,d] of data.edges)this.adj[a].push([b,d]);this.cache=new Map();}
 snap(point){let best=-1,d=Infinity;this.data.nodes.forEach((p,i)=>{const v=distance(point,p);if(v<d){d=v;best=i;}});return{node:best,distance:d};}
 tree(start){if(this.cache.has(start))return this.cache.get(start);const ds=new Float64Array(this.adj.length);ds.fill(Infinity);const prev=new Int32Array(this.adj.length);prev.fill(-1);ds[start]=0;const q=new Heap();q.push([0,start]);while(q.a.length){const [v,a]=q.pop();if(v!==ds[a])continue;for(const [b,w]of this.adj[a])if(v+w<ds[b]){ds[b]=v+w;prev[b]=a;q.push([v+w,b]);}}const t={ds,prev};if(this.cache.size>80)this.cache.clear();this.cache.set(start,t);return t;}
 leg(a,b){const t=this.tree(a),v=t.ds[b];if(!Number.isFinite(v))throw Error('Für ein Ziel ist kein begehbarer Weg erfasst.');const nodes=[];for(let n=b;n!==-1;n=t.prev[n]){nodes.push(n);if(n===a)break;}return{distance:v,path:nodes.reverse().map(n=>this.data.nodes[n])};}
 optimize(start,stops,deferredIds=[]){const deferred=new Set(deferredIds),order=[];let current=start;
 // Always choose the shortest walking distance among the current priority group.
 for(const group of [stops.filter(s=>!deferred.has(s.id)),stops.filter(s=>deferred.has(s.id))]){const left=[...group];while(left.length){const distances=this.tree(current).ds;let best=0;for(let i=1;i<left.length;i++)if(distances[left[i].node]<distances[left[best].node])best=i;const next=left.splice(best,1)[0];if(!Number.isFinite(distances[next.node]))throw Error('Ein Ride ist im Fußwegenetz nicht erreichbar.');order.push(next);current=next.node;}}
 return {...this.assemble(start,order,false),strategy:'nearest'};}
 assemble(start,stops,exact=true){let last=start,total=0;const legs=[];for(const s of stops){const l=this.leg(last,s.node);legs.push({...l,id:s.id});total+=l.distance;last=s.node;}return{order:stops.map(s=>s.id),distance:total,exact,legs};}
 toilet(start,next){let best=null,score=Infinity;for(const wc of this.data.toilets){const a=this.tree(start).ds[wc.node],b=next?this.tree(wc.node).ds[next.node]:0;const v=next?a+b:a;if(Number.isFinite(v)&&v<score){score=v;best=wc;}}if(!best)throw Error('Keine erreichbare Toilette gefunden.');return best;}
}
root.RouteCore={Router,distance};if(typeof module!=='undefined')module.exports=root.RouteCore;
})(typeof self!=='undefined'?self:globalThis);