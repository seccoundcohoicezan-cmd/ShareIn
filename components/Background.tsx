// Fixed decorative layer: 1 container + 3 blobs = 4 DOM nodes. Motion is CSS scroll-driven;
// the inline script only disables motion on weak devices and adds a rAF fallback where needed.
const gate = `(function(){try{var d=document.documentElement,n=navigator,c=n.connection;
if(matchMedia('(prefers-reduced-motion: reduce)').matches||(c&&c.saveData)||(n.deviceMemory&&n.deviceMemory<=4)){d.dataset.motion='off';return}
if(window.CSS&&CSS.supports('animation-timeline: scroll()'))return;
var bg=document.getElementById('bg');if(!bg)return;bg.setAttribute('data-fallback','');
var t=0,slow=0,last=0;function f(ts){t=0;if(last&&ts-last>50){if(++slow>8){bg.removeAttribute('data-fallback');removeEventListener('scroll',s);return}}else slow=0;last=ts;
var h=d.scrollHeight-innerHeight;bg.style.setProperty('--p',h>0?Math.min(1,scrollY/h).toFixed(3):'0')}
function s(){if(!t){last=0;t=requestAnimationFrame(f)}}addEventListener('scroll',s,{passive:true});s()}catch(e){}})()`

export function Background() {
  return (
    <>
      <div id="bg" className="bg" aria-hidden="true">
        <i className="blob b1" />
        <i className="blob b2" />
        <i className="blob b3" />
      </div>
      <script dangerouslySetInnerHTML={{ __html: gate }} />
    </>
  )
}
