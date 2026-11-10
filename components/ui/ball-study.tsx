"use client";

import { useMemo, type CSSProperties } from "react";

export type BallStudyProps = {
  mode?: "dark" | "light";
  scale?: number;
  opacity?: number;
  hue?: number;
  saturation?: number;
  brightness?: number;
  className?: string;
  style?: CSSProperties;
};

const BALL_STUDY_DEFAULTS = {
  mode: "dark",
  scale: 1,
  opacity: 1,
  hue: 0,
  saturation: 1,
  brightness: 1,
} as const;

const BALL_STUDY_TITLE = "Ball";
const BALL_STUDY_INDEX = 3;

const BALL_STUDY_SOURCE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Text on a Path — Three Studies in Motion</title>
<style>
  :root{
    --bg:#0b0b0b;
    --paper:#f1f2ee;
    --paper-in:#ebece7;
    --ink:#141310;
    --gap:15px;
    --pad:12px;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    background:var(--bg);
    font-family:"Courier New",Courier,monospace;
    -webkit-font-smoothing:antialiased;
    overflow:hidden;
    -webkit-user-select:none;user-select:none;
  }
  .frame{
    height:100%;
    display:flex;
    flex-direction:column;
    padding:var(--pad);
  }
  header{
    display:flex;
    align-items:baseline;
    justify-content:space-between;
    gap:24px;
    flex:0 0 auto;
    font-size:clamp(8.9px,.883vw,14px);
    line-height:1;
    letter-spacing:.121em;
  }
  .ttl{white-space:nowrap}
  .ttl b{color:#fff;font-weight:700}
  .ttl span{color:#949494;font-weight:400;margin-left:1.35em}
  .nav{color:#8e8e8e;white-space:nowrap}
  .stage{
    flex:1 1 auto;
    min-height:0;
    padding:0 24px;
    container-type:size;
    display:flex;
    align-items:center;
    justify-content:center;
  }
  .row{display:flex;gap:var(--gap)}
  .card{
    position:relative;
    width:min(calc((100cqw - 2*var(--gap))/3), 100cqh);
    aspect-ratio:1/1;
    border-radius:3.7%;
    overflow:hidden;
    container-type:inline-size;
    background:
      radial-gradient(ellipse 74% 74% at 50% 50%, var(--paper-in) 0%, var(--paper-in) 34%, var(--paper) 92%);
    isolation:isolate;
  }
  .card figcaption{
    position:absolute;
    top:4.05%;left:4.3%;
    font-size:2.92cqw;
    font-weight:700;
    letter-spacing:0;
    color:#12110e;
    z-index:2;
    pointer-events:none;
    white-space:nowrap;
  }
  canvas{
    position:absolute;inset:0;width:100%;height:100%;display:block;
    cursor:crosshair;touch-action:none;
  }
  @media (max-width:820px){
    :root{--gap:12px}
    .stage{padding:0;overflow-y:auto;align-items:flex-start}
    .row{flex-direction:column;padding:2px 0 14px}
    .card{width:min(100cqw, 76cqh)}
  }
  @media (max-width:700px){ .nav{display:none} }
</style>
</head>
<body>
<div class="frame">
  <header>
    <div class="ttl"><b>TEXT ON A PATH</b><span>— THREE STUDIES IN MOTION</span></div>
    <div class="nav">WRITE · RIPPLE · ROLL</div>
  </header>

  <div class="stage">
    <div class="row">
      <figure class="card" id="c-write"><figcaption>03 / SKYWRITING</figcaption><canvas id="write"></canvas></figure>
      <figure class="card" id="c-ripple"><figcaption>04 / RIPPLE</figcaption><canvas id="ripple"></canvas></figure>
      <figure class="card" id="c-ball"><figcaption>05 / BALL</figcaption><canvas id="ball"></canvas></figure>
    </div>
  </div>
</div>

<script>
(function(){
  "use strict";

  var MONO = '"Courier New", Courier, monospace';
  var INK  = '20,19,16';

  function rng(seed){
    var s = seed >>> 0;
    return function(){
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5;  s >>>= 0;
      return s / 4294967296;
    };
  }

  function Surface(canvas){
    this.el = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0; this.h = 0; this.dpr = 1;
    this.resize();
  }
  Surface.prototype.resize = function(){
    var r = this.el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (w === this.el.width && h === this.el.height && this.w === r.width) return false;
    this.el.width = w; this.el.height = h;
    this.w = r.width; this.h = r.height; this.dpr = dpr;
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    return true;
  };

  function local(canvas, e){
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  var Write = (function(){
    var cv = document.getElementById('write');
    var s  = new Surface(cv);
    var PHRASE = "thepathfollowsyourhandwhereveritgoeswritinglight";
    var MAX_AGE = 2200;
    var glyphs = [];
    var idx = 0, acc = 0, last = null, inside = false;
    var hint = 0;

    function metrics(){
      var k = s.w;
      var fs = k*0.0290;
      return { fs: fs, sp: fs*0.55 };
    }

    function emit(x, y, now){
      var m = metrics();
      if (!last){ last = {x:x,y:y}; return; }
      var dx = x-last.x, dy = y-last.y, d = Math.sqrt(dx*dx+dy*dy);
      if (d < 0.001) return;
      var ang = Math.atan2(dy, dx);
      var t = 0, rem = d;
      while (acc + rem >= m.sp){
        var need = m.sp - acc;
        t += need; rem -= need; acc = 0;
        var f = t/d;
        glyphs.push({
          x: last.x + dx*f,
          y: last.y + dy*f,
          a: ang,
          c: PHRASE.charAt(idx % PHRASE.length),
          t: now
        });
        idx++;
      }
      acc += rem;
      last = {x:x, y:y};
    }

    cv.addEventListener('pointerenter', function(){ inside = true; last = null; acc = 0; });
    cv.addEventListener('pointerleave', function(){ inside = false; last = null; });
    cv.addEventListener('pointermove', function(e){
      var p = local(cv, e);
      inside = true;
      emit(p.x, p.y, performance.now());
    });

    function draw(now, dt){
      var ctx = s.ctx, m = metrics();
      ctx.clearRect(0,0,s.w,s.h);

      while (glyphs.length && now - glyphs[0].t > MAX_AGE) glyphs.shift();
      if (glyphs.length > 900) glyphs.splice(0, glyphs.length - 900);

      ctx.font = m.fs.toFixed(2) + 'px ' + MONO;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (var i=0;i<glyphs.length;i++){
        var g = glyphs[i];
        var k = 1 - (now - g.t)/MAX_AGE;
        if (k <= 0) continue;
        var a = Math.pow(Math.min(1, k*1.9), 1.25);
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.a);
        ctx.fillStyle = 'rgba(' + INK + ',' + a.toFixed(3) + ')';
        ctx.fillText(g.c, 0, 0);
        ctx.restore();
      }

      var want = (!inside && glyphs.length === 0) ? 1 : 0;
      hint += (want - hint) * Math.min(1, dt/260);
      if (hint > 0.004){
        ctx.save();
        ctx.font = (s.w*0.0268).toFixed(2) + 'px ' + MONO;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(' + INK + ',' + (hint*0.86).toFixed(3) + ')';
        ctx.fillText('move the cursor here', s.w/2, s.h/2);
        ctx.restore();
      }
    }

    return { s:s, draw:draw, reset:function(){ glyphs.length = 0; last = null; } };
  })();

  var Ripple = (function(){
    var cv = document.getElementById('ripple');
    var s  = new Surface(cv);
    var N  = 24;
    var CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789=?#§¶??×÷%@&*/<>+-$¥£~^|:;.,()[]{}";
    var plate = [];
    (function(){
      var r = rng(20260809);
      for (var i=0;i<N*N;i++) plate.push(CHARS.charAt(Math.floor(r()*CHARS.length)));
    })();

    var rings = [];
    var LIFE  = 1250;

    cv.addEventListener('pointerdown', function(e){
      var p = local(cv, e);
      rings.push({ x:p.x, y:p.y, t:performance.now() });
      if (rings.length > 8) rings.shift();
    });

    function draw(now){
      var ctx = s.ctx;
      ctx.clearRect(0,0,s.w,s.h);

      var cell = s.w * 0.02860;
      var fs   = cell * 1.10;
      var x0   = s.w/2 - cell*(N-1)/2;
      var y0   = s.h/2 - cell*(N-1)/2;

      while (rings.length && now - rings[0].t > LIFE) rings.shift();

      var speed = s.w * 1.20;
      var band  = cell * 2.45;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = fs.toFixed(2) + 'px ' + MONO;
      ctx.lineJoin = 'round';

      for (var gy=0; gy<N; gy++){
        var py = y0 + gy*cell;
        for (var gx=0; gx<N; gx++){
          var px = x0 + gx*cell;
          var v = 0;
          for (var k=0;k<rings.length;k++){
            var R = rings[k];
            var age = (now - R.t)/1000;
            if (age < 0) continue;
            var rad = speed*age;
            var dx = px - R.x, dy = py - R.y;
            var d  = Math.sqrt(dx*dx+dy*dy);
            var q  = (d - rad)/band;
            if (q > 2.4 || q < -3.8) continue;
            if (q < 0) q *= 0.62;
            var env = Math.max(0, 1 - age/(LIFE/1000));
            v += Math.exp(-q*q) * Math.pow(env, 1.15);
          }
          if (v > 1) v = 1;

          var a = 0.82 + v*0.18;
          var col = 'rgba(' + INK + ',' + a.toFixed(3) + ')';
          var ch = plate[gy*N+gx];
          ctx.fillStyle = col;
          ctx.fillText(ch, px, py);
          if (v > 0.03){
            ctx.strokeStyle = col;
            ctx.lineWidth = fs * v * 0.105;
            ctx.strokeText(ch, px, py);
          }
        }
      }
    }

    return { s:s, draw:draw, reset:function(){ rings.length = 0; } };
  })();

  var Ball = (function(){
    var cv = document.getElementById('ball');
    var s  = new Surface(cv);
    var CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789=?#§¶??×÷%@&*/<>+-$¥£??G????T???SF?Oaß?de????µ?pst?f???«»‹›";
    var N = 1900;
    var pts = [];
    (function(){
      var r = rng(77712345);
      for (var i=0;i<N;i++){
        var y = 1 - 2*r();
        var rad = Math.sqrt(Math.max(0, 1 - y*y));
        var th = r() * Math.PI * 2;
        pts.push({
          x: Math.cos(th)*rad, y: y, z: Math.sin(th)*rad,
          c: CHARS.charAt(Math.floor(r()*CHARS.length)),
          back: 0
        });
      }
    })();

    var spin = 0, vel = 0.17, hover = false;
    var TILT = 0.17, ct = Math.cos(TILT), st = Math.sin(TILT);
    var parts = [];
    var proj = new Float32Array(N*4);
    var RR = 0.3065, FS = 0.0265, CYOFF = 0.046;

    cv.addEventListener('pointerenter', function(){ hover = true; });
    cv.addEventListener('pointerleave', function(){ hover = false; });

    cv.addEventListener('pointerdown', function(e){
      var p = local(cv, e);
      var fs = s.w*FS;
      var now = performance.now();
      var hitR = s.w*0.055, hit = hitR*hitR;
      for (var i=0;i<N;i++){
        if (pts[i].back > now) continue;
        if (proj[i*4+3] < 0.72) continue;
        var dx = proj[i*4] - p.x, dy = proj[i*4+1] - p.y;
        if (dx*dx + dy*dy > hit) continue;
        var d = Math.sqrt(dx*dx+dy*dy) || 1;
        pts[i].back = now + 1500 + Math.random()*260;
        parts.push({
          x: proj[i*4], y: proj[i*4+1],
          vx: (dx/d)*s.w*(0.10 + Math.random()*0.16) + (Math.random()-0.5)*s.w*0.05,
          vy: (dy/d)*s.w*0.08 - s.w*(0.04 + Math.random()*0.10),
          rot: 0, vr: (Math.random()-0.5)*5.5,
          size: fs*(0.85 + 0.15*proj[i*4+2]),
          c: pts[i].c,
          t: now, life: 2100
        });
      }
      if (parts.length > 420) parts.splice(0, parts.length - 420);
    });

    function draw(now, dt){
      var ctx = s.ctx;
      ctx.clearRect(0,0,s.w,s.h);

      var target = hover ? 0.62 : 0.17;
      vel += (target - vel) * Math.min(1, dt/300);
      spin += vel * dt/1000;

      var cx = s.w/2, cy = s.h/2 + s.w*CYOFF;
      var R  = s.w*RR;
      var fs = s.w*FS;
      var cs = Math.cos(spin), sn = Math.sin(spin);

      var order = [];
      for (var i=0;i<N;i++){
        var p = pts[i];
        var x1 =  p.x*cs - p.z*sn;
        var z1 =  p.x*sn + p.z*cs;
        var y2 =  p.y*ct - z1*st;
        var z2 =  p.y*st + z1*ct;
        var d  = (z2 + 1) * 0.5;
        var sc = 0.10 + 0.90*Math.pow(d, 1.8);
        var px = cx + x1*R;
        var py = cy + y2*R;
        proj[i*4] = px; proj[i*4+1] = py; proj[i*4+2] = sc; proj[i*4+3] = d;
        if (p.back > now) continue;
        order.push(i);
      }
      order.sort(function(a,b){ return proj[a*4+3] - proj[b*4+3]; });

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      var lastFont = '';
      for (var k=0;k<order.length;k++){
        var j = order[k];
        var z2b = proj[j*4+3], scb = proj[j*4+2];
        var a = 0.55 + 0.45*Math.pow(z2b, 1.10);
        var grow = pts[j].back ? Math.min(1, (now - pts[j].back)/420) : 1;
        if (grow < 1) a *= grow;
        var f = 'bold ' + (Math.round(fs*scb*4)/4) + 'px ' + MONO;
        if (f !== lastFont){ ctx.font = f; lastFont = f; }
        ctx.fillStyle = 'rgba(' + INK + ',' + a.toFixed(3) + ')';
        ctx.fillText(pts[j].c, proj[j*4], proj[j*4+1]);
      }

      var g = s.w*0.80;
      for (var m=parts.length-1; m>=0; m--){
        var q = parts[m];
        var age = now - q.t;
        if (age > q.life || q.y > s.h + 40){ parts.splice(m,1); continue; }
        q.vy += g * dt/1000;
        q.x  += q.vx * dt/1000;
        q.y  += q.vy * dt/1000;
        q.rot += q.vr * dt/1000;
        var af = Math.max(0, 1 - age/q.life);
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.font = 'bold ' + q.size.toFixed(2) + 'px ' + MONO;
        ctx.fillStyle = 'rgba(' + INK + ',' + (0.95*Math.pow(af,0.5)).toFixed(3) + ')';
        ctx.fillText(q.c, 0, 0);
        ctx.restore();
      }
    }

    return { s:s, draw:draw, reset:function(){ parts.length = 0; } };
  })();

  var studies = [Write, Ripple, Ball];
  var prev = performance.now();

  function frame(now){
    var dt = Math.min(64, now - prev); prev = now;
    for (var i=0;i<studies.length;i++) studies[i].draw(now, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function onResize(){
    for (var i=0;i<studies.length;i++){
      if (studies[i].s.resize() && studies[i].reset) studies[i].reset();
    }
  }
  window.addEventListener('resize', onResize);
  if (window.ResizeObserver){
    var ro = new ResizeObserver(onResize);
    ro.observe(document.querySelector('.stage'));
  }
  onResize();
})();
</script>
</body>
</html>
`;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function focusStyles(mode: "dark" | "light") {
  const selected = BALL_STUDY_INDEX;
  const surface = mode === "light" ? "#f3f5f8" : "#08090a";
  const themeStyles =
    mode === "light"
      ? `
      :root {
        color-scheme: light;
        --bg: #f3f5f8;
        --line: rgba(20, 24, 32, .055);
        --line-strong: rgba(20, 24, 32, .10);
        --fig: rgba(20, 24, 32, .42);
        --title: #171922;
        --copy: rgba(20, 24, 32, .62);
      }
    `
      : ":root { color-scheme: dark; }";
  const cardPresentationStyles = `
      .stage, .row {
        background: ${surface} !important;
        overflow: visible !important;
      }
      .card:nth-child(${selected}) {
        width: 100% !important;
        height: 100% !important;
        aspect-ratio: auto !important;
        border-radius: 0 !important;
        overflow: visible !important;
        background: transparent !important;
        isolation: auto !important;
      }
    `;
  const layoutStyles = `
      .stage {
        width: 100% !important;
        height: 100% !important;
        padding: 0 !important;
        overflow: hidden !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .row {
        display: flex !important;
        width: 100% !important;
        height: 100% !important;
        padding: 0 !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .card { display: none !important; }
      .card:nth-child(${selected}) {
        display: block !important;
      }
      .card figcaption { display: none !important; }
      ${cardPresentationStyles}
    `;

  return `<style id="threeui-study-focus">
    ${themeStyles}
    html, body, .frame {
      width: 100% !important;
      height: 100% !important;
      overflow: hidden !important;
    }
    body { margin: 0 !important; background: ${surface} !important; }
    .frame { padding: 0 !important; background: ${surface} !important; }
    header { display: none !important; }
    ${layoutStyles}
  </style>`;
}

const AUTHORED_CARD_INK = "var INK  = '20,19,16';";

function replaceRequired(source: string, authored: string, focused: string) {
  if (!source.includes(authored)) {
    throw new Error(`Ball study source adapter could not find: ${authored}`);
  }
  return source.replace(authored, focused);
}

function framelessCardSource(source: string, mode: "dark" | "light") {
  const replacements: [string, string][] = [
    [
      AUTHORED_CARD_INK,
      mode === "light" ? AUTHORED_CARD_INK : "var INK  = '238,240,244';",
    ],
    [
      "      var cell = s.w * 0.02860;\n      var fs   = cell * 1.10;",
      "      var size = Math.min(s.w, s.h);\n      var cell = size * 0.02860;\n      var fs   = cell * 1.10;",
    ],
    ["      var speed = s.w * 1.20;", "      var speed = size * 1.20;"],
    [
      "      var fs = s.w*FS;\n      var now = performance.now();\n      var hitR = s.w*0.055, hit = hitR*hitR;",
      "      var size = Math.min(s.w, s.h);\n      var fs = size*FS;\n      var now = performance.now();\n      var hitR = size*0.055, hit = hitR*hitR;",
    ],
    [
      "          vx: (dx/d)*s.w*(0.10 + Math.random()*0.16) + (Math.random()-0.5)*s.w*0.05,\n          vy: (dy/d)*s.w*0.08 - s.w*(0.04 + Math.random()*0.10),",
      "          vx: (dx/d)*size*(0.10 + Math.random()*0.16) + (Math.random()-0.5)*size*0.05,\n          vy: (dy/d)*size*0.08 - size*(0.04 + Math.random()*0.10),",
    ],
    [
      "      var cx = s.w/2, cy = s.h/2 + s.w*CYOFF;\n      var R  = s.w*RR;\n      var fs = s.w*FS;",
      "      var size = Math.min(s.w, s.h);\n      var cx = s.w/2, cy = s.h/2 + size*CYOFF;\n      var R  = size*RR;\n      var fs = size*FS;",
    ],
    ["      var g = s.w*0.80;", "      var g = size*0.80;"],
  ];

  return replacements.reduce(
    (adapted, [authored, focused]) =>
      replaceRequired(adapted, authored, focused),
    source,
  );
}

function focusedDocument(mode: "dark" | "light") {
  const presentedSource = framelessCardSource(BALL_STUDY_SOURCE, mode);

  return presentedSource
    .replace(
      /<title>[\s\S]*?<\/title>/i,
      `<title>${BALL_STUDY_TITLE} — ThreeUI</title>`,
    )
    .replace("</head>", `${focusStyles(mode)}\n</head>`);
}

export default function BallStudy({
  mode = BALL_STUDY_DEFAULTS.mode,
  scale = BALL_STUDY_DEFAULTS.scale,
  opacity = BALL_STUDY_DEFAULTS.opacity,
  hue = BALL_STUDY_DEFAULTS.hue,
  saturation = BALL_STUDY_DEFAULTS.saturation,
  brightness = BALL_STUDY_DEFAULTS.brightness,
  className,
  style,
}: BallStudyProps) {
  const safeMode = mode === "light" ? "light" : "dark";
  const document = useMemo(() => focusedDocument(safeMode), [safeMode]);
  const boundedScale = clamp(scale, 0.65, 1.5);
  const boundedOpacity = clamp(opacity, 0.1, 1);
  const boundedHue = clamp(hue, -180, 180);
  const boundedSaturation = clamp(saturation, 0, 2);
  const boundedBrightness = clamp(brightness, 0.4, 1.8);
  const filter =
    boundedHue === 0 && boundedSaturation === 1 && boundedBrightness === 1
      ? undefined
      : `hue-rotate(${boundedHue}deg) saturate(${boundedSaturation}) brightness(${boundedBrightness})`;

  return (
    <div
      className={["text-path-study", `text-path-study--${safeMode}`, className]
        .filter(Boolean)
        .join(" ")}
      data-mode={safeMode}
      style={{
        width: "100%",
        height: "100%",
        opacity: boundedOpacity,
        filter,
        ...style,
      }}
    >
      <iframe
        className="text-path-study-frame"
        data-mode={safeMode}
        title="Ball interactive canvas study"
        sandbox="allow-scripts"
        srcDoc={document}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          transform: boundedScale === 1 ? undefined : `scale(${boundedScale})`,
        }}
      />
    </div>
  );
}
