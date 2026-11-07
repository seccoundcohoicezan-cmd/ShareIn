// Fixed decorative layer: 3 colour blobs + 6 brand assets (play tile, gift, upload arrow, link,
// sparkle, coin) parked at the screen edges so they never sit under the reading column on desktop
// and only peek in on mobile. Motion is CSS scroll-driven (transform only, each asset at its own
// depth); the inline script disables motion on weak devices and adds a rAF fallback where needed.
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
        <svg className="asset a-play" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="bg-play" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#A855F7" />
              <stop offset=".55" stopColor="#6C2BD9" />
              <stop offset="1" stopColor="#F97316" />
            </linearGradient>
          </defs>
          <rect x="6" y="6" width="88" height="88" rx="26" fill="url(#bg-play)" />
          <path d="M40 31v38l31-19z" fill="#fff" />
        </svg>
        <svg className="asset a-gift" viewBox="0 0 64 64">
          <rect x="8" y="26" width="48" height="32" rx="5" fill="#FBBF24" />
          <rect x="5" y="18" width="54" height="12" rx="4" fill="#F97316" />
          <rect x="28" y="18" width="8" height="40" fill="#6C2BD9" />
          <path d="M32 18c-3-7-8-11-13-10-4 1-5 6-1 8 4 2 10 2 14 2Zm0 0c3-7 8-11 13-10 4 1 5 6 1 8-4 2-10 2-14 2Z" fill="#A855F7" />
        </svg>
        <svg className="asset a-up" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill="#F97316" />
          <path d="M32 46V19M20 30l12-12 12 12" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg className="asset a-link" viewBox="0 0 64 64">
          <rect x="4" y="4" width="56" height="56" rx="18" fill="#fff" />
          <path d="M27 37a8 8 0 0 0 11 0l7-7a8 8 0 0 0-11-11l-2 2M37 27a8 8 0 0 0-11 0l-7 7a8 8 0 0 0 11 11l2-2" fill="none" stroke="#6C2BD9" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <svg className="asset a-spark" viewBox="0 0 64 64">
          <path d="M32 4c2 14 7 21 28 28-21 7-26 14-28 28-2-14-7-21-28-28C25 25 30 18 32 4Z" fill="#FBBF24" />
        </svg>
        <svg className="asset a-coin" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="29" fill="#FBBF24" stroke="#F97316" strokeWidth="5" />
          <text x="32" y="40" textAnchor="middle" fontSize="22" fontWeight="800" fill="#2A0F5C" fontFamily="system-ui, sans-serif">Rp</text>
        </svg>
      </div>
      <script dangerouslySetInnerHTML={{ __html: gate }} />
    </>
  )
}
