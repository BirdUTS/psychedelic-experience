/* Pure simulation components, shared by the browser and Node tests. */
(function(root){
'use strict';
class LifeGrid {
  constructor(size=72){this.size=size;this.cells=new Uint8Array(size*size);this.next=new Uint8Array(size*size);this.age=new Uint16Array(size*size);this.generation=0;}
  seed(random=Math.random){for(let i=0;i<this.cells.length;i++){this.cells[i]=random()<.29?1:0;this.age[i]=this.cells[i];}this.generation=0;}
  step(){const n=this.size;for(let y=0;y<n;y++)for(let x=0;x<n;x++){let count=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)count+=this.cells[((y+dy+n)%n)*n+(x+dx+n)%n];const i=y*n+x;this.next[i]=Number(count===3||(this.cells[i]&&count===2));}
    [this.cells,this.next]=[this.next,this.cells];for(let i=0;i<this.cells.length;i++)this.age[i]=this.cells[i]?Math.min(65535,this.age[i]+1):0;this.generation++;
  }
}
class ReactiveDirector {
  constructor(){this.clock=0;this.elapsed=0;this.average=0;this.previous=0;this.cooldown=0;this.pulse=0;this.level=0;this.high=0;this.hue=0;this.rate=1;this.angle=0;this.zoom=1;this.beats=0;}
  update(dt,a,intensity=1,auto=true){this.clock+=dt;this.elapsed+=dt;this.cooldown=Math.max(0,this.cooldown-dt);const level=Math.min(1,Math.max(0,a.bass*.6+a.mid*.3+a.treble*.1));const onset=a.bass-this.previous;
    const beat=a.active&&a.bass>.09&&onset>.025&&level>this.average*1.15&&this.cooldown===0;
    this.previous=a.bass;this.average+=(level-this.average)*(1-Math.exp(-dt*1.2));if(beat){this.pulse=1;this.cooldown=.3;this.beats++;}else this.pulse*=Math.exp(-dt*4);
    const blend=1-Math.exp(-dt*4);this.level+=(level-this.level)*blend;this.high+=(a.treble-this.high)*blend;
    this.rate=1+intensity*(this.level*2.8+this.pulse*.8);this.angle+=dt*intensity*(.09+this.level*.45);this.hue+=dt*(3+intensity*(this.level*24+this.high*28));this.zoom=1+intensity*(.24*Math.sin(this.clock*.37)+this.level*.42+this.pulse*.08);
    let next=null;if(auto&&this.elapsed>12&&((beat&&this.elapsed>16)||this.elapsed>26)){next=a.active?(this.high>.28?2:this.level>.4?3:this.level>.18?0:4):null;this.elapsed=0;}
    return {beat,next,switchDue:auto&&this.elapsed===0};
  }
}
root.ExtraDynamics={LifeGrid,ReactiveDirector};if(typeof module!=='undefined')module.exports=root.ExtraDynamics;
})(typeof globalThis!=='undefined'?globalThis:this);
