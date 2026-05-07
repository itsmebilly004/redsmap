import { s as size, e as equalSizes, t as tryCreateCanvasRenderingTarget2D, b as bindTo } from "./fancy-canvas.mjs";
const e = { title: "", visible: true, hitTestTolerance: 3, lastValueVisible: true, priceLineVisible: true, priceLineSource: 0, priceLineWidth: 1, priceLineColor: "", priceLineStyle: 2, baseLineVisible: true, baseLineWidth: 1, baseLineColor: "#B2B5BE", baseLineStyle: 0, priceFormat: { type: "price", precision: 2, minMove: 0.01 } };
var r, h;
function a(t, i) {
  const n = (function(t2, i2) {
    switch (t2) {
      case 0:
      default:
        return [];
      case 1:
        return [i2, i2];
      case 2:
        return [2 * i2, 2 * i2];
      case 3:
        return [6 * i2, 6 * i2];
      case 4:
        return [i2, 4 * i2];
    }
  })(i, t.lineWidth);
  return t.setLineDash(n), n;
}
function l(t, i, n, s) {
  t.beginPath();
  const e2 = t.lineWidth % 2 ? 0.5 : 0;
  t.moveTo(n, i + e2), t.lineTo(s, i + e2), t.stroke();
}
function o(t, i) {
  if (!t) throw new Error("Assertion failed" + (i ? ": " + i : ""));
}
function _(t) {
  if (void 0 === t) throw new Error("Value is undefined");
  return t;
}
function u(t) {
  if (null === t) throw new Error("Value is null");
  return t;
}
function c(t) {
  return u(_(t));
}
!(function(t) {
  t[t.Simple = 0] = "Simple", t[t.WithSteps = 1] = "WithSteps", t[t.Curved = 2] = "Curved";
})(r || (r = {})), (function(t) {
  t[t.Solid = 0] = "Solid", t[t.Dotted = 1] = "Dotted", t[t.Dashed = 2] = "Dashed", t[t.LargeDashed = 3] = "LargeDashed", t[t.SparseDotted = 4] = "SparseDotted";
})(h || (h = {}));
class d {
  constructor() {
    this.t = [];
  }
  i(t, i, n) {
    const s = { h: t, l: i, o: true === n };
    this.t.push(s);
  }
  _(t) {
    const i = this.t.findIndex(((i2) => t === i2.h));
    i > -1 && this.t.splice(i, 1);
  }
  u(t) {
    this.t = this.t.filter(((i) => i.l !== t));
  }
  p(t, i, n) {
    const s = [...this.t];
    this.t = this.t.filter(((t2) => !t2.o)), s.forEach(((s2) => s2.h(t, i, n)));
  }
  v() {
    return this.t.length > 0;
  }
  m() {
    this.t = [];
  }
}
function f(t, ...i) {
  for (const n of i) for (const i2 in n) void 0 !== n[i2] && Object.prototype.hasOwnProperty.call(n, i2) && !["__proto__", "constructor", "prototype"].includes(i2) && ("object" != typeof n[i2] || void 0 === t[i2] || Array.isArray(n[i2]) ? t[i2] = n[i2] : f(t[i2], n[i2]));
  return t;
}
function p(t) {
  return "number" == typeof t && isFinite(t);
}
function v(t) {
  return "number" == typeof t && t % 1 == 0;
}
function m(t) {
  return "string" == typeof t;
}
function w(t) {
  return "boolean" == typeof t;
}
function M(t) {
  const i = t;
  if (!i || "object" != typeof i) return i;
  let n, s, e2;
  for (s in n = Array.isArray(i) ? [] : {}, i) i.hasOwnProperty(s) && (e2 = i[s], n[s] = e2 && "object" == typeof e2 ? M(e2) : e2);
  return n;
}
function g(t) {
  return null !== t;
}
function b(t) {
  return null === t ? void 0 : t;
}
const S = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
function x(t, i, n) {
  return void 0 === i && (i = S), `${n = void 0 !== n ? `${n} ` : ""}${t}px ${i}`;
}
class C {
  constructor(t) {
    this.M = { S: 1, C: 5, k: NaN, P: "", T: "", R: "", D: "", I: 0, V: 0, B: 0, A: 0, L: 0 }, this.O = t;
  }
  N() {
    const t = this.M, i = this.F(), n = this.W();
    return t.k === i && t.T === n || (t.k = i, t.T = n, t.P = x(i, n), t.A = 2.5 / 12 * i, t.I = t.A, t.V = i / 12 * t.C, t.B = i / 12 * t.C, t.L = 0), t.R = this.H(), t.D = this.U(), this.M;
  }
  H() {
    return this.O.N().layout.textColor;
  }
  U() {
    return this.O.$();
  }
  F() {
    return this.O.N().layout.fontSize;
  }
  W() {
    return this.O.N().layout.fontFamily;
  }
}
function y(t) {
  return t < 0 ? 0 : t > 255 ? 255 : Math.round(t) || 0;
}
function k(t) {
  return 0.199 * t[0] + 0.687 * t[1] + 0.114 * t[2];
}
class P {
  constructor(t, i) {
    this.j = /* @__PURE__ */ new Map(), this.q = t, i && (this.j = i);
  }
  Y(t, i) {
    if ("transparent" === t) return t;
    const n = this.K(t), s = n[3];
    return `rgba(${n[0]}, ${n[1]}, ${n[2]}, ${i * s})`;
  }
  Z(t) {
    const i = this.K(t);
    return { G: `rgb(${i[0]}, ${i[1]}, ${i[2]})`, X: k(i) > 160 ? "black" : "white" };
  }
  J(t) {
    return k(this.K(t));
  }
  tt(t, i, n) {
    const [s, e2, r2, h2] = this.K(t), [a2, l2, o2, _2] = this.K(i), u2 = [y(s + n * (a2 - s)), y(e2 + n * (l2 - e2)), y(r2 + n * (o2 - r2)), (c2 = h2 + n * (_2 - h2), c2 <= 0 || c2 > 1 ? Math.min(Math.max(c2, 0), 1) : Math.round(1e4 * c2) / 1e4)];
    var c2;
    return `rgba(${u2[0]}, ${u2[1]}, ${u2[2]}, ${u2[3]})`;
  }
  K(t) {
    const i = this.j.get(t);
    if (i) return i;
    const n = (function(t2) {
      const i2 = document.createElement("div");
      i2.style.display = "none", document.body.appendChild(i2), i2.style.color = t2;
      const n2 = window.getComputedStyle(i2).color;
      return document.body.removeChild(i2), n2;
    })(t), s = n.match(/^rgba?\s*\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*\.?\d+))?\)$/);
    if (!s) {
      if (this.q.length) for (const i2 of this.q) {
        const n2 = i2(t);
        if (n2) return this.j.set(t, n2), n2;
      }
      throw new Error(`Failed to parse color: ${t}`);
    }
    const e2 = [parseInt(s[1], 10), parseInt(s[2], 10), parseInt(s[3], 10), s[4] ? parseFloat(s[4]) : 1];
    return this.j.set(t, e2), e2;
  }
}
class T {
  constructor() {
    this.it = [];
  }
  nt(t) {
    this.it = t;
  }
  st(t, i, n) {
    this.it.forEach(((s) => {
      s.st(t, i, n);
    }));
  }
}
class R {
  st(t, i, n) {
    t.useBitmapCoordinateSpace(((t2) => this.et(t2, i, n)));
  }
}
class D extends R {
  constructor() {
    super(...arguments), this.rt = null;
  }
  ht(t) {
    this.rt = t;
  }
  et({ context: t, horizontalPixelRatio: i, verticalPixelRatio: n }) {
    if (null === this.rt || null === this.rt.lt) return;
    const s = this.rt.lt, e2 = this.rt, r2 = Math.max(1, Math.floor(i)) % 2 / 2, h2 = (h3) => {
      t.beginPath();
      for (let a2 = s.to - 1; a2 >= s.from; --a2) {
        const s2 = e2.ot[a2], l2 = Math.round(s2._t * i) + r2, o2 = s2.ut * n, _2 = h3 * n + r2;
        t.moveTo(l2, o2), t.arc(l2, o2, _2, 0, 2 * Math.PI);
      }
      t.fill();
    };
    e2.ct > 0 && (t.fillStyle = e2.dt, h2(e2.ft + e2.ct)), t.fillStyle = e2.vt, h2(e2.ft);
  }
}
function I() {
  return { ot: [{ _t: 0, ut: 0, wt: 0, Mt: 0 }], vt: "", dt: "", ft: 0, ct: 0, lt: null };
}
const V = { from: 0, to: 1 };
class B {
  constructor(t, i, n) {
    this.gt = new T(), this.bt = [], this.St = [], this.xt = true, this.O = t, this.Ct = i, this.yt = n, this.gt.nt(this.bt);
  }
  kt(t) {
    this.Pt(), this.xt = true;
  }
  Tt() {
    return this.xt && (this.Rt(), this.xt = false), this.gt;
  }
  Pt() {
    const t = this.yt.Dt();
    t.length !== this.bt.length && (this.St = t.map(I), this.bt = this.St.map(((t2) => {
      const i = new D();
      return i.ht(t2), i;
    })), this.gt.nt(this.bt));
  }
  Rt() {
    const t = 2 === this.Ct.N().mode || !this.Ct.It(), i = this.yt.Vt(), n = this.Ct.Bt(), s = this.O.Et();
    this.Pt(), i.forEach(((i2, e2) => {
      const r2 = this.St[e2], h2 = i2.At(n), a2 = i2.Lt();
      !t && null !== h2 && i2.It() && null !== a2 ? (r2.vt = h2.zt, r2.ft = h2.ft, r2.ct = h2.Ot, r2.ot[0].Mt = h2.Mt, r2.ot[0].ut = i2.Ft().Nt(h2.Mt, a2.Wt), r2.dt = h2.Ht ?? this.O.Ut(r2.ot[0].ut / i2.Ft().$t()), r2.ot[0].wt = n, r2.ot[0]._t = s.jt(n), r2.lt = V) : r2.lt = null;
    }));
  }
}
class E extends R {
  constructor(t) {
    super(), this.qt = t;
  }
  et({ context: t, bitmapSize: i, horizontalPixelRatio: n, verticalPixelRatio: s }) {
    if (null === this.qt) return;
    const e2 = this.qt.Yt.It, r2 = this.qt.Kt.It;
    if (!e2 && !r2) return;
    const h2 = Math.round(this.qt._t * n), o2 = Math.round(this.qt.ut * s);
    t.lineCap = "butt", e2 && h2 >= 0 && (t.lineWidth = Math.floor(this.qt.Yt.ct * n), t.strokeStyle = this.qt.Yt.R, t.fillStyle = this.qt.Yt.R, a(t, this.qt.Yt.Zt), (function(t2, i2, n2, s2) {
      t2.beginPath();
      const e3 = t2.lineWidth % 2 ? 0.5 : 0;
      t2.moveTo(i2 + e3, n2), t2.lineTo(i2 + e3, s2), t2.stroke();
    })(t, h2, 0, i.height)), r2 && o2 >= 0 && (t.lineWidth = Math.floor(this.qt.Kt.ct * s), t.strokeStyle = this.qt.Kt.R, t.fillStyle = this.qt.Kt.R, a(t, this.qt.Kt.Zt), l(t, o2, 0, i.width));
  }
}
class A {
  constructor(t, i) {
    this.xt = true, this.Gt = { Yt: { ct: 1, Zt: 0, R: "", It: false }, Kt: { ct: 1, Zt: 0, R: "", It: false }, _t: 0, ut: 0 }, this.Xt = new E(this.Gt), this.Jt = t, this.yt = i;
  }
  kt() {
    this.xt = true;
  }
  Tt(t) {
    return this.xt && (this.Rt(), this.xt = false), this.Xt;
  }
  Rt() {
    const t = this.Jt.It(), i = this.yt.Qt().N().crosshair, n = this.Gt;
    if (2 === i.mode) return n.Kt.It = false, void (n.Yt.It = false);
    n.Kt.It = t && this.Jt.ti(this.yt), n.Yt.It = t && this.Jt.ii(), n.Kt.ct = i.horzLine.width, n.Kt.Zt = i.horzLine.style, n.Kt.R = i.horzLine.color, n.Yt.ct = i.vertLine.width, n.Yt.Zt = i.vertLine.style, n.Yt.R = i.vertLine.color, n._t = this.Jt.ni(), n.ut = this.Jt.si();
  }
}
function L(t, i, n, s, e2, r2) {
  t.fillRect(i + r2, n, s - 2 * r2, r2), t.fillRect(i + r2, n + e2 - r2, s - 2 * r2, r2), t.fillRect(i, n, r2, e2), t.fillRect(i + s - r2, n, r2, e2);
}
function z(t, i, n, s, e2, r2) {
  t.save(), t.globalCompositeOperation = "copy", t.fillStyle = r2, t.fillRect(i, n, s, e2), t.restore();
}
function O(t, i, n, s, e2, r2) {
  t.beginPath(), t.roundRect ? t.roundRect(i, n, s, e2, r2) : (t.lineTo(i + s - r2[1], n), 0 !== r2[1] && t.arcTo(i + s, n, i + s, n + r2[1], r2[1]), t.lineTo(i + s, n + e2 - r2[2]), 0 !== r2[2] && t.arcTo(i + s, n + e2, i + s - r2[2], n + e2, r2[2]), t.lineTo(i + r2[3], n + e2), 0 !== r2[3] && t.arcTo(i, n + e2, i, n + e2 - r2[3], r2[3]), t.lineTo(i, n + r2[0]), 0 !== r2[0] && t.arcTo(i, n, i + r2[0], n, r2[0]));
}
function N(t, i, n, s, e2, r2, h2 = 0, a2 = [0, 0, 0, 0], l2 = "") {
  if (t.save(), !h2 || !l2 || l2 === r2) return O(t, i, n, s, e2, a2), t.fillStyle = r2, t.fill(), void t.restore();
  const o2 = h2 / 2;
  var _2;
  O(t, i + o2, n + o2, s - h2, e2 - h2, (_2 = -o2, a2.map(((t2) => 0 === t2 ? t2 : t2 + _2)))), "transparent" !== r2 && (t.fillStyle = r2, t.fill()), "transparent" !== l2 && (t.lineWidth = h2, t.strokeStyle = l2, t.closePath(), t.stroke()), t.restore();
}
function F(t, i, n, s, e2, r2, h2) {
  t.save(), t.globalCompositeOperation = "copy";
  const a2 = t.createLinearGradient(0, 0, 0, e2);
  a2.addColorStop(0, r2), a2.addColorStop(1, h2), t.fillStyle = a2, t.fillRect(i, n, s, e2), t.restore();
}
class W {
  constructor(t, i) {
    this.ht(t, i);
  }
  ht(t, i) {
    this.qt = t, this.ei = i;
  }
  $t(t, i) {
    return this.qt.It ? t.k + t.A + t.I : 0;
  }
  st(t, i, n, s) {
    if (!this.qt.It || 0 === this.qt.ri.length) return;
    const e2 = this.qt.R, r2 = this.ei.G, h2 = t.useBitmapCoordinateSpace(((t2) => {
      const h3 = t2.context;
      h3.font = i.P;
      const a2 = this.hi(t2, i, n, s), l2 = a2.ai;
      return a2.li ? N(h3, l2.oi, l2._i, l2.ui, l2.ci, r2, l2.di, [l2.ft, 0, 0, l2.ft], r2) : N(h3, l2.fi, l2._i, l2.ui, l2.ci, r2, l2.di, [0, l2.ft, l2.ft, 0], r2), this.qt.pi && (h3.fillStyle = e2, h3.fillRect(l2.fi, l2.mi, l2.wi - l2.fi, l2.Mi)), this.qt.gi && (h3.fillStyle = i.D, h3.fillRect(a2.li ? l2.bi - l2.di : 0, l2._i, l2.di, l2.Si - l2._i)), a2;
    }));
    t.useMediaCoordinateSpace((({ context: t2 }) => {
      const n2 = h2.xi;
      t2.font = i.P, t2.textAlign = h2.li ? "right" : "left", t2.textBaseline = "middle", t2.fillStyle = e2, t2.fillText(this.qt.ri, n2.Ci, (n2._i + n2.Si) / 2 + n2.yi);
    }));
  }
  hi(t, i, n, s) {
    const { context: e2, bitmapSize: r2, mediaSize: h2, horizontalPixelRatio: a2, verticalPixelRatio: l2 } = t, o2 = this.qt.pi || !this.qt.ki ? i.C : 0, _2 = this.qt.Pi ? i.S : 0, u2 = i.A + this.ei.Ti, c2 = i.I + this.ei.Ri, d2 = i.V, f2 = i.B, p2 = this.qt.ri, v2 = i.k, m2 = n.Di(e2, p2), w2 = Math.ceil(n.Ii(e2, p2)), M2 = v2 + u2 + c2, g2 = i.S + d2 + f2 + w2 + o2, b2 = Math.max(1, Math.floor(l2));
    let S2 = Math.round(M2 * l2);
    S2 % 2 != b2 % 2 && (S2 += 1);
    const x2 = _2 > 0 ? Math.max(1, Math.floor(_2 * a2)) : 0, C2 = Math.round(g2 * a2), y2 = Math.round(o2 * a2), k2 = this.ei.Vi ?? this.ei.Bi ?? this.ei.Ei, P2 = Math.round(k2 * l2) - Math.floor(0.5 * l2), T2 = Math.floor(P2 + b2 / 2 - S2 / 2), R2 = T2 + S2, D2 = "right" === s, I2 = D2 ? h2.width - _2 : _2, V2 = D2 ? r2.width - x2 : x2;
    let B2, E2, A2;
    return D2 ? (B2 = V2 - C2, E2 = V2 - y2, A2 = I2 - o2 - d2 - _2) : (B2 = V2 + C2, E2 = V2 + y2, A2 = I2 + o2 + d2), { li: D2, ai: { _i: T2, mi: P2, Si: R2, ui: C2, ci: S2, ft: 2 * a2, di: x2, oi: B2, fi: V2, wi: E2, Mi: b2, bi: r2.width }, xi: { _i: T2 / l2, Si: R2 / l2, Ci: A2, yi: m2 } };
  }
}
class H {
  constructor(t) {
    this.Ai = { Ei: 0, G: "#000", Ri: 0, Ti: 0 }, this.Li = { ri: "", It: false, pi: true, ki: false, Ht: "", R: "#FFF", gi: false, Pi: false }, this.zi = { ri: "", It: false, pi: false, ki: true, Ht: "", R: "#FFF", gi: true, Pi: true }, this.xt = true, this.Oi = new (t || W)(this.Li, this.Ai), this.Ni = new (t || W)(this.zi, this.Ai);
  }
  ri() {
    return this.Fi(), this.Li.ri;
  }
  Ei() {
    return this.Fi(), this.Ai.Ei;
  }
  kt() {
    this.xt = true;
  }
  $t(t, i = false) {
    return Math.max(this.Oi.$t(t, i), this.Ni.$t(t, i));
  }
  Wi() {
    return this.Ai.Vi ?? null;
  }
  Hi() {
    return this.Ai.Vi ?? this.Ai.Bi ?? this.Ei();
  }
  Ui(t) {
    this.Ai.Bi = t ?? void 0;
  }
  $i() {
    return this.Fi(), this.Li.It || this.zi.It;
  }
  ji() {
    return this.Fi(), this.Li.It;
  }
  Tt(t) {
    return this.Fi(), this.Li.pi = this.Li.pi && t.N().ticksVisible, this.zi.pi = this.zi.pi && t.N().ticksVisible, this.Oi.ht(this.Li, this.Ai), this.Ni.ht(this.zi, this.Ai), this.Oi;
  }
  qi() {
    return this.Fi(), this.Oi.ht(this.Li, this.Ai), this.Ni.ht(this.zi, this.Ai), this.Ni;
  }
  Fi() {
    this.xt && (this.Li.pi = true, this.zi.pi = false, this.Yi(this.Li, this.zi, this.Ai));
  }
}
class U extends H {
  constructor(t, i, n) {
    super(), this.Jt = t, this.Ki = i, this.Zi = n;
  }
  Yi(t, i, n) {
    if (t.It = false, 2 === this.Jt.N().mode) return;
    const s = this.Jt.N().horzLine;
    if (!s.labelVisible) return;
    const e2 = this.Ki.Lt();
    if (!this.Jt.It() || this.Ki.Gi() || null === e2) return;
    const r2 = this.Ki.Xi().Z(s.labelBackgroundColor);
    n.G = r2.G, t.R = r2.X;
    const h2 = 2 / 12 * this.Ki.k();
    n.Ti = h2, n.Ri = h2;
    const a2 = this.Zi(this.Ki);
    n.Ei = a2.Ei, t.ri = this.Ki.Ji(a2.Mt, e2), t.It = true;
  }
}
const $ = /[1-9]/g;
class j {
  constructor() {
    this.qt = null;
  }
  ht(t) {
    this.qt = t;
  }
  st(t, i) {
    if (null === this.qt || false === this.qt.It || 0 === this.qt.ri.length) return;
    const n = t.useMediaCoordinateSpace((({ context: t2 }) => (t2.font = i.P, Math.round(i.Qi.Ii(t2, u(this.qt).ri, $)))));
    if (n <= 0) return;
    const s = i.tn, e2 = n + 2 * s, r2 = e2 / 2, h2 = this.qt.nn;
    let a2 = this.qt.Ei, l2 = Math.floor(a2 - r2) + 0.5;
    l2 < 0 ? (a2 += Math.abs(0 - l2), l2 = Math.floor(a2 - r2) + 0.5) : l2 + e2 > h2 && (a2 -= Math.abs(h2 - (l2 + e2)), l2 = Math.floor(a2 - r2) + 0.5);
    const o2 = l2 + e2, _2 = Math.ceil(0 + i.S + i.C + i.A + i.k + i.I);
    t.useBitmapCoordinateSpace((({ context: t2, horizontalPixelRatio: n2, verticalPixelRatio: s2 }) => {
      const e3 = u(this.qt);
      t2.fillStyle = e3.G;
      const r3 = Math.round(l2 * n2), h3 = Math.round(0 * s2), a3 = Math.round(o2 * n2), c2 = Math.round(_2 * s2), d2 = Math.round(2 * n2);
      if (t2.beginPath(), t2.moveTo(r3, h3), t2.lineTo(r3, c2 - d2), t2.arcTo(r3, c2, r3 + d2, c2, d2), t2.lineTo(a3 - d2, c2), t2.arcTo(a3, c2, a3, c2 - d2, d2), t2.lineTo(a3, h3), t2.fill(), e3.pi) {
        const r4 = Math.round(e3.Ei * n2), a4 = h3, l3 = Math.round((a4 + i.C) * s2);
        t2.fillStyle = e3.R;
        const o3 = Math.max(1, Math.floor(n2)), _3 = Math.floor(0.5 * n2);
        t2.fillRect(r4 - _3, a4, o3, l3 - a4);
      }
    })), t.useMediaCoordinateSpace((({ context: t2 }) => {
      const n2 = u(this.qt), e3 = 0 + i.S + i.C + i.A + i.k / 2;
      t2.font = i.P, t2.textAlign = "left", t2.textBaseline = "middle", t2.fillStyle = n2.R;
      const r3 = i.Qi.Di(t2, "Apr0");
      t2.translate(l2 + s, e3 + r3), t2.fillText(n2.ri, 0, 0);
    }));
  }
}
class q {
  constructor(t, i, n) {
    this.xt = true, this.Xt = new j(), this.Gt = { It: false, G: "#4c525e", R: "white", ri: "", nn: 0, Ei: NaN, pi: true }, this.Ct = t, this.sn = i, this.Zi = n;
  }
  kt() {
    this.xt = true;
  }
  Tt() {
    return this.xt && (this.Rt(), this.xt = false), this.Xt.ht(this.Gt), this.Xt;
  }
  Rt() {
    const t = this.Gt;
    if (t.It = false, 2 === this.Ct.N().mode) return;
    const i = this.Ct.N().vertLine;
    if (!i.labelVisible) return;
    const n = this.sn.Et();
    if (n.Gi()) return;
    t.nn = n.nn();
    const s = this.Zi();
    if (null === s) return;
    t.Ei = s.Ei;
    const e2 = n.en(this.Ct.Bt());
    t.ri = n.rn(u(e2)), t.It = true;
    const r2 = this.sn.Xi().Z(i.labelBackgroundColor);
    t.G = r2.G, t.R = r2.X, t.pi = n.N().ticksVisible;
  }
}
class Y {
  constructor() {
    this.hn = null, this.an = 0;
  }
  ln() {
    return this.an;
  }
  _n(t) {
    this.an = t;
  }
  Ft() {
    return this.hn;
  }
  un(t) {
    this.hn = t;
  }
  cn(t) {
    return [];
  }
  dn() {
    return [];
  }
  It() {
    return true;
  }
}
var K;
!(function(t) {
  t[t.Normal = 0] = "Normal", t[t.Magnet = 1] = "Magnet", t[t.Hidden = 2] = "Hidden", t[t.MagnetOHLC = 3] = "MagnetOHLC";
})(K || (K = {}));
class Z extends Y {
  constructor(t, i) {
    super(), this.yt = null, this.fn = NaN, this.pn = 0, this.vn = false, this.mn = /* @__PURE__ */ new Map(), this.wn = false, this.Mn = /* @__PURE__ */ new WeakMap(), this.gn = /* @__PURE__ */ new WeakMap(), this.bn = NaN, this.Sn = NaN, this.xn = NaN, this.Cn = NaN, this.sn = t, this.yn = i;
    this.kn = /* @__PURE__ */ ((t2, i2) => (n2) => {
      const s = i2(), e2 = t2();
      if (n2 === u(this.yt).Pn()) return { Mt: e2, Ei: s };
      {
        const t3 = u(n2.Lt());
        return { Mt: n2.Tn(s, t3), Ei: s };
      }
    })((() => this.fn), (() => this.Sn));
    const n = /* @__PURE__ */ ((t2, i2) => () => {
      const n2 = this.sn.Et().Rn(t2()), s = i2();
      return n2 && Number.isFinite(s) ? { wt: n2, Ei: s } : null;
    })((() => this.pn), (() => this.ni()));
    this.Dn = new q(this, t, n);
  }
  N() {
    return this.yn;
  }
  In(t, i) {
    this.xn = t, this.Cn = i;
  }
  Vn() {
    this.xn = NaN, this.Cn = NaN;
  }
  Bn() {
    return this.xn;
  }
  En() {
    return this.Cn;
  }
  An(t, i, n) {
    this.wn || (this.wn = true), this.vn = true, this.Ln(t, i, n);
  }
  Bt() {
    return this.pn;
  }
  ni() {
    return this.bn;
  }
  si() {
    return this.Sn;
  }
  It() {
    return this.vn;
  }
  zn() {
    this.vn = false, this.On(), this.fn = NaN, this.bn = NaN, this.Sn = NaN, this.yt = null, this.Vn(), this.Nn();
  }
  Fn(t) {
    if (!this.yn.doNotSnapToHiddenSeriesIndices) return t;
    const i = this.sn, n = i.Et();
    let s = null, e2 = null;
    for (const n2 of i.Wn()) {
      const i2 = n2.Un().Hn(t, -1);
      if (i2) {
        if (i2.$n === t) return t;
        (null === s || i2.$n > s) && (s = i2.$n);
      }
      const r3 = n2.Un().Hn(t, 1);
      if (r3) {
        if (r3.$n === t) return t;
        (null === e2 || r3.$n < e2) && (e2 = r3.$n);
      }
    }
    const r2 = [s, e2].filter(g);
    if (0 === r2.length) return t;
    const h2 = n.jt(t), a2 = r2.map(((t2) => Math.abs(h2 - n.jt(t2))));
    return r2[a2.indexOf(Math.min(...a2))];
  }
  jn(t) {
    let i = this.Mn.get(t);
    i || (i = new A(this, t), this.Mn.set(t, i));
    let n = this.gn.get(t);
    return n || (n = new B(this.sn, this, t), this.gn.set(t, n)), [i, n];
  }
  ti(t) {
    return t === this.yt && this.yn.horzLine.visible;
  }
  ii() {
    return this.yn.vertLine.visible;
  }
  qn(t, i) {
    this.vn && this.yt === t || this.mn.clear();
    const n = [];
    return this.yt === t && n.push(this.Yn(this.mn, i, this.kn)), n;
  }
  dn() {
    return this.vn ? [this.Dn] : [];
  }
  Kn() {
    return this.yt;
  }
  Nn() {
    this.sn.Zn().forEach(((t) => {
      this.Mn.get(t)?.kt(), this.gn.get(t)?.kt();
    })), this.mn.forEach(((t) => t.kt())), this.Dn.kt();
  }
  Gn(t) {
    return t && !t.Pn().Gi() ? t.Pn() : null;
  }
  Ln(t, i, n) {
    this.Xn(t, i, n) && this.Nn();
  }
  Xn(t, i, n) {
    const s = this.bn, e2 = this.Sn, r2 = this.fn, h2 = this.pn, a2 = this.yt, l2 = this.Gn(n);
    this.pn = t, this.bn = isNaN(t) ? NaN : this.sn.Et().jt(t), this.yt = n;
    const o2 = null !== l2 ? l2.Lt() : null;
    return null !== l2 && null !== o2 ? (this.fn = i, this.Sn = l2.Nt(i, o2)) : (this.fn = NaN, this.Sn = NaN), s !== this.bn || e2 !== this.Sn || h2 !== this.pn || r2 !== this.fn || a2 !== this.yt;
  }
  On() {
    const t = this.sn.Jn().map(((t2) => t2.Un().Qn())).filter(g), i = 0 === t.length ? null : Math.max(...t);
    this.pn = null !== i ? i : NaN;
  }
  Yn(t, i, n) {
    let s = t.get(i);
    return void 0 === s && (s = new U(this, i, n), t.set(i, s)), s;
  }
}
function G(t) {
  return "left" === t || "right" === t;
}
class X {
  constructor(t) {
    this.ts = /* @__PURE__ */ new Map(), this.ns = [], this.ss = t;
  }
  es(t, i) {
    const n = (function(t2, i2) {
      return void 0 === t2 ? i2 : { rs: Math.max(t2.rs, i2.rs), hs: t2.hs || i2.hs };
    })(this.ts.get(t), i);
    this.ts.set(t, n);
  }
  ls() {
    return this.ss;
  }
  _s(t) {
    const i = this.ts.get(t);
    return void 0 === i ? { rs: this.ss } : { rs: Math.max(this.ss, i.rs), hs: i.hs };
  }
  us() {
    this.cs(), this.ns = [{ ds: 0 }];
  }
  fs(t) {
    this.cs(), this.ns = [{ ds: 1, Wt: t }];
  }
  ps(t) {
    this.vs(), this.ns.push({ ds: 5, Wt: t });
  }
  cs() {
    this.vs(), this.ns.push({ ds: 6 });
  }
  ws() {
    this.cs(), this.ns = [{ ds: 4 }];
  }
  Ms(t) {
    this.cs(), this.ns.push({ ds: 2, Wt: t });
  }
  gs(t) {
    this.cs(), this.ns.push({ ds: 3, Wt: t });
  }
  bs() {
    return this.ns;
  }
  Ss(t) {
    for (const i of t.ns) this.xs(i);
    this.ss = Math.max(this.ss, t.ss), t.ts.forEach(((t2, i) => {
      this.es(i, t2);
    }));
  }
  static Cs() {
    return new X(2);
  }
  static ys() {
    return new X(3);
  }
  xs(t) {
    switch (t.ds) {
      case 0:
        this.us();
        break;
      case 1:
        this.fs(t.Wt);
        break;
      case 2:
        this.Ms(t.Wt);
        break;
      case 3:
        this.gs(t.Wt);
        break;
      case 4:
        this.ws();
        break;
      case 5:
        this.ps(t.Wt);
        break;
      case 6:
        this.vs();
    }
  }
  vs() {
    const t = this.ns.findIndex(((t2) => 5 === t2.ds));
    -1 !== t && this.ns.splice(t, 1);
  }
}
class J {
  formatTickmarks(t) {
    return t.map(((t2) => this.format(t2)));
  }
}
const Q = ".";
function tt(t, i) {
  if (!p(t)) return "n/a";
  if (!v(i)) throw new TypeError("invalid length");
  if (i < 0 || i > 16) throw new TypeError("invalid length");
  if (0 === i) return t.toString();
  return ("0000000000000000" + t.toString()).slice(-i);
}
class it extends J {
  constructor(t, i) {
    if (super(), i || (i = 1), p(t) && v(t) || (t = 100), t < 0) throw new TypeError("invalid base");
    this.Ki = t, this.ks = i, this.Ps();
  }
  format(t) {
    const i = t < 0 ? "−" : "";
    return t = Math.abs(t), i + this.Ts(t);
  }
  Ps() {
    if (this.Rs = 0, this.Ki > 0 && this.ks > 0) {
      let t = this.Ki;
      for (; t > 1; ) t /= 10, this.Rs++;
    }
  }
  Ts(t) {
    const i = this.Ki / this.ks;
    let n = Math.floor(t), s = "";
    const e2 = void 0 !== this.Rs ? this.Rs : NaN;
    if (i > 1) {
      let r2 = +(Math.round(t * i) - n * i).toFixed(this.Rs);
      r2 >= i && (r2 -= i, n += 1), s = Q + tt(+r2.toFixed(this.Rs) * this.ks, e2);
    } else n = Math.round(n * i) / i, e2 > 0 && (s = Q + tt(0, e2));
    return n.toFixed(0) + s;
  }
}
class nt extends it {
  constructor(t = 100) {
    super(t);
  }
  format(t) {
    return `${super.format(t)}%`;
  }
}
class st extends J {
  constructor(t) {
    super(), this.Ds = t;
  }
  format(t) {
    let i = "";
    return t < 0 && (i = "-", t = -t), t < 995 ? i + this.Is(t) : t < 999995 ? i + this.Is(t / 1e3) + "K" : t < 999999995 ? (t = 1e3 * Math.round(t / 1e3), i + this.Is(t / 1e6) + "M") : (t = 1e6 * Math.round(t / 1e6), i + this.Is(t / 1e9) + "B");
  }
  Is(t) {
    let i;
    const n = Math.pow(10, this.Ds);
    return i = (t = Math.round(t * n) / n) >= 1e-15 && t < 1 ? t.toFixed(this.Ds).replace(/\.?0+$/, "") : String(t), i.replace(/(\.[1-9]*)0+$/, ((t2, i2) => i2));
  }
}
const et = /[2-9]/g;
class rt {
  constructor(t = 50) {
    this.Vs = 0, this.Bs = 1, this.Es = 1, this.As = {}, this.Ls = /* @__PURE__ */ new Map(), this.zs = t;
  }
  Os() {
    this.Vs = 0, this.Ls.clear(), this.Bs = 1, this.Es = 1, this.As = {};
  }
  Ii(t, i, n) {
    return this.Ns(t, i, n).width;
  }
  Di(t, i, n) {
    const s = this.Ns(t, i, n);
    return ((s.actualBoundingBoxAscent || 0) - (s.actualBoundingBoxDescent || 0)) / 2;
  }
  Ns(t, i, n) {
    const s = n || et, e2 = String(i).replace(s, "0");
    if (this.Ls.has(e2)) return _(this.Ls.get(e2)).Fs;
    if (this.Vs === this.zs) {
      const t2 = this.As[this.Es];
      delete this.As[this.Es], this.Ls.delete(t2), this.Es++, this.Vs--;
    }
    t.save(), t.textBaseline = "middle";
    const r2 = t.measureText(e2);
    return t.restore(), 0 === r2.width && i.length || (this.Ls.set(e2, { Fs: r2, Ws: this.Bs }), this.As[this.Bs] = e2, this.Vs++, this.Bs++), r2;
  }
}
class ht {
  constructor(t) {
    this.Hs = null, this.M = null, this.Us = "right", this.$s = t;
  }
  js(t, i, n) {
    this.Hs = t, this.M = i, this.Us = n;
  }
  st(t) {
    null !== this.M && null !== this.Hs && this.Hs.st(t, this.M, this.$s, this.Us);
  }
}
class at {
  constructor(t, i, n) {
    this.qs = t, this.$s = new rt(50), this.Ys = i, this.O = n, this.F = -1, this.Xt = new ht(this.$s);
  }
  Tt() {
    const t = this.O.Ks(this.Ys);
    if (null === t) return null;
    const i = t.Zs(this.Ys) ? t.Gs() : this.Ys.Ft();
    if (null === i) return null;
    const n = t.Xs(i);
    if ("overlay" === n) return null;
    const s = this.O.Js();
    return s.k !== this.F && (this.F = s.k, this.$s.Os()), this.Xt.js(this.qs.qi(), s, n), this.Xt;
  }
}
class lt extends R {
  constructor() {
    super(...arguments), this.qt = null;
  }
  ht(t) {
    this.qt = t;
  }
  Qs(t, i) {
    if (!this.qt?.It) return null;
    const { ut: n, ct: s, te: e2 } = this.qt;
    return i >= n - s - 7 && i <= n + s + 7 ? { ie: this.qt, ne: Math.abs(i - n), se: 2, ee: "price-line", te: e2 } : null;
  }
  et({ context: t, bitmapSize: i, horizontalPixelRatio: n, verticalPixelRatio: s }) {
    if (null === this.qt) return;
    if (false === this.qt.It) return;
    const e2 = Math.round(this.qt.ut * s);
    e2 < 0 || e2 > i.height || (t.lineCap = "butt", t.strokeStyle = this.qt.R, t.lineWidth = Math.floor(this.qt.ct * n), a(t, this.qt.Zt), l(t, e2, 0, i.width));
  }
}
class ot {
  constructor(t) {
    this.re = { ut: 0, R: "rgba(0, 0, 0, 0)", ct: 1, Zt: 0, It: false }, this.he = new lt(), this.xt = true, this.ae = t, this.le = t.Qt(), this.he.ht(this.re);
  }
  kt() {
    this.xt = true;
  }
  Tt() {
    return this.ae.It() ? (this.xt && (this.oe(), this.xt = false), this.he) : null;
  }
}
class _t extends ot {
  constructor(t) {
    super(t);
  }
  oe() {
    this.re.It = false;
    const t = this.ae.Ft(), i = t._e()._e;
    if (2 !== i && 3 !== i) return;
    const n = this.ae.N();
    if (!n.baseLineVisible || !this.ae.It()) return;
    const s = this.ae.Lt();
    null !== s && (this.re.It = true, this.re.ut = t.Nt(s.Wt, s.Wt), this.re.R = n.baseLineColor, this.re.ct = n.baseLineWidth, this.re.Zt = n.baseLineStyle);
  }
}
class ut extends R {
  constructor() {
    super(...arguments), this.qt = null;
  }
  ht(t) {
    this.qt = t;
  }
  ue() {
    return this.qt;
  }
  et({ context: t, horizontalPixelRatio: i, verticalPixelRatio: n }) {
    const s = this.qt;
    if (null === s) return;
    const e2 = Math.max(1, Math.floor(i)), r2 = e2 % 2 / 2, h2 = Math.round(s.ce.x * i) + r2, a2 = s.ce.y * n;
    t.fillStyle = s.de, t.beginPath();
    const l2 = Math.max(2, 1.5 * s.fe) * i;
    t.arc(h2, a2, l2, 0, 2 * Math.PI, false), t.fill(), t.fillStyle = s.pe, t.beginPath(), t.arc(h2, a2, s.ft * i, 0, 2 * Math.PI, false), t.fill(), t.lineWidth = e2, t.strokeStyle = s.ve, t.beginPath(), t.arc(h2, a2, s.ft * i + e2 / 2, 0, 2 * Math.PI, false), t.stroke();
  }
}
const ct = [{ me: 0, we: 0.25, Me: 4, ge: 10, be: 0.25, Se: 0, xe: 0.4, Ce: 0.8 }, { me: 0.25, we: 0.525, Me: 10, ge: 14, be: 0, Se: 0, xe: 0.8, Ce: 0 }, { me: 0.525, we: 1, Me: 14, ge: 14, be: 0, Se: 0, xe: 0, Ce: 0 }];
class dt {
  constructor(t) {
    this.Xt = new ut(), this.xt = true, this.ye = true, this.ke = performance.now(), this.Pe = this.ke - 1, this.Te = t;
  }
  Re() {
    this.Pe = this.ke - 1, this.kt();
  }
  De() {
    if (this.kt(), 2 === this.Te.N().lastPriceAnimation) {
      const t = performance.now(), i = this.Pe - t;
      if (i > 0) return void (i < 650 && (this.Pe += 2600));
      this.ke = t, this.Pe = t + 2600;
    }
  }
  kt() {
    this.xt = true;
  }
  Ie() {
    this.ye = true;
  }
  It() {
    return 0 !== this.Te.N().lastPriceAnimation;
  }
  Ve() {
    switch (this.Te.N().lastPriceAnimation) {
      case 0:
        return false;
      case 1:
        return true;
      case 2:
        return performance.now() <= this.Pe;
    }
  }
  Tt() {
    return this.xt ? (this.Rt(), this.xt = false, this.ye = false) : this.ye && (this.Be(), this.ye = false), this.Xt;
  }
  Rt() {
    this.Xt.ht(null);
    const t = this.Te.Qt().Et(), i = t.Ee(), n = this.Te.Lt();
    if (null === i || null === n) return;
    const s = this.Te.Ae(true);
    if (s.Le || !i.ze(s.$n)) return;
    const e2 = { x: t.jt(s.$n), y: this.Te.Ft().Nt(s.Mt, n.Wt) }, r2 = s.R, h2 = this.Te.N().lineWidth, a2 = this.Oe(this.Ne(), r2);
    this.Xt.ht({ de: r2, fe: h2, pe: a2.pe, ve: a2.ve, ft: a2.ft, ce: e2 });
  }
  Be() {
    const t = this.Xt.ue();
    if (null !== t) {
      const i = this.Oe(this.Ne(), t.de);
      t.pe = i.pe, t.ve = i.ve, t.ft = i.ft;
    }
  }
  Ne() {
    return this.Ve() ? performance.now() - this.ke : 2599;
  }
  Fe(t, i, n, s) {
    const e2 = n + (s - n) * i;
    return this.Te.Qt().Xi().Y(t, e2);
  }
  Oe(t, i) {
    const n = t % 2600 / 2600;
    let s;
    for (const t2 of ct) if (n >= t2.me && n <= t2.we) {
      s = t2;
      break;
    }
    o(void 0 !== s, "Last price animation internal logic error");
    const e2 = (n - s.me) / (s.we - s.me);
    return { pe: this.Fe(i, e2, s.be, s.Se), ve: this.Fe(i, e2, s.xe, s.Ce), ft: (r2 = e2, h2 = s.Me, a2 = s.ge, h2 + (a2 - h2) * r2) };
    var r2, h2, a2;
  }
}
class ft extends ot {
  constructor(t) {
    super(t);
  }
  oe() {
    const t = this.re;
    t.It = false;
    const i = this.ae.N();
    if (!i.priceLineVisible || !this.ae.It()) return;
    const n = this.ae.Ae(0 === i.priceLineSource);
    n.Le || (t.It = true, t.ut = n.Ei, t.R = this.ae.We(n.R), t.ct = i.priceLineWidth, t.Zt = i.priceLineStyle);
  }
}
class pt extends H {
  constructor(t) {
    super(), this.Jt = t;
  }
  Yi(t, i, n) {
    t.It = false, i.It = false;
    const s = this.Jt;
    if (!s.It()) return;
    const e2 = s.N(), r2 = e2.lastValueVisible, h2 = "" !== s.He(), a2 = 0 === e2.seriesLastValueMode, l2 = s.Ae(false);
    if (l2.Le) return;
    r2 && (t.ri = this.Ue(l2, r2, a2), t.It = 0 !== t.ri.length), (h2 || a2) && (i.ri = this.$e(l2, r2, h2, a2), i.It = i.ri.length > 0);
    const o2 = s.We(l2.R), _2 = this.Jt.Qt().Xi().Z(o2);
    n.G = _2.G, n.Ei = l2.Ei, i.Ht = s.Qt().Ut(l2.Ei / s.Ft().$t()), t.Ht = o2, t.R = _2.X, i.R = _2.X;
  }
  $e(t, i, n, s) {
    let e2 = "";
    const r2 = this.Jt.He();
    return n && 0 !== r2.length && (e2 += `${r2} `), i && s && (e2 += this.Jt.Ft().je() ? t.qe : t.Ye), e2.trim();
  }
  Ue(t, i, n) {
    return i ? n ? this.Jt.Ft().je() ? t.Ye : t.qe : t.ri : "";
  }
}
function vt(t, i, n, s) {
  const e2 = Number.isFinite(i), r2 = Number.isFinite(n);
  return e2 && r2 ? t(i, n) : e2 || r2 ? e2 ? i : n : s;
}
class mt {
  constructor(t, i) {
    this.Ke = t, this.Ze = i;
  }
  Ge(t) {
    return null !== t && (this.Ke === t.Ke && this.Ze === t.Ze);
  }
  Xe() {
    return new mt(this.Ke, this.Ze);
  }
  Je() {
    return this.Ke;
  }
  Qe() {
    return this.Ze;
  }
  tr() {
    return this.Ze - this.Ke;
  }
  Gi() {
    return this.Ze === this.Ke || Number.isNaN(this.Ze) || Number.isNaN(this.Ke);
  }
  Ss(t) {
    return null === t ? this : new mt(vt(Math.min, this.Je(), t.Je(), -1 / 0), vt(Math.max, this.Qe(), t.Qe(), 1 / 0));
  }
  ir(t) {
    if (!p(t)) return;
    if (0 === this.Ze - this.Ke) return;
    const i = 0.5 * (this.Ze + this.Ke);
    let n = this.Ze - i, s = this.Ke - i;
    n *= t, s *= t, this.Ze = i + n, this.Ke = i + s;
  }
  nr(t) {
    p(t) && (this.Ze += t, this.Ke += t);
  }
  sr() {
    return { minValue: this.Ke, maxValue: this.Ze };
  }
  static er(t) {
    return null === t ? null : new mt(t.minValue, t.maxValue);
  }
}
class wt {
  constructor(t, i) {
    this.rr = t, this.hr = i || null;
  }
  ar() {
    return this.rr;
  }
  lr() {
    return this.hr;
  }
  sr() {
    return { priceRange: null === this.rr ? null : this.rr.sr(), margins: this.hr || void 0 };
  }
  static er(t) {
    return null === t ? null : new wt(mt.er(t.priceRange), t.margins);
  }
}
const Mt = [2, 4, 8, 16, 32, 64, 128, 256, 512], gt = "Custom series with conflation reducer must have a priceValueBuilder method";
class bt extends ot {
  constructor(t, i) {
    super(t), this._r = i;
  }
  oe() {
    const t = this.re;
    t.It = false;
    const i = this._r.N();
    if (!this.ae.It() || !i.lineVisible) return;
    const n = this._r.ur();
    null !== n && (t.It = true, t.ut = n, t.R = i.color, t.ct = i.lineWidth, t.Zt = i.lineStyle, t.te = this._r.N().id);
  }
}
class St extends H {
  constructor(t, i) {
    super(), this.Te = t, this._r = i;
  }
  Yi(t, i, n) {
    t.It = false, i.It = false;
    const s = this._r.N(), e2 = s.axisLabelVisible, r2 = "" !== s.title, h2 = this.Te;
    if (!e2 || !h2.It()) return;
    const a2 = this._r.ur();
    if (null === a2) return;
    r2 && (i.ri = s.title, i.It = true), i.Ht = h2.Qt().Ut(a2 / h2.Ft().$t()), t.ri = this.cr(s.price), t.It = true;
    const l2 = this.Te.Qt().Xi().Z(s.axisLabelColor || s.color);
    n.G = l2.G;
    const o2 = s.axisLabelTextColor || l2.X;
    t.R = o2, i.R = o2, n.Ei = a2;
  }
  cr(t) {
    const i = this.Te.Lt();
    return null === i ? "" : this.Te.Ft().Ji(t, i.Wt);
  }
}
class xt {
  constructor(t, i) {
    this.Te = t, this.yn = i, this.dr = new bt(t, this), this.qs = new St(t, this), this.pr = new at(this.qs, t, t.Qt());
  }
  vr(t) {
    f(this.yn, t), this.kt(), this.Te.Qt().mr();
  }
  N() {
    return this.yn;
  }
  wr() {
    return this.dr;
  }
  Mr() {
    return this.pr;
  }
  gr() {
    return this.qs;
  }
  kt() {
    this.dr.kt(), this.qs.kt();
  }
  ur() {
    const t = this.Te, i = t.Ft();
    if (t.Qt().Et().Gi() || i.Gi()) return null;
    const n = t.Lt();
    return null === n ? null : i.Nt(this.yn.price, n.Wt);
  }
}
class Ct {
  constructor() {
    this.br = /* @__PURE__ */ new WeakMap();
  }
  Sr(t, i, n) {
    const s = 1 / i * n;
    if (t >= s) return 1;
    const e2 = s / t, r2 = Math.pow(2, Math.floor(Math.log2(e2)));
    return Math.min(r2, 512);
  }
  Cr(t, i, n, s = false, e2) {
    if (0 === t.length || i <= 1) return t;
    const r2 = this.yr(i);
    if (r2 <= 1) return t;
    const h2 = this.kr(t);
    let a2 = h2.Pr.get(r2);
    return void 0 !== a2 || (a2 = this.Tr(t, r2, n, s, e2, h2.Pr), h2.Pr.set(r2, a2)), a2;
  }
  Rr(t, i, n, s, e2 = false, r2) {
    if (n < 1 || 0 === t.length) return t;
    const h2 = this.kr(t), a2 = h2.Pr.get(n);
    if (!a2) return this.Cr(t, n, s, e2, r2);
    const l2 = this.Dr(t, i, n, a2, e2, s, r2);
    return h2.Pr.set(n, l2), l2;
  }
  yr(t) {
    if (t <= 2) return 2;
    for (const i of Mt) if (t <= i) return i;
    return 512;
  }
  Ir(t) {
    if (0 === t.length) return 0;
    const i = t[0], n = t[t.length - 1];
    return 31 * t.length + 17 * i.$n + 13 * n.$n;
  }
  Tr(t, i, n, s = false, e2, r2 = /* @__PURE__ */ new Map()) {
    if (2 === i) return this.Vr(t, 2, n, s, e2);
    const h2 = i / 2;
    let a2 = r2.get(h2);
    return a2 || (a2 = this.Tr(t, h2, n, s, e2, r2), r2.set(h2, a2)), this.Br(a2, n, s, e2);
  }
  Vr(t, i, n, s = false, e2) {
    const r2 = this.Er(t, i, n, s, e2);
    return this.Ar(r2, s);
  }
  Br(t, i, n = false, s) {
    const e2 = this.Er(t, 2, i, n, s);
    return this.Ar(e2, n);
  }
  Er(t, i, n, s = false, e2) {
    const r2 = [];
    for (let h2 = 0; h2 < t.length; h2 += i) {
      if (t.length - h2 >= i) {
        const i2 = this.Lr(t[h2], t[h2 + 1], n, s, e2);
        i2.zr = false, r2.push(i2);
      } else if (0 === r2.length) r2.push(this.Or(t[h2], true));
      else {
        const i2 = r2[r2.length - 1];
        r2[r2.length - 1] = this.Nr(i2, t[h2], n, s, e2);
      }
    }
    return r2;
  }
  Fr(t, i) {
    return (t ?? 1) + (i ?? 1);
  }
  Lr(t, i, n, s = false, e2) {
    if (!s || !n || !e2) {
      const n2 = t.Wt[1] > i.Wt[1] ? t.Wt[1] : i.Wt[1], s2 = t.Wt[2] < i.Wt[2] ? t.Wt[2] : i.Wt[2];
      return { Wr: t.$n, Hr: i.$n, Ur: t.wt, $r: i.wt, jr: t.Wt[0], qr: n2, Yr: s2, Kr: i.Wt[3], Zr: this.Fr(t.Zr, i.Zr), Gr: void 0, zr: false };
    }
    const r2 = n(this.Xr(t, e2), this.Xr(i, e2)), h2 = e2(r2), a2 = h2.length ? h2[h2.length - 1] : 0;
    return { Wr: t.$n, Hr: i.$n, Ur: t.wt, $r: i.wt, jr: t.Wt[0], qr: Math.max(t.Wt[1], a2), Yr: Math.min(t.Wt[2], a2), Kr: a2, Zr: this.Fr(t.Zr, i.Zr), Gr: r2, zr: false };
  }
  Nr(t, i, n, s = false, e2) {
    if (!s || !n || !e2) return { Wr: t.Wr, Hr: i.$n, Ur: t.Ur, $r: i.wt, jr: t.jr, qr: t.qr > i.Wt[1] ? t.qr : i.Wt[1], Yr: t.Yr < i.Wt[2] ? t.Yr : i.Wt[2], Kr: i.Wt[3], Zr: t.Zr + (i.Zr ?? 1), Gr: t.Gr, zr: false };
    const r2 = t.Gr, h2 = this.Xr(i, e2), a2 = r2 ? { data: r2, index: t.Wr, originalTime: t.Ur, time: t.Ur, priceValues: e2(r2) } : null, l2 = a2 ? n(a2, h2) : h2.data, o2 = a2 ? e2(l2) : h2.priceValues, _2 = o2.length ? o2[o2.length - 1] : 0;
    return { Wr: t.Wr, Hr: i.$n, Ur: t.Ur, $r: i.wt, jr: t.jr, qr: Math.max(t.qr, _2), Yr: Math.min(t.Yr, _2), Kr: _2, Zr: t.Zr + (i.Zr ?? 1), Gr: l2, zr: false };
  }
  Jr(t, i, n, s, e2, r2, h2 = false, a2) {
    const l2 = i === s ? e2 : t[i];
    if (n - i == 1) return this.Or(l2, true);
    const o2 = i + 1 === s ? e2 : t[i + 1];
    let _2 = this.Lr(l2, o2, r2, h2, a2);
    for (let l3 = i + 2; l3 < n; l3++) {
      const i2 = l3 === s ? e2 : t[l3];
      _2 = this.Nr(_2, i2, r2, h2, a2);
    }
    return _2;
  }
  Xr(t, i) {
    const n = t.ue ?? {};
    return { data: t.ue, index: t.$n, originalTime: t.Qr, time: t.wt, priceValues: i(n) };
  }
  th(t, i = false) {
    const n = true === i, s = !!t.Gr;
    return { ...{ $n: t.Wr, wt: t.Ur, Qr: t.Ur, Wt: [n ? t.Kr : t.jr, t.qr, t.Yr, t.Kr], Zr: t.Zr }, ue: n ? s ? t.Gr : { wt: t.Ur } : void 0 };
  }
  Ar(t, i = false) {
    return t.map(((t2) => this.th(t2, i)));
  }
  Dr(t, i, n, s, e2 = false, r2, h2) {
    if (0 === s.length) return s;
    const a2 = t.length - 1, l2 = Math.floor(a2 / n) * n;
    if (Math.min(l2 + n, t.length) - l2 < n && t.length > n) {
      const s2 = t.slice();
      return s2[s2.length - 1] = i, this.Cr(s2, n, r2, e2, h2);
    }
    if (Math.floor((a2 - 1) / n) === Math.floor(a2 / n) || 1 === s.length) {
      const o2 = Math.min(l2 + n, t.length), _2 = o2 - l2;
      if (_2 <= 0) return s;
      const u2 = 1 === _2 ? this.Or(l2 === a2 ? i : t[l2], true) : this.Jr(t, l2, o2, a2, i, r2, e2, h2);
      return s[s.length - 1] = this.th(u2, e2), s;
    }
    {
      const s2 = t.slice();
      return s2[s2.length - 1] = i, this.Cr(s2, n, r2, e2, h2);
    }
  }
  Or(t, i = false) {
    return { Wr: t.$n, Hr: t.$n, Ur: t.wt, $r: t.wt, jr: t.Wt[0], qr: t.Wt[1], Yr: t.Wt[2], Kr: t.Wt[3], Zr: t.Zr ?? 1, Gr: t.ue, zr: i };
  }
  kr(t) {
    const i = this.ih(t), n = this.Ir(t);
    return i.nh !== n && (i.Pr.clear(), i.nh = n), i;
  }
  ih(t) {
    let i = this.br.get(t);
    return void 0 === i && (i = { nh: this.Ir(t), Pr: /* @__PURE__ */ new Map() }, this.br.set(t, i)), i;
  }
}
class yt extends Y {
  constructor(t) {
    super(), this.sn = t;
  }
  Qt() {
    return this.sn;
  }
}
const kt = { Bar: (t, i, n, s) => {
  const e2 = i.upColor, r2 = i.downColor, h2 = u(t(n, s)), a2 = c(h2.Wt[0]) <= c(h2.Wt[3]);
  return { sh: h2.R ?? (a2 ? e2 : r2) };
}, Candlestick: (t, i, n, s) => {
  const e2 = i.upColor, r2 = i.downColor, h2 = i.borderUpColor, a2 = i.borderDownColor, l2 = i.wickUpColor, o2 = i.wickDownColor, _2 = u(t(n, s)), d2 = c(_2.Wt[0]) <= c(_2.Wt[3]);
  return { sh: _2.R ?? (d2 ? e2 : r2), eh: _2.Ht ?? (d2 ? h2 : a2), rh: _2.hh ?? (d2 ? l2 : o2) };
}, Custom: (t, i, n, s) => ({ sh: u(t(n, s)).R ?? i.color }), Area: (t, i, n, s) => {
  const e2 = u(t(n, s));
  return { sh: e2.vt ?? i.lineColor, vt: e2.vt ?? i.lineColor, ah: e2.ah ?? i.topColor, oh: e2.oh ?? i.bottomColor };
}, Baseline: (t, i, n, s) => {
  const e2 = u(t(n, s));
  return { sh: e2.Wt[3] >= i.baseValue.price ? i.topLineColor : i.bottomLineColor, _h: e2._h ?? i.topLineColor, uh: e2.uh ?? i.bottomLineColor, dh: e2.dh ?? i.topFillColor1, fh: e2.fh ?? i.topFillColor2, ph: e2.ph ?? i.bottomFillColor1, mh: e2.mh ?? i.bottomFillColor2 };
}, Line: (t, i, n, s) => {
  const e2 = u(t(n, s));
  return { sh: e2.R ?? i.color, vt: e2.R ?? i.color };
}, Histogram: (t, i, n, s) => ({ sh: u(t(n, s)).R ?? i.color }) };
class Pt {
  constructor(t) {
    this.wh = (t2, i) => void 0 !== i ? i.Wt : this.Te.Un().Mh(t2), this.Te = t, this.gh = kt[t.bh()];
  }
  Sh(t, i) {
    return this.gh(this.wh, this.Te.N(), t, i);
  }
}
function Tt(t, i, n, s, e2 = 0, r2 = i.length) {
  let h2 = r2 - e2;
  for (; 0 < h2; ) {
    const r3 = h2 >> 1, a2 = e2 + r3;
    s(i[a2], n) === t ? (e2 = a2 + 1, h2 -= r3 + 1) : h2 = r3;
  }
  return e2;
}
const Rt = Tt.bind(null, true), Dt = Tt.bind(null, false);
var It;
!(function(t) {
  t[t.NearestLeft = -1] = "NearestLeft", t[t.None = 0] = "None", t[t.NearestRight = 1] = "NearestRight";
})(It || (It = {}));
const Vt = 30;
class Bt {
  constructor() {
    this.xh = [], this.Ch = /* @__PURE__ */ new Map(), this.yh = /* @__PURE__ */ new Map(), this.kh = [];
  }
  Ph() {
    return this.Th() > 0 ? this.xh[this.xh.length - 1] : null;
  }
  Rh() {
    return this.Th() > 0 ? this.Dh(0) : null;
  }
  Qn() {
    return this.Th() > 0 ? this.Dh(this.xh.length - 1) : null;
  }
  Th() {
    return this.xh.length;
  }
  Gi() {
    return 0 === this.Th();
  }
  ze(t) {
    return null !== this.Ih(t, 0);
  }
  Mh(t) {
    return this.Hn(t);
  }
  Hn(t, i = 0) {
    const n = this.Ih(t, i);
    return null === n ? null : { ...this.Vh(n), $n: this.Dh(n) };
  }
  Bh() {
    return this.xh;
  }
  Eh(t, i, n) {
    if (this.Gi()) return null;
    let s = null;
    for (const e2 of n) {
      s = Et(s, this.Ah(t, i, e2));
    }
    return s;
  }
  ht(t) {
    this.yh.clear(), this.Ch.clear(), this.xh = t, this.kh = t.map(((t2) => t2.$n));
  }
  Lh() {
    return this.kh;
  }
  Dh(t) {
    return this.xh[t].$n;
  }
  Vh(t) {
    return this.xh[t];
  }
  Ih(t, i) {
    const n = this.zh(t);
    if (null === n && 0 !== i) switch (i) {
      case -1:
        return this.Oh(t);
      case 1:
        return this.Nh(t);
      default:
        throw new TypeError("Unknown search mode");
    }
    return n;
  }
  Oh(t) {
    let i = this.Fh(t);
    return i > 0 && (i -= 1), i !== this.xh.length && this.Dh(i) < t ? i : null;
  }
  Nh(t) {
    const i = this.Wh(t);
    return i !== this.xh.length && t < this.Dh(i) ? i : null;
  }
  zh(t) {
    const i = this.Fh(t);
    return i === this.xh.length || t < this.xh[i].$n ? null : i;
  }
  Fh(t) {
    return Rt(this.xh, t, ((t2, i) => t2.$n < i));
  }
  Wh(t) {
    return Dt(this.xh, t, ((t2, i) => t2.$n > i));
  }
  Hh(t, i, n) {
    let s = null;
    for (let e2 = t; e2 < i; e2++) {
      const t2 = this.xh[e2].Wt[n];
      Number.isNaN(t2) || (null === s ? s = { Uh: t2, $h: t2 } : (t2 < s.Uh && (s.Uh = t2), t2 > s.$h && (s.$h = t2)));
    }
    return s;
  }
  Ah(t, i, n) {
    if (this.Gi()) return null;
    let s = null;
    const e2 = u(this.Rh()), r2 = u(this.Qn()), h2 = Math.max(t, e2), a2 = Math.min(i, r2), l2 = Math.ceil(h2 / Vt) * Vt, o2 = Math.max(l2, Math.floor(a2 / Vt) * Vt);
    {
      const t2 = this.Fh(h2), e3 = this.Wh(Math.min(a2, l2, i));
      s = Et(s, this.Hh(t2, e3, n));
    }
    let _2 = this.Ch.get(n);
    void 0 === _2 && (_2 = /* @__PURE__ */ new Map(), this.Ch.set(n, _2));
    for (let t2 = Math.max(l2 + 1, h2); t2 < o2; t2 += Vt) {
      const i2 = Math.floor(t2 / Vt);
      let e3 = _2.get(i2);
      if (void 0 === e3) {
        const t3 = this.Fh(i2 * Vt), s2 = this.Wh((i2 + 1) * Vt - 1);
        e3 = this.Hh(t3, s2, n), _2.set(i2, e3);
      }
      s = Et(s, e3);
    }
    {
      const t2 = this.Fh(o2), i2 = this.Wh(a2);
      s = Et(s, this.Hh(t2, i2, n));
    }
    return s;
  }
}
function Et(t, i) {
  if (null === t) return i;
  if (null === i) return t;
  return { Uh: Math.min(t.Uh, i.Uh), $h: Math.max(t.$h, i.$h) };
}
function At() {
  return new Bt();
}
const Lt = { setLineStyle: a };
class zt {
  constructor(t) {
    this.jh = t;
  }
  st(t, i, n) {
    this.jh.draw(t, Lt);
  }
  qh(t, i, n) {
    this.jh.drawBackground?.(t, Lt);
  }
}
class Ot {
  constructor(t) {
    this.Ls = null, this.Yh = t;
  }
  Tt() {
    const t = this.Yh.renderer();
    if (null === t) return null;
    if (this.Ls?.Kh === t) return this.Ls.Zh;
    const i = new zt(t);
    return this.Ls = { Kh: t, Zh: i }, i;
  }
  Gh() {
    return this.Yh.zOrder?.() ?? "normal";
  }
}
class Nt {
  constructor(t) {
    this.Xh = null, this.Jh = t;
  }
  Qh() {
    return this.Jh;
  }
  Nn() {
    this.Jh.updateAllViews?.();
  }
  jn() {
    const t = this.Jh.paneViews?.() ?? [];
    if (this.Xh?.Kh === t) return this.Xh.Zh;
    const i = t.map(((t2) => new Ot(t2)));
    return this.Xh = { Kh: t, Zh: i }, i;
  }
  Qs(t, i) {
    return this.Jh.hitTest?.(t, i) ?? null;
  }
}
let Ft = class extends Nt {
  cn() {
    return [];
  }
};
class Wt {
  constructor(t) {
    this.jh = t;
  }
  st(t, i, n) {
    this.jh.draw(t, Lt);
  }
  qh(t, i, n) {
    this.jh.drawBackground?.(t, Lt);
  }
}
class Ht {
  constructor(t) {
    this.Ls = null, this.Yh = t;
  }
  Tt() {
    const t = this.Yh.renderer();
    if (null === t) return null;
    if (this.Ls?.Kh === t) return this.Ls.Zh;
    const i = new Wt(t);
    return this.Ls = { Kh: t, Zh: i }, i;
  }
  Gh() {
    return this.Yh.zOrder?.() ?? "normal";
  }
}
function Ut(t) {
  return { ri: t.text(), Ei: t.coordinate(), Vi: t.fixedCoordinate?.(), R: t.textColor(), G: t.backColor(), It: t.visible?.() ?? true, pi: t.tickVisible?.() ?? true };
}
class $t {
  constructor(t, i) {
    this.Xt = new j(), this.ta = t, this.ia = i;
  }
  Tt() {
    return this.Xt.ht({ nn: this.ia.nn(), ...Ut(this.ta) }), this.Xt;
  }
}
class jt extends H {
  constructor(t, i) {
    super(), this.ta = t, this.Ki = i;
  }
  Yi(t, i, n) {
    const s = Ut(this.ta);
    n.G = s.G, t.R = s.R;
    const e2 = 2 / 12 * this.Ki.k();
    n.Ti = e2, n.Ri = e2, n.Ei = s.Ei, n.Vi = s.Vi, t.ri = s.ri, t.It = s.It, t.pi = s.pi;
  }
}
class qt extends Nt {
  constructor(t, i) {
    super(t), this.na = null, this.sa = null, this.ea = null, this.ra = null, this.Te = i;
  }
  dn() {
    const t = this.Jh.timeAxisViews?.() ?? [];
    if (this.na?.Kh === t) return this.na.Zh;
    const i = this.Te.Qt().Et(), n = t.map(((t2) => new $t(t2, i)));
    return this.na = { Kh: t, Zh: n }, n;
  }
  qn() {
    const t = this.Jh.priceAxisViews?.() ?? [];
    if (this.sa?.Kh === t) return this.sa.Zh;
    const i = this.Te.Ft(), n = t.map(((t2) => new jt(t2, i)));
    return this.sa = { Kh: t, Zh: n }, n;
  }
  ha() {
    const t = this.Jh.priceAxisPaneViews?.() ?? [];
    if (this.ea?.Kh === t) return this.ea.Zh;
    const i = t.map(((t2) => new Ht(t2)));
    return this.ea = { Kh: t, Zh: i }, i;
  }
  aa() {
    const t = this.Jh.timeAxisPaneViews?.() ?? [];
    if (this.ra?.Kh === t) return this.ra.Zh;
    const i = t.map(((t2) => new Ht(t2)));
    return this.ra = { Kh: t, Zh: i }, i;
  }
  la(t, i) {
    return this.Jh.autoscaleInfo?.(t, i) ?? null;
  }
}
function Yt(t, i, n, s) {
  t.forEach(((t2) => {
    i(t2).forEach(((t3) => {
      t3.Gh() === n && s.push(t3);
    }));
  }));
}
function Kt(t) {
  return t.jn();
}
function Zt(t) {
  return t.ha();
}
function Gt(t) {
  return t.aa();
}
const Xt = ["Area", "Line", "Baseline"];
class Jt extends yt {
  constructor(t, i, n, s, e2) {
    super(t), this.qt = At(), this.dr = new ft(this), this.oa = [], this._a = new _t(this), this.ua = null, this.ca = null, this.da = null, this.fa = [], this.pa = new Ct(), this.va = /* @__PURE__ */ new Map(), this.ma = null, this.yn = n, this.wa = i;
    const r2 = new pt(this);
    if (this.mn = [r2], this.pr = new at(r2, this, t), Xt.includes(this.wa) && (this.ua = new dt(this)), this.Ma(), this.Yh = s(this, this.Qt(), e2), "Custom" === this.wa) {
      const t2 = this.Yh;
      t2.ga && this.ba(t2.ga);
    }
  }
  m() {
    null !== this.da && clearTimeout(this.da);
  }
  We(t) {
    return this.yn.priceLineColor || t;
  }
  Ae(t) {
    const i = { Le: true }, n = this.Ft();
    if (this.Qt().Et().Gi() || n.Gi() || this.qt.Gi()) return i;
    const s = this.Qt().Et().Ee(), e2 = this.Lt();
    if (null === s || null === e2) return i;
    let r2, h2;
    if (t) {
      const t2 = this.qt.Ph();
      if (null === t2) return i;
      r2 = t2, h2 = t2.$n;
    } else {
      const t2 = this.qt.Hn(s.bi(), -1);
      if (null === t2) return i;
      if (r2 = this.qt.Mh(t2.$n), null === r2) return i;
      h2 = t2.$n;
    }
    const a2 = r2.Wt[3], l2 = this.Sa().Sh(h2, { Wt: r2 }), o2 = n.Nt(a2, e2.Wt);
    return { Le: false, Mt: a2, ri: n.Ji(a2, e2.Wt), qe: n.xa(a2), Ye: n.Ca(a2, e2.Wt), R: l2.sh, Ei: o2, $n: h2 };
  }
  Sa() {
    return null !== this.ca || (this.ca = new Pt(this)), this.ca;
  }
  N() {
    return this.yn;
  }
  vr(t) {
    const i = this.Qt(), { priceScaleId: n, visible: s, priceFormat: e2 } = t;
    void 0 !== n && n !== this.yn.priceScaleId && i.ya(this, n), void 0 !== s && s !== this.yn.visible && i.ka();
    const r2 = void 0 !== t.conflationThresholdFactor;
    f(this.yn, t), r2 && (this.va.clear(), this.Qt().mr()), void 0 !== e2 && (this.Ma(), i.Pa()), i.Ta(this), i.Ra(), this.Yh.kt("options");
  }
  ht(t, i) {
    this.qt.ht(t), this.va.clear();
    const n = this.Qt().Et().N();
    n.enableConflation && n.precomputeConflationOnInit && this.Da(n.precomputeConflationPriority), this.Yh.kt("data"), null !== this.ua && (i && i.Ia ? this.ua.De() : 0 === t.length && this.ua.Re());
    const s = this.Qt().Ks(this);
    this.Qt().Va(s), this.Qt().Ta(this), this.Qt().Ra(), this.Qt().mr();
  }
  Ba(t) {
    const i = new xt(this, t);
    return this.oa.push(i), this.Qt().Ta(this), i;
  }
  Ea(t) {
    const i = this.oa.indexOf(t);
    -1 !== i && this.oa.splice(i, 1), this.Qt().Ta(this);
  }
  Aa() {
    return this.oa;
  }
  bh() {
    return this.wa;
  }
  Lt() {
    const t = this.La();
    return null === t ? null : { Wt: t.Wt[3], za: t.wt };
  }
  La() {
    const t = this.Qt().Et().Ee();
    if (null === t) return null;
    const i = t.Oa();
    return this.qt.Hn(i, 1);
  }
  Un() {
    return this.qt;
  }
  ba(t) {
    this.ma = t, this.va.clear();
  }
  Na() {
    return !!this.Qt().Et().N().enableConflation && this.Fa() > 1;
  }
  Rr(t) {
    if (!this.Na()) return;
    const i = this.Fa();
    if (!this.va.has(i)) return;
    const n = "Custom" === this.wa, s = n && this.ma || void 0, e2 = n && this.Yh.Wa ? (t2) => {
      const i2 = t2, n2 = this.Yh.Wa(i2);
      return Array.isArray(n2) ? n2 : ["number" == typeof n2 ? n2 : 0];
    } : void 0, r2 = this.pa.Rr(this.qt.Bh(), t, i, s, n, e2), h2 = At();
    h2.ht(r2), this.va.set(i, h2);
  }
  Ha() {
    const t = this.Qt().Et().N().enableConflation;
    if ("Custom" === this.wa && null === this.ma) return this.qt;
    if (!t) return this.qt;
    const i = this.Fa(), n = this.va.get(i);
    if (n) return n;
    this.Ua(i);
    return this.va.get(i) ?? this.qt;
  }
  $a(t) {
    const i = this.qt.Mh(t);
    return null === i ? null : "Bar" === this.wa || "Candlestick" === this.wa || "Custom" === this.wa ? { jr: i.Wt[0], qr: i.Wt[1], Yr: i.Wt[2], Kr: i.Wt[3] } : i.Wt[3];
  }
  ja(t) {
    const i = [];
    Yt(this.fa, Kt, "top", i);
    const n = this.ua;
    return null !== n && n.It() ? (null === this.da && n.Ve() && (this.da = setTimeout((() => {
      this.da = null, this.Qt().qa();
    }), 0)), n.Ie(), i.unshift(n), i) : i;
  }
  jn() {
    const t = [];
    this.Ya() || t.push(this._a), t.push(this.Yh, this.dr);
    const i = this.oa.map(((t2) => t2.wr()));
    return t.push(...i), Yt(this.fa, Kt, "normal", t), t;
  }
  Ka() {
    return this.Za(Kt, "bottom");
  }
  Ga(t) {
    return this.Za(Zt, t);
  }
  Xa(t) {
    return this.Za(Gt, t);
  }
  Ja(t, i) {
    return this.fa.map(((n) => n.Qs(t, i))).filter(((t2) => null !== t2));
  }
  cn() {
    return [this.pr, ...this.oa.map(((t) => t.Mr()))];
  }
  qn(t, i) {
    if (i !== this.hn && !this.Ya()) return [];
    const n = [...this.mn];
    for (const t2 of this.oa) n.push(t2.gr());
    return this.fa.forEach(((t2) => {
      n.push(...t2.qn());
    })), n;
  }
  dn() {
    const t = [];
    return this.fa.forEach(((i) => {
      t.push(...i.dn());
    })), t;
  }
  la(t, i) {
    if (void 0 !== this.yn.autoscaleInfoProvider) {
      const n = this.yn.autoscaleInfoProvider((() => {
        const n2 = this.Qa(t, i);
        return null === n2 ? null : n2.sr();
      }));
      return wt.er(n);
    }
    return this.Qa(t, i);
  }
  Kh() {
    const t = this.yn.priceFormat;
    return t.base ?? 1 / t.minMove;
  }
  tl() {
    return this.il;
  }
  Nn() {
    this.Yh.kt();
    for (const t of this.mn) t.kt();
    for (const t of this.oa) t.kt();
    this.dr.kt(), this._a.kt(), this.ua?.kt(), this.fa.forEach(((t) => t.Nn()));
  }
  Ft() {
    return u(super.Ft());
  }
  At(t) {
    if (!(("Line" === this.wa || "Area" === this.wa || "Baseline" === this.wa) && this.yn.crosshairMarkerVisible)) return null;
    const i = this.qt.Mh(t);
    if (null === i) return null;
    return { Mt: i.Wt[3], ft: this.nl(), Ht: this.sl(), Ot: this.el(), zt: this.rl(t) };
  }
  He() {
    return this.yn.title;
  }
  It() {
    return this.yn.visible;
  }
  hl(t) {
    this.fa.push(new qt(t, this));
  }
  al(t) {
    this.fa = this.fa.filter(((i) => i.Qh() !== t));
  }
  ll() {
    if ("Custom" === this.wa) return (t) => this.Yh.Wa(t);
  }
  ol() {
    if ("Custom" === this.wa) return (t) => this.Yh._l(t);
  }
  ul() {
    return this.qt.Lh();
  }
  Ya() {
    return !G(this.Ft().cl());
  }
  Qa(t, i) {
    if (!v(t) || !v(i) || this.qt.Gi()) return null;
    const n = "Line" === this.wa || "Area" === this.wa || "Baseline" === this.wa || "Histogram" === this.wa ? [3] : [2, 1], s = this.qt.Eh(t, i, n);
    let e2 = null !== s ? new mt(s.Uh, s.$h) : null, r2 = null;
    if ("Histogram" === this.bh()) {
      const t2 = this.yn.base, i2 = new mt(t2, t2);
      e2 = null !== e2 ? e2.Ss(i2) : i2;
    }
    return this.fa.forEach(((n2) => {
      const s2 = n2.la(t, i);
      if (s2?.priceRange) {
        const t2 = new mt(s2.priceRange.minValue, s2.priceRange.maxValue);
        e2 = null !== e2 ? e2.Ss(t2) : t2;
      }
      s2?.margins && (r2 = s2.margins);
    })), new wt(e2, r2);
  }
  nl() {
    switch (this.wa) {
      case "Line":
      case "Area":
      case "Baseline":
        return this.yn.crosshairMarkerRadius;
    }
    return 0;
  }
  sl() {
    switch (this.wa) {
      case "Line":
      case "Area":
      case "Baseline": {
        const t = this.yn.crosshairMarkerBorderColor;
        if (0 !== t.length) return t;
      }
    }
    return null;
  }
  el() {
    switch (this.wa) {
      case "Line":
      case "Area":
      case "Baseline":
        return this.yn.crosshairMarkerBorderWidth;
    }
    return 0;
  }
  rl(t) {
    switch (this.wa) {
      case "Line":
      case "Area":
      case "Baseline": {
        const t2 = this.yn.crosshairMarkerBackgroundColor;
        if (0 !== t2.length) return t2;
      }
    }
    return this.Sa().Sh(t).sh;
  }
  Ma() {
    switch (this.yn.priceFormat.type) {
      case "custom": {
        const t = this.yn.priceFormat.formatter;
        this.il = { format: t, formatTickmarks: this.yn.priceFormat.tickmarksFormatter ?? ((i) => i.map(t)) };
        break;
      }
      case "volume":
        this.il = new st(this.yn.priceFormat.precision);
        break;
      case "percent":
        this.il = new nt(this.yn.priceFormat.precision);
        break;
      default: {
        const t = Math.pow(10, this.yn.priceFormat.precision);
        this.il = new it(t, this.yn.priceFormat.minMove * t);
      }
    }
    null !== this.hn && this.hn.dl();
  }
  Za(t, i) {
    const n = [];
    return Yt(this.fa, t, i, n), n;
  }
  Fa() {
    const { fl: t, pl: i, vl: n } = this.ml();
    return this.pa.Sr(t, i, n);
  }
  ml() {
    const t = this.Qt().Et(), i = t.fl(), n = window.devicePixelRatio || 1, s = t.N().conflationThresholdFactor;
    return { fl: i, pl: n, vl: this.yn.conflationThresholdFactor ?? s ?? 1 };
  }
  wl(t) {
    const i = this.qt.Bh();
    let n;
    if ("Custom" === this.wa && null !== this.ma) {
      const s2 = this.ll();
      if (!s2) throw new Error(gt);
      n = this.pa.Cr(i, t, this.ma, true, ((t2) => s2(t2)));
    } else n = this.pa.Cr(i, t);
    const s = At();
    return s.ht(n), s;
  }
  Ua(t) {
    const i = this.wl(t);
    this.va.set(t, i);
  }
  Da(t) {
    if ("Custom" === this.wa && (null === this.ma || !this.ll())) return;
    this.va.clear();
    const i = this.Qt().Et().Ml();
    for (const n of i) {
      const i2 = () => {
        this.gl(n);
      }, s = "object" == typeof window && window || "object" == typeof self && self;
      s?.Sl?.bl ? s.Sl.bl((() => {
        i2();
      }), { se: t }) : Promise.resolve().then((() => i2()));
    }
  }
  gl(t) {
    if (this.va.has(t)) return;
    if (0 === this.qt.Bh().length) return;
    const i = this.wl(t);
    this.va.set(t, i);
  }
}
const Qt = [3], ti = [0, 1, 2, 3];
class ii {
  constructor(t) {
    this.yn = t;
  }
  xl(t, i, n) {
    let s = t;
    if (0 === this.yn.mode) return s;
    const e2 = n.Pn(), r2 = e2.Lt();
    if (null === r2) return s;
    const h2 = e2.Nt(t, r2), a2 = n.Cl().filter(((t2) => t2 instanceof Jt)).reduce(((t2, s2) => {
      if (n.Zs(s2) || !s2.It()) return t2;
      const e3 = s2.Ft(), r3 = s2.Un();
      if (e3.Gi() || !r3.ze(i)) return t2;
      const h3 = r3.Mh(i);
      if (null === h3) return t2;
      const a3 = c(s2.Lt()), l3 = 3 === this.yn.mode ? ti : Qt;
      return t2.concat(l3.map(((t3) => e3.Nt(h3.Wt[t3], a3.Wt))));
    }), []);
    if (0 === a2.length) return s;
    a2.sort(((t2, i2) => Math.abs(t2 - h2) - Math.abs(i2 - h2)));
    const l2 = a2[0];
    return s = e2.Tn(l2, r2), s;
  }
}
function ni(t, i, n) {
  return Math.min(Math.max(t, i), n);
}
function si(t, i, n) {
  return i - t <= n;
}
class ri extends R {
  constructor() {
    super(...arguments), this.qt = null;
  }
  ht(t) {
    this.qt = t;
  }
  et({ context: t, bitmapSize: i, horizontalPixelRatio: n, verticalPixelRatio: s }) {
    if (null === this.qt) return;
    const e2 = Math.max(1, Math.floor(n));
    t.lineWidth = e2, (function(t2, i2) {
      t2.save(), t2.lineWidth % 2 && t2.translate(0.5, 0.5), i2(), t2.restore();
    })(t, (() => {
      const r2 = u(this.qt);
      if (r2.yl) {
        t.strokeStyle = r2.kl, a(t, r2.Pl), t.beginPath();
        for (const s2 of r2.Tl) {
          const r3 = Math.round(s2.Rl * n);
          t.moveTo(r3, -e2), t.lineTo(r3, i.height + e2);
        }
        t.stroke();
      }
      if (r2.Dl) {
        t.strokeStyle = r2.Il, a(t, r2.Vl), t.beginPath();
        for (const n2 of r2.Bl) {
          const r3 = Math.round(n2.Rl * s);
          t.moveTo(-e2, r3), t.lineTo(i.width + e2, r3);
        }
        t.stroke();
      }
    }));
  }
}
class hi {
  constructor(t) {
    this.Xt = new ri(), this.xt = true, this.yt = t;
  }
  kt() {
    this.xt = true;
  }
  Tt() {
    if (this.xt) {
      const t = this.yt.Qt().N().grid, i = { Dl: t.horzLines.visible, yl: t.vertLines.visible, Il: t.horzLines.color, kl: t.vertLines.color, Vl: t.horzLines.style, Pl: t.vertLines.style, Bl: this.yt.Pn().El(), Tl: (this.yt.Qt().Et().El() || []).map(((t2) => ({ Rl: t2.coord }))) };
      this.Xt.ht(i), this.xt = false;
    }
    return this.Xt;
  }
}
class ai {
  constructor(t) {
    this.Yh = new hi(t);
  }
  wr() {
    return this.Yh;
  }
}
const li = { Al: 4, Ll: 1e-4 };
function oi(t, i) {
  const n = 100 * (t - i) / i;
  return i < 0 ? -n : n;
}
function _i(t, i) {
  const n = oi(t.Je(), i), s = oi(t.Qe(), i);
  return new mt(n, s);
}
function ui(t, i) {
  const n = 100 * (t - i) / i + 100;
  return i < 0 ? -n : n;
}
function ci(t, i) {
  const n = ui(t.Je(), i), s = ui(t.Qe(), i);
  return new mt(n, s);
}
function di(t, i) {
  const n = Math.abs(t);
  if (n < 1e-15) return 0;
  const s = Math.log10(n + i.Ll) + i.Al;
  return t < 0 ? -s : s;
}
function fi(t, i) {
  const n = Math.abs(t);
  if (n < 1e-15) return 0;
  const s = Math.pow(10, n - i.Al) - i.Ll;
  return t < 0 ? -s : s;
}
function pi(t, i) {
  if (null === t) return null;
  const n = di(t.Je(), i), s = di(t.Qe(), i);
  return new mt(n, s);
}
function vi(t, i) {
  if (null === t) return null;
  const n = fi(t.Je(), i), s = fi(t.Qe(), i);
  return new mt(n, s);
}
function mi(t) {
  if (null === t) return li;
  const i = Math.abs(t.Qe() - t.Je());
  if (i >= 1 || i < 1e-15) return li;
  const n = Math.ceil(Math.abs(Math.log10(i))), s = li.Al + n;
  return { Al: s, Ll: 1 / Math.pow(10, s) };
}
class wi {
  constructor(t, i) {
    if (this.zl = t, this.Ol = i, (function(t2) {
      if (t2 < 0) return false;
      if (t2 > 1e18) return true;
      for (let i2 = t2; i2 > 1; i2 /= 10) if (i2 % 10 != 0) return false;
      return true;
    })(this.zl)) this.Nl = [2, 2.5, 2];
    else {
      this.Nl = [];
      for (let t2 = this.zl; 1 !== t2; ) {
        if (t2 % 2 == 0) this.Nl.push(2), t2 /= 2;
        else {
          if (t2 % 5 != 0) throw new Error("unexpected base");
          this.Nl.push(2, 2.5), t2 /= 5;
        }
        if (this.Nl.length > 100) throw new Error("something wrong with base");
      }
    }
  }
  Fl(t, i, n) {
    const s = 0 === this.zl ? 0 : 1 / this.zl;
    let e2 = Math.pow(10, Math.max(0, Math.ceil(Math.log10(t - i)))), r2 = 0, h2 = this.Ol[0];
    for (; ; ) {
      const t2 = si(e2, s, 1e-14) && e2 > s + 1e-14, i2 = si(e2, n * h2, 1e-14), a3 = si(e2, 1, 1e-14);
      if (!(t2 && i2 && a3)) break;
      e2 /= h2, h2 = this.Ol[++r2 % this.Ol.length];
    }
    if (e2 <= s + 1e-14 && (e2 = s), e2 = Math.max(1, e2), this.Nl.length > 0 && (a2 = e2, l2 = 1, o2 = 1e-14, Math.abs(a2 - l2) < o2)) for (r2 = 0, h2 = this.Nl[0]; si(e2, n * h2, 1e-14) && e2 > s + 1e-14; ) e2 /= h2, h2 = this.Nl[++r2 % this.Nl.length];
    var a2, l2, o2;
    return e2;
  }
}
class Mi {
  constructor(t, i, n, s) {
    this.Wl = [], this.Ki = t, this.zl = i, this.Hl = n, this.Ul = s;
  }
  Fl(t, i) {
    if (t < i) throw new Error("high < low");
    const n = this.Ki.$t(), s = (t - i) * this.$l() / n, e2 = new wi(this.zl, [2, 2.5, 2]), r2 = new wi(this.zl, [2, 2, 2.5]), h2 = new wi(this.zl, [2.5, 2, 2]), a2 = [];
    return a2.push(e2.Fl(t, i, s), r2.Fl(t, i, s), h2.Fl(t, i, s)), (function(t2) {
      if (t2.length < 1) throw Error("array is empty");
      let i2 = t2[0];
      for (let n2 = 1; n2 < t2.length; ++n2) t2[n2] < i2 && (i2 = t2[n2]);
      return i2;
    })(a2);
  }
  jl() {
    const t = this.Ki, i = t.Lt();
    if (null === i) return void (this.Wl = []);
    const n = t.$t(), s = this.Hl(n - 1, i), e2 = this.Hl(0, i), r2 = this.Ki.N().entireTextOnly ? this.ql() / 2 : 0, h2 = r2, a2 = n - 1 - r2, l2 = Math.max(s, e2), o2 = Math.min(s, e2);
    if (l2 === o2) return void (this.Wl = []);
    const _2 = this.Fl(l2, o2);
    if (this.Yl(i, _2, l2, o2, h2, a2), t.Kl() && this.Zl(_2, o2, l2)) {
      const t2 = this.Ki.Gl();
      this.Xl(i, _2, h2, a2, t2, 2 * t2);
    }
    const u2 = this.Wl.map(((t2) => t2.Jl)), c2 = this.Ki.Ql(u2);
    for (let t2 = 0; t2 < this.Wl.length; t2++) this.Wl[t2].io = c2[t2];
  }
  El() {
    return this.Wl;
  }
  ql() {
    return this.Ki.k();
  }
  $l() {
    return Math.ceil(this.ql() * this.Ki.N().tickMarkDensity);
  }
  Yl(t, i, n, s, e2, r2) {
    const h2 = this.Wl, a2 = this.Ki;
    let l2 = n % i;
    l2 += l2 < 0 ? i : 0;
    const o2 = n >= s ? 1 : -1;
    let _2 = null, u2 = 0;
    for (let c2 = n - l2; c2 > s; c2 -= i) {
      const n2 = this.Ul(c2, t, true);
      null !== _2 && Math.abs(n2 - _2) < this.$l() || (n2 < e2 || n2 > r2 || (u2 < h2.length ? (h2[u2].Rl = n2, h2[u2].io = a2.no(c2), h2[u2].Jl = c2) : h2.push({ Rl: n2, io: a2.no(c2), Jl: c2 }), u2++, _2 = n2, a2.so() && (i = this.Fl(c2 * o2, s))));
    }
    h2.length = u2;
  }
  Xl(t, i, n, s, e2, r2) {
    const h2 = this.Wl, a2 = this.eo(t, n, e2, r2), l2 = this.eo(t, s, -r2, -e2), o2 = this.Ul(0, t, true) - this.Ul(i, t, true);
    h2.length > 0 && h2[0].Rl - a2.Rl < o2 / 2 && h2.shift(), h2.length > 0 && l2.Rl - h2[h2.length - 1].Rl < o2 / 2 && h2.pop(), h2.unshift(a2), h2.push(l2);
  }
  eo(t, i, n, s) {
    const e2 = (n + s) / 2, r2 = this.Hl(i + n, t), h2 = this.Hl(i + s, t), a2 = Math.min(r2, h2), l2 = Math.max(r2, h2), o2 = Math.max(0.1, this.Fl(l2, a2)), _2 = this.Hl(i + e2, t), u2 = _2 - _2 % o2, c2 = this.Ul(u2, t, true);
    return { io: this.Ki.no(u2), Rl: c2, Jl: u2 };
  }
  Zl(t, i, n) {
    let s = c(this.Ki.ar());
    return this.Ki.so() && (s = vi(s, this.Ki.ro())), s.Je() - i < t && n - s.Qe() < t;
  }
}
function gi(t) {
  return t.slice().sort(((t2, i) => u(t2.ln()) - u(i.ln())));
}
var bi;
!(function(t) {
  t[t.Normal = 0] = "Normal", t[t.Logarithmic = 1] = "Logarithmic", t[t.Percentage = 2] = "Percentage", t[t.IndexedTo100 = 3] = "IndexedTo100";
})(bi || (bi = {}));
const Si = new nt(), xi = new it(100, 1);
class Ci {
  constructor(t, i, n, s, e2) {
    this.ho = 0, this.ao = null, this.rr = null, this.lo = null, this.oo = { _o: false, uo: null }, this.co = false, this.do = 0, this.fo = 0, this.po = new d(), this.vo = new d(), this.mo = [], this.wo = null, this.Mo = null, this.bo = null, this.So = null, this.xo = null, this.il = xi, this.Co = mi(null), this.yo = t, this.yn = i, this.ko = n, this.Po = s, this.To = e2, this.Ro = new Mi(this, 100, this.Do.bind(this), this.Io.bind(this));
  }
  cl() {
    return this.yo;
  }
  N() {
    return this.yn;
  }
  vr(t) {
    if (f(this.yn, t), this.dl(), void 0 !== t.mode && this.Vo({ _e: t.mode }), void 0 !== t.scaleMargins) {
      const i = _(t.scaleMargins.top), n = _(t.scaleMargins.bottom);
      if (i < 0 || i > 1) throw new Error(`Invalid top margin - expect value between 0 and 1, given=${i}`);
      if (n < 0 || n > 1) throw new Error(`Invalid bottom margin - expect value between 0 and 1, given=${n}`);
      if (i + n > 1) throw new Error(`Invalid margins - sum of margins must be less than 1, given=${i + n}`);
      this.Bo(), this.bo = null;
    }
  }
  Eo() {
    return this.yn.autoScale;
  }
  Ao() {
    return this.co;
  }
  so() {
    return 1 === this.yn.mode;
  }
  je() {
    return 2 === this.yn.mode;
  }
  Lo() {
    return 3 === this.yn.mode;
  }
  ro() {
    return this.Co;
  }
  _e() {
    return { hs: this.yn.autoScale, zo: this.yn.invertScale, _e: this.yn.mode };
  }
  Vo(t) {
    const i = this._e();
    let n = null;
    void 0 !== t.hs && (this.yn.autoScale = t.hs), void 0 !== t._e && (this.yn.mode = t._e, 2 !== t._e && 3 !== t._e || (this.yn.autoScale = true), this.oo._o = false), 1 === i._e && t._e !== i._e && (!(function(t2, i2) {
      if (null === t2) return false;
      const n2 = fi(t2.Je(), i2), s2 = fi(t2.Qe(), i2);
      return isFinite(n2) && isFinite(s2);
    })(this.rr, this.Co) ? this.yn.autoScale = true : (n = vi(this.rr, this.Co), null !== n && this.Oo(n))), 1 === t._e && t._e !== i._e && (n = pi(this.rr, this.Co), null !== n && this.Oo(n));
    const s = i._e !== this.yn.mode;
    s && (2 === i._e || this.je()) && this.dl(), s && (3 === i._e || this.Lo()) && this.dl(), void 0 !== t.zo && i.zo !== t.zo && (this.yn.invertScale = t.zo, this.No()), this.vo.p(i, this._e());
  }
  Fo() {
    return this.vo;
  }
  k() {
    return this.ko.fontSize;
  }
  $t() {
    return this.ho;
  }
  Wo(t) {
    this.ho !== t && (this.ho = t, this.Bo(), this.bo = null);
  }
  Ho() {
    if (this.ao) return this.ao;
    const t = this.$t() - this.Uo() - this.$o();
    return this.ao = t, t;
  }
  ar() {
    return this.jo(), this.rr;
  }
  Oo(t, i) {
    const n = this.rr;
    (i || null === n && null !== t || null !== n && !n.Ge(t)) && (this.bo = null, this.rr = t);
  }
  qo(t) {
    this.Oo(t), this.Yo(null !== t);
  }
  Gi() {
    return this.jo(), 0 === this.ho || !this.rr || this.rr.Gi();
  }
  Ko(t) {
    return this.zo() ? t : this.$t() - 1 - t;
  }
  Nt(t, i) {
    return this.je() ? t = oi(t, i) : this.Lo() && (t = ui(t, i)), this.Io(t, i);
  }
  Zo(t, i, n) {
    this.jo();
    const s = this.$o(), e2 = u(this.ar()), r2 = e2.Je(), h2 = e2.Qe(), a2 = this.Ho() - 1, l2 = this.zo(), o2 = a2 / (h2 - r2), _2 = void 0 === n ? 0 : n.from, c2 = void 0 === n ? t.length : n.to, d2 = this.Go();
    for (let n2 = _2; n2 < c2; n2++) {
      const e3 = t[n2], h3 = e3.Mt;
      if (isNaN(h3)) continue;
      let a3 = h3;
      null !== d2 && (a3 = d2(e3.Mt, i));
      const _3 = s + o2 * (a3 - r2), u2 = l2 ? _3 : this.ho - 1 - _3;
      e3.ut = u2;
    }
  }
  Xo(t, i, n) {
    this.jo();
    const s = this.$o(), e2 = u(this.ar()), r2 = e2.Je(), h2 = e2.Qe(), a2 = this.Ho() - 1, l2 = this.zo(), o2 = a2 / (h2 - r2), _2 = void 0 === n ? 0 : n.from, c2 = void 0 === n ? t.length : n.to, d2 = this.Go();
    for (let n2 = _2; n2 < c2; n2++) {
      const e3 = t[n2];
      let h3 = e3.jr, a3 = e3.qr, _3 = e3.Yr, u2 = e3.Kr;
      null !== d2 && (h3 = d2(e3.jr, i), a3 = d2(e3.qr, i), _3 = d2(e3.Yr, i), u2 = d2(e3.Kr, i));
      let c3 = s + o2 * (h3 - r2), f2 = l2 ? c3 : this.ho - 1 - c3;
      e3.Jo = f2, c3 = s + o2 * (a3 - r2), f2 = l2 ? c3 : this.ho - 1 - c3, e3.Qo = f2, c3 = s + o2 * (_3 - r2), f2 = l2 ? c3 : this.ho - 1 - c3, e3.t_ = f2, c3 = s + o2 * (u2 - r2), f2 = l2 ? c3 : this.ho - 1 - c3, e3.i_ = f2;
    }
  }
  Tn(t, i) {
    const n = this.Do(t, i);
    return this.n_(n, i);
  }
  n_(t, i) {
    let n = t;
    return this.je() ? n = (function(t2, i2) {
      return i2 < 0 && (t2 = -t2), t2 / 100 * i2 + i2;
    })(n, i) : this.Lo() && (n = (function(t2, i2) {
      return t2 -= 100, i2 < 0 && (t2 = -t2), t2 / 100 * i2 + i2;
    })(n, i)), n;
  }
  Cl() {
    return this.mo;
  }
  Dt() {
    return this.Mo || (this.Mo = gi(this.mo)), this.Mo;
  }
  s_(t) {
    -1 === this.mo.indexOf(t) && (this.mo.push(t), this.dl(), this.e_());
  }
  r_(t) {
    const i = this.mo.indexOf(t);
    if (-1 === i) throw new Error("source is not attached to scale");
    this.mo.splice(i, 1), 0 === this.mo.length && (this.Vo({ hs: true }), this.Oo(null)), this.dl(), this.e_();
  }
  Lt() {
    let t = null;
    for (const i of this.mo) {
      const n = i.Lt();
      null !== n && ((null === t || n.za < t.za) && (t = n));
    }
    return null === t ? null : t.Wt;
  }
  zo() {
    return this.yn.invertScale;
  }
  El() {
    const t = null === this.Lt();
    if (null !== this.bo && (t || this.bo.h_ === t)) return this.bo.El;
    this.Ro.jl();
    const i = this.Ro.El();
    return this.bo = { El: i, h_: t }, this.po.p(), i;
  }
  a_() {
    return this.po;
  }
  l_(t) {
    this.je() || this.Lo() || null === this.So && null === this.lo && (this.Gi() || (this.So = this.ho - t, this.lo = u(this.ar()).Xe()));
  }
  o_(t) {
    if (this.je() || this.Lo()) return;
    if (null === this.So) return;
    this.Vo({ hs: false }), (t = this.ho - t) < 0 && (t = 0);
    let i = (this.So + 0.2 * (this.ho - 1)) / (t + 0.2 * (this.ho - 1));
    const n = u(this.lo).Xe();
    i = Math.max(i, 0.1), n.ir(i), this.Oo(n);
  }
  __() {
    this.je() || this.Lo() || (this.So = null, this.lo = null);
  }
  u_(t) {
    this.Eo() || null === this.xo && null === this.lo && (this.Gi() || (this.xo = t, this.lo = u(this.ar()).Xe()));
  }
  c_(t) {
    if (this.Eo()) return;
    if (null === this.xo) return;
    const i = u(this.ar()).tr() / (this.Ho() - 1);
    let n = t - this.xo;
    this.zo() && (n *= -1);
    const s = n * i, e2 = u(this.lo).Xe();
    e2.nr(s), this.Oo(e2, true), this.bo = null;
  }
  d_() {
    this.Eo() || null !== this.xo && (this.xo = null, this.lo = null);
  }
  tl() {
    return this.il || this.dl(), this.il;
  }
  Ji(t, i) {
    switch (this.yn.mode) {
      case 2:
        return this.f_(oi(t, i));
      case 3:
        return this.tl().format(ui(t, i));
      default:
        return this.cr(t);
    }
  }
  no(t) {
    switch (this.yn.mode) {
      case 2:
        return this.f_(t);
      case 3:
        return this.tl().format(t);
      default:
        return this.cr(t);
    }
  }
  Ql(t) {
    switch (this.yn.mode) {
      case 2:
        return this.p_(t);
      case 3:
        return this.tl().formatTickmarks(t);
      default:
        return this.v_(t);
    }
  }
  xa(t) {
    return this.cr(t, u(this.wo).tl());
  }
  Ca(t, i) {
    return t = oi(t, i), this.f_(t, Si);
  }
  m_() {
    return this.mo;
  }
  w_(t) {
    this.oo = { uo: t, _o: false };
  }
  Nn() {
    this.mo.forEach(((t) => t.Nn()));
  }
  Kl() {
    return this.yn.ensureEdgeTickMarksVisible && this.Eo();
  }
  Gl() {
    return this.k() / 2;
  }
  dl() {
    this.bo = null;
    let t = 1 / 0;
    this.wo = null;
    for (const i2 of this.mo) i2.ln() < t && (t = i2.ln(), this.wo = i2);
    let i = 100;
    null !== this.wo && (i = Math.round(this.wo.Kh())), this.il = xi, this.je() ? (this.il = Si, i = 100) : this.Lo() ? (this.il = new it(100, 1), i = 100) : null !== this.wo && (this.il = this.wo.tl()), this.Ro = new Mi(this, i, this.Do.bind(this), this.Io.bind(this)), this.Ro.jl();
  }
  e_() {
    this.Mo = null;
  }
  M_() {
    return null === this.wo || this.je() || this.Lo() ? 1 : 1 / this.wo.Kh();
  }
  Xi() {
    return this.To;
  }
  Yo(t) {
    this.co = t;
  }
  Uo() {
    return this.zo() ? this.yn.scaleMargins.bottom * this.$t() + this.fo : this.yn.scaleMargins.top * this.$t() + this.do;
  }
  $o() {
    return this.zo() ? this.yn.scaleMargins.top * this.$t() + this.do : this.yn.scaleMargins.bottom * this.$t() + this.fo;
  }
  jo() {
    this.oo._o || (this.oo._o = true, this.g_());
  }
  Bo() {
    this.ao = null;
  }
  Io(t, i) {
    if (this.jo(), this.Gi()) return 0;
    t = this.so() && t ? di(t, this.Co) : t;
    const n = u(this.ar()), s = this.$o() + (this.Ho() - 1) * (t - n.Je()) / n.tr();
    return this.Ko(s);
  }
  Do(t, i) {
    if (this.jo(), this.Gi()) return 0;
    const n = this.Ko(t), s = u(this.ar()), e2 = s.Je() + s.tr() * ((n - this.$o()) / (this.Ho() - 1));
    return this.so() ? fi(e2, this.Co) : e2;
  }
  No() {
    this.bo = null, this.Ro.jl();
  }
  g_() {
    if (this.Ao() && !this.Eo()) return;
    const t = this.oo.uo;
    if (null === t) return;
    let i = null;
    const n = this.m_();
    let s = 0, e2 = 0;
    for (const r3 of n) {
      if (!r3.It()) continue;
      const n2 = r3.Lt();
      if (null === n2) continue;
      const h3 = r3.la(t.Oa(), t.bi());
      let a2 = h3 && h3.ar();
      if (null !== a2) {
        switch (this.yn.mode) {
          case 1:
            a2 = pi(a2, this.Co);
            break;
          case 2:
            a2 = _i(a2, n2.Wt);
            break;
          case 3:
            a2 = ci(a2, n2.Wt);
        }
        if (i = null === i ? a2 : i.Ss(u(a2)), null !== h3) {
          const t2 = h3.lr();
          null !== t2 && (s = Math.max(s, t2.above), e2 = Math.max(e2, t2.below));
        }
      }
    }
    if (this.Kl() && (s = Math.max(s, this.Gl()), e2 = Math.max(e2, this.Gl())), s === this.do && e2 === this.fo || (this.do = s, this.fo = e2, this.bo = null, this.Bo()), null !== i) {
      if (i.Je() === i.Qe()) {
        const t2 = 5 * this.M_();
        this.so() && (i = vi(i, this.Co)), i = new mt(i.Je() - t2, i.Qe() + t2), this.so() && (i = pi(i, this.Co));
      }
      if (this.so()) {
        const t2 = vi(i, this.Co), n2 = mi(t2);
        if (r2 = n2, h2 = this.Co, r2.Al !== h2.Al || r2.Ll !== h2.Ll) {
          const s2 = null !== this.lo ? vi(this.lo, this.Co) : null;
          this.Co = n2, i = pi(t2, n2), null !== s2 && (this.lo = pi(s2, n2));
        }
      }
      this.Oo(i);
    } else null === this.rr && (this.Oo(new mt(-0.5, 0.5)), this.Co = mi(null));
    var r2, h2;
  }
  Go() {
    return this.je() ? oi : this.Lo() ? ui : this.so() ? (t) => di(t, this.Co) : null;
  }
  b_(t, i, n) {
    return void 0 === i ? (void 0 === n && (n = this.tl()), n.format(t)) : i(t);
  }
  S_(t, i, n) {
    return void 0 === i ? (void 0 === n && (n = this.tl()), n.formatTickmarks(t)) : i(t);
  }
  cr(t, i) {
    return this.b_(t, this.Po.priceFormatter, i);
  }
  v_(t, i) {
    const n = this.Po.priceFormatter;
    return this.S_(t, this.Po.tickmarksPriceFormatter ?? (n ? (t2) => t2.map(n) : void 0), i);
  }
  f_(t, i) {
    return this.b_(t, this.Po.percentageFormatter, i);
  }
  p_(t, i) {
    const n = this.Po.percentageFormatter;
    return this.S_(t, this.Po.tickmarksPercentageFormatter ?? (n ? (t2) => t2.map(n) : void 0), i);
  }
}
function yi(t) {
  return t instanceof Jt;
}
class ki {
  constructor(t, i) {
    this.mo = [], this.x_ = /* @__PURE__ */ new Map(), this.ho = 0, this.C_ = 0, this.y_ = 1, this.Mo = null, this.k_ = null, this.P_ = false, this.T_ = new d(), this.fa = [], this.ia = t, this.sn = i, this.R_ = new ai(this);
    const n = i.N();
    this.D_ = this.I_("left", n.leftPriceScale), this.V_ = this.I_("right", n.rightPriceScale), this.D_.Fo().i(this.B_.bind(this, this.D_), this), this.V_.Fo().i(this.B_.bind(this, this.V_), this), this.E_(n);
  }
  E_(t) {
    if (t.leftPriceScale && this.D_.vr(t.leftPriceScale), t.rightPriceScale && this.V_.vr(t.rightPriceScale), t.localization && (this.D_.dl(), this.V_.dl()), t.overlayPriceScales) {
      const i = Array.from(this.x_.values());
      for (const n of i) {
        const i2 = u(n[0].Ft());
        i2.vr(t.overlayPriceScales), t.localization && i2.dl();
      }
    }
  }
  A_(t) {
    switch (t) {
      case "left":
        return this.D_;
      case "right":
        return this.V_;
    }
    return this.x_.has(t) ? _(this.x_.get(t))[0].Ft() : null;
  }
  m() {
    this.Qt().L_().u(this), this.D_.Fo().u(this), this.V_.Fo().u(this), this.mo.forEach(((t) => {
      t.m && t.m();
    })), this.fa = this.fa.filter(((t) => {
      const i = t.Qh();
      return i.detached && i.detached(), false;
    })), this.T_.p();
  }
  z_() {
    return this.y_;
  }
  O_(t) {
    this.y_ = t;
  }
  Qt() {
    return this.sn;
  }
  nn() {
    return this.C_;
  }
  $t() {
    return this.ho;
  }
  N_(t) {
    this.C_ = t, this.F_();
  }
  Wo(t) {
    this.ho = t, this.D_.Wo(t), this.V_.Wo(t), this.mo.forEach(((i) => {
      if (this.Zs(i)) {
        const n = i.Ft();
        null !== n && n.Wo(t);
      }
    })), this.F_();
  }
  W_(t) {
    this.P_ = t;
  }
  H_() {
    return this.P_;
  }
  U_() {
    return this.mo.filter(yi);
  }
  Cl() {
    return this.mo;
  }
  Zs(t) {
    const i = t.Ft();
    return null === i || this.D_ !== i && this.V_ !== i;
  }
  s_(t, i, n) {
    this.j_(t, i, n ? t.ln() : this.mo.length);
  }
  r_(t, i) {
    const n = this.mo.indexOf(t);
    o(-1 !== n, "removeDataSource: invalid data source"), this.mo.splice(n, 1), i || this.mo.forEach(((t2, i2) => t2._n(i2)));
    const s = u(t.Ft()).cl();
    if (this.x_.has(s)) {
      const i2 = _(this.x_.get(s)), n2 = i2.indexOf(t);
      -1 !== n2 && (i2.splice(n2, 1), 0 === i2.length && this.x_.delete(s));
    }
    const e2 = t.Ft();
    e2 && e2.Cl().indexOf(t) >= 0 && (e2.r_(t), this.q_(e2)), this.Y_();
  }
  Xs(t) {
    return t === this.D_ ? "left" : t === this.V_ ? "right" : "overlay";
  }
  K_() {
    return this.D_;
  }
  Z_() {
    return this.V_;
  }
  G_(t, i) {
    t.l_(i);
  }
  X_(t, i) {
    t.o_(i), this.F_();
  }
  J_(t) {
    t.__();
  }
  Q_(t, i) {
    t.u_(i);
  }
  tu(t, i) {
    t.c_(i), this.F_();
  }
  iu(t) {
    t.d_();
  }
  F_() {
    this.mo.forEach(((t) => {
      t.Nn();
    }));
  }
  Pn() {
    const [t, i] = this.nu();
    let n = null;
    return t.N().visible && 0 !== t.Cl().length ? n = t : i.N().visible && 0 !== i.Cl().length ? n = i : 0 !== this.mo.length && (n = this.mo[0].Ft()), null === n && (n = this.Gs() ?? t), n;
  }
  Gs() {
    const [t, i] = this.nu();
    return t.N().visible ? t : i.N().visible ? i : null;
  }
  q_(t) {
    null !== t && t.Eo() && this.su(t);
  }
  eu(t) {
    const i = this.ia.Ee();
    t.Vo({ hs: true }), null !== i && t.w_(i), this.F_();
  }
  ru() {
    this.su(this.D_), this.su(this.V_);
  }
  hu() {
    this.q_(this.D_), this.q_(this.V_), this.mo.forEach(((t) => {
      this.Zs(t) && this.q_(t.Ft());
    })), this.F_(), this.sn.mr();
  }
  Dt() {
    return null === this.Mo && (this.Mo = gi(this.mo)), this.Mo;
  }
  au() {
    const t = this.Dt(), i = this.sn.ou()?.lu, n = this.sn.N().hoveredSeriesOnTop, s = this.k_;
    if (null !== s && s.Kh === t && s._u === i && s.uu === n) return s.cu;
    const e2 = (function(t2, i2, n2) {
      if (!n2) return t2;
      const s2 = t2.indexOf(i2);
      if (-1 === s2 || s2 === t2.length - 1) return t2;
      const e3 = [];
      for (let i3 = 0; i3 < t2.length; i3++) i3 !== s2 && e3.push(t2[i3]);
      return e3.push(t2[s2]), e3;
    })(t, i, n);
    return this.k_ = { Kh: t, _u: i, uu: n, cu: e2 }, e2;
  }
  du(t, i) {
    i = ni(i, 0, this.mo.length - 1);
    const n = this.mo.indexOf(t);
    o(-1 !== n, "setSeriesOrder: invalid data source"), this.mo.splice(n, 1), this.mo.splice(i, 0, t), this.mo.forEach(((t2, i2) => t2._n(i2))), this.Y_();
    for (const t2 of [this.D_, this.V_]) t2.e_(), t2.dl();
    this.sn.mr();
  }
  Vt() {
    return this.Dt().filter(yi);
  }
  fu() {
    return this.T_;
  }
  pu() {
    return this.R_;
  }
  hl(t) {
    this.fa.push(new Ft(t));
  }
  al(t) {
    this.fa = this.fa.filter(((i) => i.Qh() !== t)), t.detached && t.detached(), this.sn.mr();
  }
  vu() {
    return this.fa;
  }
  Ja(t, i) {
    return this.fa.map(((n) => n.Qs(t, i))).filter(((t2) => null !== t2));
  }
  su(t) {
    const i = t.m_();
    if (i && i.length > 0 && !this.ia.Gi()) {
      const i2 = this.ia.Ee();
      null !== i2 && t.w_(i2);
    }
    t.Nn();
  }
  j_(t, i, n) {
    let s = this.A_(i);
    if (null === s && (s = this.I_(i, this.sn.N().overlayPriceScales)), this.mo.splice(n, 0, t), !G(i)) {
      const n2 = this.x_.get(i) || [];
      n2.push(t), this.x_.set(i, n2);
    }
    t._n(n), s.s_(t), t.un(s), this.q_(s), this.Y_();
  }
  Y_() {
    this.Mo = null, this.k_ = null;
  }
  nu() {
    return "left" === this.sn.N().defaultVisiblePriceScaleId ? [this.D_, this.V_] : [this.V_, this.D_];
  }
  B_(t, i, n) {
    i._e !== n._e && this.su(t);
  }
  I_(t, i) {
    const n = { visible: true, autoScale: true, ...M(i) }, s = new Ci(t, n, this.sn.N().layout, this.sn.N().localization, this.sn.Xi());
    return s.Wo(this.$t()), s;
  }
}
function Pi(t, i) {
  return null === i || (2 === t.se && 2 !== i.se || (2 !== i.se || 2 === t.se) && (t.ne !== i.ne && t.ne < i.ne));
}
function Ti(t) {
  return { te: t.te, ie: t.ie };
}
function Ri(t) {
  return { ne: t.distance ?? 0, se: t.hitTestPriority ?? ("marker" === t.itemType ? 2 : 0), ee: t.itemType ?? "primitive", mu: t.cursorStyle, te: t.externalId };
}
function Di(t) {
  return { lu: t.lu, wu: Ti(t.Mu), mu: t.Mu.mu, ee: t.Mu.ee ?? "primitive" };
}
function Ii(t, i, n, s) {
  let e2 = null;
  for (const r2 of t) {
    let t2 = r2.Qs?.(i, n, s) ?? null;
    if (null === t2) {
      const e3 = r2.Tt(s);
      t2 = null !== e3 && e3.Qs ? e3.Qs(i, n) : null;
    }
    if (null !== t2) {
      const i2 = { gu: r2, Mu: t2 };
      (null === e2 || Pi(i2.Mu, e2.Mu)) && (e2 = i2);
    }
  }
  return e2;
}
function Vi(t) {
  return void 0 !== t.jn;
}
function Bi(t, i, n) {
  const s = [t, ...t.Dt()].reverse(), e2 = (function(t2, i2, n2) {
    let s2, e3, r3;
    for (const l2 of t2) {
      const t3 = l2.Ja?.(i2, n2) ?? [];
      for (const i3 of t3) {
        const t4 = Ri(i3);
        h3 = i3.zOrder, a2 = s2?.zOrder, (!a2 || "top" === h3 && "top" !== a2 || "normal" === h3 && "bottom" === a2 || i3.zOrder === s2?.zOrder && void 0 !== e3 && Pi(t4, e3) || i3.zOrder === s2?.zOrder && void 0 === e3) && (s2 = i3, e3 = t4, r3 = l2);
      }
    }
    var h3, a2;
    return s2 && r3 && e3 ? { Mu: e3, bu: s2, lu: r3 } : null;
  })(s, i, n);
  if ("top" === e2?.bu.zOrder) return Di(e2);
  let r2 = null, h2 = null;
  for (const a2 of s) {
    if (e2 && e2.lu === a2 && "bottom" !== e2.bu.zOrder && !e2.bu.isBackground) return r2 ?? Di(e2);
    if (Vi(a2)) {
      const s2 = Ii(a2.jn(t), i, n, t);
      if (null !== s2) {
        const t2 = { lu: a2, gu: s2.gu, wu: Ti(s2.Mu), mu: s2.Mu.mu, ee: s2.Mu.ee ?? "primitive" };
        (null === r2 || Pi(s2.Mu, h2)) && (r2 = t2, h2 = s2.Mu);
      }
    }
    if (e2 && e2.lu === a2 && "bottom" !== e2.bu.zOrder && e2.bu.isBackground) return r2 ?? Di(e2);
  }
  return null !== r2 ? r2 : e2?.bu ? Di(e2) : null;
}
class Ei {
  constructor(t, i, n = 50) {
    this.Vs = 0, this.Bs = 1, this.Es = 1, this.Ls = /* @__PURE__ */ new Map(), this.As = /* @__PURE__ */ new Map(), this.Su = t, this.xu = i, this.zs = n;
  }
  Cu(t) {
    const i = t.time, n = this.xu.cacheKey(i), s = this.Ls.get(n);
    if (void 0 !== s) return s.yu;
    if (this.Vs === this.zs) {
      const t2 = this.As.get(this.Es);
      this.As.delete(this.Es), this.Ls.delete(_(t2)), this.Es++, this.Vs--;
    }
    const e2 = this.Su(t);
    return this.Ls.set(n, { yu: e2, Ws: this.Bs }), this.As.set(this.Bs, n), this.Vs++, this.Bs++, e2;
  }
}
class Ai {
  constructor(t, i) {
    o(t <= i, "right should be >= left"), this.ku = t, this.Pu = i;
  }
  Oa() {
    return this.ku;
  }
  bi() {
    return this.Pu;
  }
  Tu() {
    return this.Pu - this.ku + 1;
  }
  ze(t) {
    return this.ku <= t && t <= this.Pu;
  }
  Ge(t) {
    return this.ku === t.Oa() && this.Pu === t.bi();
  }
}
function Li(t, i) {
  return null === t || null === i ? t === i : t.Ge(i);
}
class zi {
  constructor() {
    this.Ru = /* @__PURE__ */ new Map(), this.Ls = null, this.Du = false;
  }
  Iu(t) {
    this.Du = t, this.Ls = null;
  }
  Vu(t, i) {
    this.Bu(i), this.Ls = null;
    for (let n = i; n < t.length; ++n) {
      const i2 = t[n];
      let s = this.Ru.get(i2.timeWeight);
      void 0 === s && (s = [], this.Ru.set(i2.timeWeight, s)), s.push({ index: n, time: i2.time, weight: i2.timeWeight, originalTime: i2.originalTime });
    }
  }
  Eu(t, i, n, s, e2) {
    const r2 = Math.ceil(i / t);
    return null !== this.Ls && this.Ls.Au === r2 && e2 === this.Ls.Lu && n === this.Ls.zu || (this.Ls = { Lu: e2, zu: n, El: this.Ou(r2, n, s), Au: r2 }), this.Ls.El;
  }
  Bu(t) {
    if (0 === t) return void this.Ru.clear();
    const i = [];
    this.Ru.forEach(((n, s) => {
      t <= n[0].index ? i.push(s) : n.splice(Rt(n, t, ((i2) => i2.index < t)), 1 / 0);
    }));
    for (const t2 of i) this.Ru.delete(t2);
  }
  Ou(t, i, n) {
    let s = [];
    const e2 = (t2) => !i || n.has(t2.index);
    for (const i2 of Array.from(this.Ru.keys()).sort(((t2, i3) => i3 - t2))) {
      if (!this.Ru.get(i2)) continue;
      const n2 = s;
      s = [];
      const r2 = n2.length;
      let h2 = 0;
      const a2 = _(this.Ru.get(i2)), l2 = a2.length;
      let o2 = 1 / 0, u2 = -1 / 0;
      for (let i3 = 0; i3 < l2; i3++) {
        const l3 = a2[i3], _2 = l3.index;
        for (; h2 < r2; ) {
          const t2 = n2[h2], i4 = t2.index;
          if (!(i4 < _2 && e2(t2))) {
            o2 = i4;
            break;
          }
          h2++, s.push(t2), u2 = i4, o2 = 1 / 0;
        }
        if (o2 - _2 >= t && _2 - u2 >= t && e2(l3)) s.push(l3), u2 = _2;
        else if (this.Du) return n2;
      }
      for (; h2 < r2; h2++) e2(n2[h2]) && s.push(n2[h2]);
    }
    return s;
  }
}
class Oi {
  constructor(t) {
    this.Nu = t;
  }
  Fu() {
    return null === this.Nu ? null : new Ai(Math.floor(this.Nu.Oa()), Math.ceil(this.Nu.bi()));
  }
  Wu() {
    return this.Nu;
  }
  static Hu() {
    return new Oi(null);
  }
}
function Ni(t, i) {
  return t.weight > i.weight ? t : i;
}
class Fi {
  constructor(t, i, n, s) {
    this.C_ = 0, this.Uu = null, this.$u = [], this.xo = null, this.So = null, this.ju = new zi(), this.qu = /* @__PURE__ */ new Map(), this.Yu = Oi.Hu(), this.Ku = true, this.Zu = new d(), this.Gu = new d(), this.Xu = new d(), this.Ju = null, this.Qu = null, this.tc = /* @__PURE__ */ new Map(), this.nc = -1, this.sc = [], this.ec = 1, this.yn = i, this.Po = n, this.rc = i.rightOffset, this.hc = i.barSpacing, this.sn = t, this.ac(i), this.xu = s, this.lc(), this.ju.Iu(i.uniformDistribution), this.oc(), this._c();
  }
  N() {
    return this.yn;
  }
  uc(t) {
    f(this.Po, t), this.cc(), this.lc();
  }
  vr(t, i) {
    f(this.yn, t), this.yn.fixLeftEdge && this.dc(), this.yn.fixRightEdge && this.fc(), void 0 !== t.barSpacing && this.sn.Ms(t.barSpacing), void 0 !== t.rightOffset && this.sn.gs(t.rightOffset), this.ac(t), void 0 === t.minBarSpacing && void 0 === t.maxBarSpacing || this.sn.Ms(t.barSpacing ?? this.hc), void 0 !== t.ignoreWhitespaceIndices && t.ignoreWhitespaceIndices !== this.yn.ignoreWhitespaceIndices && this._c(), this.cc(), this.lc(), void 0 === t.enableConflation && void 0 === t.conflationThresholdFactor || this.oc(), this.Xu.p();
  }
  Rn(t) {
    return this.$u[t]?.time ?? null;
  }
  en(t) {
    return this.$u[t] ?? null;
  }
  vc(t, i) {
    if (this.$u.length < 1) return null;
    if (this.xu.key(t) > this.xu.key(this.$u[this.$u.length - 1].time)) return i ? this.$u.length - 1 : null;
    const n = Rt(this.$u, this.xu.key(t), ((t2, i2) => this.xu.key(t2.time) < i2));
    return this.xu.key(t) < this.xu.key(this.$u[n].time) ? i ? n : null : n;
  }
  Gi() {
    return 0 === this.C_ || 0 === this.$u.length || null === this.Uu;
  }
  mc() {
    return this.$u.length > 0;
  }
  Ee() {
    return this.wc(), this.Yu.Fu();
  }
  Mc() {
    return this.wc(), this.Yu.Wu();
  }
  gc() {
    const t = this.Ee();
    if (null === t) return null;
    const i = { from: t.Oa(), to: t.bi() };
    return this.bc(i);
  }
  bc(t) {
    const i = Math.round(t.from), n = Math.round(t.to), s = u(this.Sc()), e2 = u(this.xc());
    return { from: u(this.en(Math.max(s, i))), to: u(this.en(Math.min(e2, n))) };
  }
  Cc(t) {
    return { from: u(this.vc(t.from, true)), to: u(this.vc(t.to, true)) };
  }
  nn() {
    return this.C_;
  }
  N_(t) {
    if (!isFinite(t) || t <= 0) return;
    if (this.C_ === t) return;
    const i = this.Mc(), n = this.C_;
    if (this.C_ = t, this.Ku = true, this.yn.lockVisibleTimeRangeOnResize && 0 !== n) {
      const i2 = this.hc * t / n;
      this.hc = i2;
    }
    if (this.yn.fixLeftEdge && null !== i && i.Oa() <= 0) {
      const i2 = n - t;
      this.rc -= Math.round(i2 / this.hc) + 1, this.Ku = true;
    }
    this.yc(), this.kc();
  }
  jt(t) {
    if (this.Gi() || !v(t)) return 0;
    const i = this.Pc() + this.rc - t;
    return this.C_ - (i + 0.5) * this.hc - 1;
  }
  Tc(t, i) {
    const n = this.Pc(), s = void 0 === i ? 0 : i.from, e2 = void 0 === i ? t.length : i.to;
    for (let i2 = s; i2 < e2; i2++) {
      const s2 = t[i2].wt, e3 = n + this.rc - s2, r2 = this.C_ - (e3 + 0.5) * this.hc - 1;
      t[i2]._t = r2;
    }
  }
  Rc(t, i) {
    const n = Math.ceil(this.Dc(t));
    return i && this.yn.ignoreWhitespaceIndices && !this.Ic(n) ? this.Vc(n) : n;
  }
  gs(t) {
    this.Ku = true, this.rc = t, this.kc(), this.sn.Bc(), this.sn.mr();
  }
  fl() {
    return this.hc;
  }
  Ms(t) {
    const i = this.hc;
    if (this.Ec(t), void 0 !== this.yn.rightOffsetPixels && 0 !== i) {
      const t2 = this.rc * i / this.hc;
      this.rc = t2;
    }
    this.kc(), this.sn.Bc(), this.sn.mr();
  }
  Ac() {
    return this.rc;
  }
  El() {
    if (this.Gi()) return null;
    if (null !== this.Qu) return this.Qu;
    const t = this.hc, i = 5 * (this.sn.N().layout.fontSize + 4) / 8 * (this.yn.tickMarkMaxCharacterLength || 8), n = Math.round(i / t), s = u(this.Ee()), e2 = Math.max(s.Oa(), s.Oa() - n), r2 = Math.max(s.bi(), s.bi() - n), h2 = this.ju.Eu(t, i, this.yn.ignoreWhitespaceIndices, this.tc, this.nc), a2 = this.Sc() + n, l2 = this.xc() - n, o2 = this.Lc(), _2 = this.yn.fixLeftEdge || o2, c2 = this.yn.fixRightEdge || o2;
    let d2 = 0;
    for (const t2 of h2) {
      if (!(e2 <= t2.index && t2.index <= r2)) continue;
      let n2;
      d2 < this.sc.length ? (n2 = this.sc[d2], n2.coord = this.jt(t2.index), n2.label = this.zc(t2), n2.weight = t2.weight) : (n2 = { needAlignCoordinate: false, coord: this.jt(t2.index), label: this.zc(t2), weight: t2.weight }, this.sc.push(n2)), this.hc > i / 2 && !o2 ? n2.needAlignCoordinate = false : n2.needAlignCoordinate = _2 && t2.index <= a2 || c2 && t2.index >= l2, d2++;
    }
    return this.sc.length = d2, this.Qu = this.sc, this.sc;
  }
  Oc() {
    let t;
    this.Ku = true, this.Ms(this.yn.barSpacing), t = void 0 !== this.yn.rightOffsetPixels ? this.yn.rightOffsetPixels / this.fl() : this.yn.rightOffset, this.gs(t);
  }
  Nc(t) {
    this.Ku = true, this.Uu = t, this.kc(), this.dc();
  }
  Fc(t, i) {
    const n = this.Dc(t), s = this.fl(), e2 = s + i * (s / 10);
    this.Ms(e2), this.yn.rightBarStaysOnScroll || this.gs(this.Ac() + (n - this.Dc(t)));
  }
  l_(t) {
    this.xo && this.d_(), null === this.So && null === this.Ju && (this.Gi() || (this.So = t, this.Wc()));
  }
  o_(t) {
    if (null === this.Ju) return;
    const i = ni(this.C_ - t, 0, this.C_), n = ni(this.C_ - u(this.So), 0, this.C_);
    0 !== i && 0 !== n && this.Ms(this.Ju.fl * i / n);
  }
  __() {
    null !== this.So && (this.So = null, this.Hc());
  }
  u_(t) {
    null === this.xo && null === this.Ju && (this.Gi() || (this.xo = t, this.Wc()));
  }
  c_(t) {
    if (null === this.xo) return;
    const i = (this.xo - t) / this.fl();
    this.rc = u(this.Ju).Ac + i, this.Ku = true, this.kc();
  }
  d_() {
    null !== this.xo && (this.xo = null, this.Hc());
  }
  Uc() {
    this.$c(this.yn.rightOffset);
  }
  $c(t, i = 400) {
    if (!isFinite(t)) throw new RangeError("offset is required and must be finite number");
    if (!isFinite(i) || i <= 0) throw new RangeError("animationDuration (optional) must be finite positive number");
    const n = this.rc, s = performance.now();
    this.sn.ps({ jc: (t2) => (t2 - s) / i >= 1, qc: (e2) => {
      const r2 = (e2 - s) / i;
      return r2 >= 1 ? t : n + (t - n) * r2;
    } });
  }
  kt(t, i) {
    this.Ku = true, this.$u = t, this.ju.Vu(t, i), this.kc();
  }
  Yc() {
    return this.Zu;
  }
  Kc() {
    return this.Gu;
  }
  Zc() {
    return this.Xu;
  }
  Pc() {
    return this.Uu || 0;
  }
  Gc(t, i) {
    const n = t.Tu(), s = i && this.yn.rightOffsetPixels || 0;
    this.Ec((this.C_ - s) / n), this.rc = t.bi() - this.Pc(), i && (this.rc = s ? s / this.fl() : this.yn.rightOffset), this.kc(), this.Ku = true, this.sn.Bc(), this.sn.mr();
  }
  Xc() {
    const t = this.Sc(), i = this.xc();
    if (null === t || null === i) return;
    const n = !this.yn.rightOffsetPixels && this.yn.rightOffset || 0;
    this.Gc(new Ai(t, i + n), true);
  }
  Jc(t) {
    const i = new Ai(t.from, t.to);
    this.Gc(i);
  }
  rn(t) {
    return void 0 !== this.Po.timeFormatter ? this.Po.timeFormatter(t.originalTime) : this.xu.formatHorzItem(t.time);
  }
  _c() {
    if (!this.yn.ignoreWhitespaceIndices) return;
    this.tc.clear();
    const t = this.sn.Jn();
    for (const i of t) for (const t2 of i.ul()) this.tc.set(t2, true);
    this.nc++;
  }
  Qc() {
    return this.ec;
  }
  Ml() {
    const t = 1 / (window.devicePixelRatio || 1), i = this.yn.minBarSpacing;
    if (i >= t) return [1];
    const n = [1];
    let s = 2;
    for (; s <= 512; ) {
      i < t / s && n.push(s), s *= 2;
    }
    return n;
  }
  Lc() {
    const t = this.sn.N().handleScroll, i = this.sn.N().handleScale;
    return !(t.horzTouchDrag || t.mouseWheel || t.pressedMouseMove || t.vertTouchDrag || i.axisDoubleClickReset.time || i.axisPressedMouseMove.time || i.mouseWheel || i.pinch);
  }
  Sc() {
    return 0 === this.$u.length ? null : 0;
  }
  xc() {
    return 0 === this.$u.length ? null : this.$u.length - 1;
  }
  td(t) {
    return (this.C_ - 1 - t) / this.hc;
  }
  Dc(t) {
    const i = this.td(t), n = this.Pc() + this.rc - i;
    return Math.round(1e6 * n) / 1e6;
  }
  Ec(t) {
    const i = this.hc;
    this.hc = t, this.yc(), i !== this.hc && (this.Ku = true, this.nd(), this.oc());
  }
  wc() {
    if (!this.Ku) return;
    if (this.Ku = false, this.Gi()) return void this.sd(Oi.Hu());
    const t = this.Pc(), i = this.C_ / this.hc, n = this.rc + t, s = new Ai(n - i + 1, n);
    this.sd(new Oi(s));
  }
  yc() {
    const t = ni(this.hc, this.ed(), this.rd());
    this.hc !== t && (this.hc = t, this.Ku = true);
  }
  rd() {
    return this.yn.maxBarSpacing > 0 ? this.yn.maxBarSpacing : 0.5 * this.C_;
  }
  ed() {
    return this.yn.fixLeftEdge && this.yn.fixRightEdge && 0 !== this.$u.length ? this.C_ / this.$u.length : this.yn.minBarSpacing;
  }
  oc() {
    if (!this.yn.enableConflation) return void (this.ec = 1);
    const t = 1 / (window.devicePixelRatio || 1) * (this.yn.conflationThresholdFactor ?? 1);
    if (this.hc >= t) return void (this.ec = 1);
    const i = t / this.hc, n = Math.pow(2, Math.floor(Math.log2(i)));
    this.ec = Math.min(n, 512);
  }
  kc() {
    const t = this.hd();
    null !== t && this.rc < t && (this.rc = t, this.Ku = true);
    const i = this.ad();
    this.rc > i && (this.rc = i, this.Ku = true);
  }
  hd() {
    const t = this.Sc(), i = this.Uu;
    if (null === t || null === i) return null;
    return t - i - 1 + (this.yn.fixLeftEdge ? this.C_ / this.hc : Math.min(2, this.$u.length));
  }
  ad() {
    return this.yn.fixRightEdge ? 0 : this.C_ / this.hc - Math.min(2, this.$u.length);
  }
  Wc() {
    this.Ju = { fl: this.fl(), Ac: this.Ac() };
  }
  Hc() {
    this.Ju = null;
  }
  zc(t) {
    let i = this.qu.get(t.weight);
    return void 0 === i && (i = new Ei(((t2) => this.ld(t2)), this.xu), this.qu.set(t.weight, i)), i.Cu(t);
  }
  ld(t) {
    return this.xu.formatTickmark(t, this.Po);
  }
  sd(t) {
    const i = this.Yu;
    this.Yu = t, Li(i.Fu(), this.Yu.Fu()) || this.Zu.p(), Li(i.Wu(), this.Yu.Wu()) || this.Gu.p(), this.nd();
  }
  nd() {
    this.Qu = null;
  }
  cc() {
    this.nd(), this.qu.clear();
  }
  lc() {
    this.xu.updateFormatter(this.Po);
  }
  dc() {
    if (!this.yn.fixLeftEdge) return;
    const t = this.Sc();
    if (null === t) return;
    const i = this.Ee();
    if (null === i) return;
    const n = i.Oa() - t;
    if (n < 0) {
      const t2 = this.rc - n - 1;
      this.gs(t2);
    }
    this.yc();
  }
  fc() {
    this.kc(), this.yc();
  }
  Ic(t) {
    return !this.yn.ignoreWhitespaceIndices || (this.tc.get(t) || false);
  }
  Vc(t) {
    const i = (function* (t2) {
      const i2 = Math.round(t2), n2 = i2 < t2;
      let s = 1;
      for (; ; ) n2 ? (yield i2 + s, yield i2 - s) : (yield i2 - s, yield i2 + s), s++;
    })(t), n = this.xc();
    for (; n; ) {
      const t2 = i.next().value;
      if (this.tc.get(t2)) return t2;
      if (t2 < 0 || t2 > n) break;
    }
    return t;
  }
  ac(t) {
    if (void 0 !== t.rightOffsetPixels) {
      const i = t.rightOffsetPixels / (t.barSpacing || this.hc);
      this.sn.gs(i);
    }
  }
}
var Wi, Hi, Ui, $i, ji;
!(function(t) {
  t[t.OnTouchEnd = 0] = "OnTouchEnd", t[t.OnNextTap = 1] = "OnNextTap";
})(Wi || (Wi = {}));
class qi {
  constructor(t, i, n) {
    this.od = [], this._d = [], this.ud = null, this.C_ = 0, this.dd = null, this.fd = new d(), this.pd = new d(), this.vd = null, this.md = t, this.yn = i, this.xu = n, this.To = new P(this.yn.layout.colorParsers), this.wd = new C(this), this.ia = new Fi(this, i.timeScale, this.yn.localization, n), this.Ct = new Z(this, i.crosshair), this.Md = new ii(i.crosshair), i.addDefaultPane && (this.gd(0), this.od[0].O_(2)), this.bd = this.Sd(0), this.xd = this.Sd(1);
  }
  Pa() {
    this.Cd(X.ys());
  }
  mr() {
    this.Cd(X.Cs());
  }
  qa() {
    this.Cd(new X(1));
  }
  Ta(t) {
    const i = this.yd(t);
    this.Cd(i);
  }
  ou() {
    return this.dd;
  }
  kd(t) {
    if (this.dd?.lu === t?.lu && this.dd?.wu?.te === t?.wu?.te && this.dd?.wu?.ie === t?.wu?.ie && this.dd?.mu === t?.mu && this.dd?.ee === t?.ee) return;
    const i = this.dd;
    this.dd = t, null !== i && this.Ta(i.lu), null !== t && t.lu !== i?.lu && this.Ta(t.lu);
  }
  N() {
    return this.yn;
  }
  vr(t) {
    f(this.yn, t), this.od.forEach(((i) => i.E_(t))), void 0 !== t.timeScale && this.ia.vr(t.timeScale), void 0 !== t.localization && this.ia.uc(t.localization), (t.leftPriceScale || t.rightPriceScale) && this.fd.p(), this.bd = this.Sd(0), this.xd = this.Sd(1), this.Pa();
  }
  Pd(t, i, n = 0) {
    const s = this.od[n];
    if (void 0 === s) return;
    if ("left" === t) return f(this.yn, { leftPriceScale: i }), s.E_({ leftPriceScale: i }), this.fd.p(), void this.Pa();
    if ("right" === t) return f(this.yn, { rightPriceScale: i }), s.E_({ rightPriceScale: i }), this.fd.p(), void this.Pa();
    const e2 = this.Td(t, n);
    null !== e2 && (e2.Ft.vr(i), this.fd.p());
  }
  Td(t, i) {
    const n = this.od[i];
    if (void 0 === n) return null;
    const s = n.A_(t);
    return null !== s ? { Kn: n, Ft: s } : null;
  }
  Et() {
    return this.ia;
  }
  Zn() {
    return this.od;
  }
  Rd() {
    return this.Ct;
  }
  Dd() {
    return this.pd;
  }
  Id(t, i) {
    t.Wo(i), this.Bc();
  }
  N_(t) {
    this.C_ = t, this.ia.N_(this.C_), this.od.forEach(((i) => i.N_(t))), this.Bc();
  }
  Vd(t) {
    1 !== this.od.length && (o(t >= 0 && t < this.od.length, "Invalid pane index"), this.od.splice(t, 1), this.Pa());
  }
  Bd(t, i) {
    if (this.od.length < 2) return;
    o(t >= 0 && t < this.od.length, "Invalid pane index");
    const n = this.od[t], s = this.od.reduce(((t2, i2) => t2 + i2.z_()), 0), e2 = this.od.reduce(((t2, i2) => t2 + i2.$t()), 0), r2 = e2 - 30 * (this.od.length - 1);
    i = Math.min(r2, Math.max(30, i));
    const h2 = s / e2, a2 = n.$t();
    n.O_(i * h2);
    let l2 = i - a2, _2 = this.od.length - 1;
    for (const t2 of this.od) if (t2 !== n) {
      const i2 = Math.min(r2, Math.max(30, t2.$t() - l2 / _2));
      l2 -= t2.$t() - i2, _2 -= 1;
      const n2 = i2 * h2;
      t2.O_(n2);
    }
    this.Pa();
  }
  Ed(t, i) {
    o(t >= 0 && t < this.od.length && i >= 0 && i < this.od.length, "Invalid pane index");
    const n = this.od[t], s = this.od[i];
    this.od[t] = s, this.od[i] = n, this.Pa();
  }
  Ad(t, i) {
    if (o(t >= 0 && t < this.od.length && i >= 0 && i < this.od.length, "Invalid pane index"), t === i) return;
    const [n] = this.od.splice(t, 1);
    this.od.splice(i, 0, n), this.Pa();
  }
  G_(t, i, n) {
    t.G_(i, n);
  }
  X_(t, i, n) {
    t.X_(i, n), this.Ra(), this.Cd(this.Ld(t, 2));
  }
  J_(t, i) {
    t.J_(i), this.Cd(this.Ld(t, 2));
  }
  Q_(t, i, n) {
    i.Eo() || t.Q_(i, n);
  }
  tu(t, i, n) {
    i.Eo() || (t.tu(i, n), this.Ra(), this.Cd(this.Ld(t, 2)));
  }
  iu(t, i) {
    i.Eo() || (t.iu(i), this.Cd(this.Ld(t, 2)));
  }
  eu(t, i) {
    t.eu(i), this.Cd(this.Ld(t, 2));
  }
  zd(t) {
    this.ia.l_(t);
  }
  Od(t, i) {
    const n = this.Et();
    if (n.Gi() || 0 === i) return;
    const s = n.nn();
    t = Math.max(1, Math.min(t, s)), n.Fc(t, i), this.Bc();
  }
  Nd(t) {
    this.Fd(0), this.Wd(t), this.Hd();
  }
  Ud(t) {
    this.ia.o_(t), this.Bc();
  }
  $d() {
    this.ia.__(), this.mr();
  }
  Fd(t) {
    this.ia.u_(t);
  }
  Wd(t) {
    this.ia.c_(t), this.Bc();
  }
  Hd() {
    this.ia.d_(), this.mr();
  }
  Jn() {
    return this._d;
  }
  Wn() {
    return null === this.ud && (this.ud = this._d.filter(((t) => t.It()))), this.ud;
  }
  ka() {
    this.ud = null;
  }
  jd(t, i, n, s, e2) {
    this.Ct.In(t, i);
    let r2 = NaN, h2 = this.ia.Rc(t, true);
    const a2 = this.ia.Ee();
    null !== a2 && (h2 = Math.min(Math.max(a2.Oa(), h2), a2.bi())), h2 = this.Ct.Fn(h2);
    const l2 = s.Pn(), o2 = l2.Lt();
    if (null !== o2 && (r2 = l2.Tn(i, o2)), r2 = this.Md.xl(r2, h2, s), this.Ct.An(h2, r2, s), this.qa(), !e2) {
      const e3 = Bi(s, t, i);
      this.kd(e3 && { lu: e3.lu, wu: e3.wu, mu: e3.mu || null, ee: e3.ee }), this.pd.p(this.Ct.Bt(), { x: t, y: i }, n);
    }
  }
  qd(t, i, n) {
    const s = n.Pn(), e2 = s.Lt(), r2 = s.Nt(t, u(e2)), h2 = this.ia.vc(i, true), a2 = this.ia.jt(u(h2));
    this.jd(a2, r2, null, n, true);
  }
  Yd(t) {
    this.Rd().zn(), this.qa(), t || this.pd.p(null, null, null);
  }
  Ra() {
    const t = this.Ct.Kn();
    if (null !== t) {
      const i = this.Ct.Bn(), n = this.Ct.En();
      this.jd(i, n, null, t);
    }
    this.Ct.Nn();
  }
  Kd(t, i, n) {
    const s = this.ia.Rn(0);
    void 0 !== i && void 0 !== n && this.ia.kt(i, n);
    const e2 = this.ia.Rn(0), r2 = this.ia.Pc(), h2 = this.ia.Ee();
    if (null !== h2 && null !== s && null !== e2) {
      const i2 = h2.ze(r2), a2 = this.xu.key(s) > this.xu.key(e2), l2 = null !== t && t > r2 && !a2, o2 = this.ia.N().allowShiftVisibleRangeOnWhitespaceReplacement, _2 = i2 && (!(void 0 === n) || o2) && this.ia.N().shiftVisibleRangeOnNewBar;
      if (l2 && !_2) {
        const i3 = t - r2;
        this.ia.gs(this.ia.Ac() - i3);
      }
    }
    this.ia.Nc(t);
  }
  Va(t) {
    null !== t && t.hu();
  }
  Ks(t) {
    if ((function(t2) {
      return t2 instanceof ki;
    })(t)) return t;
    const i = this.od.find(((i2) => i2.Dt().includes(t)));
    return void 0 === i ? null : i;
  }
  Bc() {
    this.od.forEach(((t) => t.hu())), this.Ra();
  }
  m() {
    this.od.forEach(((t) => t.m())), this.od.length = 0, this.yn.localization.priceFormatter = void 0, this.yn.localization.percentageFormatter = void 0, this.yn.localization.timeFormatter = void 0;
  }
  Zd() {
    return this.wd;
  }
  Js() {
    return this.wd.N();
  }
  L_() {
    return this.fd;
  }
  Gd(t, i) {
    const n = this.gd(i);
    this.Xd(t, n), this._d.push(t), this.ka(), 1 === this._d.length ? this.Pa() : this.mr();
  }
  Jd(t) {
    const i = this.Ks(t), n = this._d.indexOf(t);
    o(-1 !== n, "Series not found");
    const s = u(i);
    this._d.splice(n, 1), s.r_(t), t.m && t.m(), this.ka(), this.ia._c(), this.Qd(s);
  }
  ya(t, i) {
    const n = u(this.Ks(t));
    n.r_(t, true), n.s_(t, i, true);
  }
  Xc() {
    const t = X.Cs();
    t.us(), this.Cd(t);
  }
  tf(t) {
    const i = X.Cs();
    i.fs(t), this.Cd(i);
  }
  ws() {
    const t = X.Cs();
    t.ws(), this.Cd(t);
  }
  Ms(t) {
    const i = X.Cs();
    i.Ms(t), this.Cd(i);
  }
  gs(t) {
    const i = X.Cs();
    i.gs(t), this.Cd(i);
  }
  ps(t) {
    const i = X.Cs();
    i.ps(t), this.Cd(i);
  }
  cs() {
    const t = X.Cs();
    t.cs(), this.Cd(t);
  }
  if() {
    const t = this.yn.defaultVisiblePriceScaleId, i = this.yn.leftPriceScale.visible;
    return i !== this.yn.rightPriceScale.visible ? i ? "left" : "right" : t;
  }
  nf(t, i) {
    o(i >= 0, "Index should be greater or equal to 0");
    if (i === this.sf(t)) return;
    const n = u(this.Ks(t));
    n.r_(t);
    const s = this.gd(i);
    this.Xd(t, s);
    let e2 = false;
    0 === n.Cl().length && (e2 = this.Qd(n)), e2 || this.Pa();
  }
  ef() {
    return this.xd;
  }
  $() {
    return this.bd;
  }
  Ut(t) {
    const i = this.xd, n = this.bd;
    if (i === n) return i;
    if (t = Math.max(0, Math.min(100, Math.round(100 * t))), null === this.vd || this.vd.ah !== n || this.vd.oh !== i) this.vd = { ah: n, oh: i, rf: /* @__PURE__ */ new Map() };
    else {
      const i2 = this.vd.rf.get(t);
      if (void 0 !== i2) return i2;
    }
    const s = this.To.tt(n, i, t / 100);
    return this.vd.rf.set(t, s), s;
  }
  hf(t) {
    return this.od.indexOf(t);
  }
  Xi() {
    return this.To;
  }
  af() {
    return this.lf();
  }
  lf(t) {
    const i = new ki(this.ia, this);
    this.od.push(i);
    const n = t ?? this.od.length - 1, s = X.ys();
    return s.es(n, { rs: 0, hs: true }), this.Cd(s), i;
  }
  gd(t) {
    return o(t >= 0, "Index should be greater or equal to 0"), (t = Math.min(this.od.length, t)) < this.od.length ? this.od[t] : this.lf(t);
  }
  sf(t) {
    return this.od.findIndex(((i) => i.U_().includes(t)));
  }
  Ld(t, i) {
    const n = new X(i);
    if (null !== t) {
      const s = this.od.indexOf(t);
      n.es(s, { rs: i });
    }
    return n;
  }
  yd(t, i) {
    return void 0 === i && (i = 2), this.Ld(this.Ks(t), i);
  }
  Cd(t) {
    this.md && this.md(t), this.od.forEach(((t2) => t2.pu().wr().kt()));
  }
  Xd(t, i) {
    const n = t.N().priceScaleId, s = void 0 !== n ? n : this.if();
    i.s_(t, s), G(s) || t.vr(t.N());
  }
  Sd(t) {
    const i = this.yn.layout;
    return "gradient" === i.background.type ? 0 === t ? i.background.topColor : i.background.bottomColor : i.background.color;
  }
  Qd(t) {
    return !t.H_() && 0 === t.Cl().length && this.od.length > 1 && (this.od.splice(this.hf(t), 1), this.Pa(), true);
  }
}
function Yi(t) {
  if (t >= 1) return 0;
  let i = 0;
  for (; i < 8; i++) {
    const n = Math.round(t);
    if (Math.abs(n - t) < 1e-8) return i;
    t *= 10;
  }
  return i;
}
function Ki(t) {
  return !p(t) && !m(t);
}
function Zi(t) {
  return p(t);
}
!(function(t) {
  t[t.Disabled = 0] = "Disabled", t[t.Continuous = 1] = "Continuous", t[t.OnDataUpdate = 2] = "OnDataUpdate";
})(Hi || (Hi = {})), (function(t) {
  t[t.LastBar = 0] = "LastBar", t[t.LastVisible = 1] = "LastVisible";
})(Ui || (Ui = {})), (function(t) {
  t.Solid = "solid", t.VerticalGradient = "gradient";
})($i || ($i = {})), (function(t) {
  t[t.Year = 0] = "Year", t[t.Month = 1] = "Month", t[t.DayOfMonth = 2] = "DayOfMonth", t[t.Time = 3] = "Time", t[t.TimeWithSeconds = 4] = "TimeWithSeconds";
})(ji || (ji = {}));
const Gi = (t) => t.getUTCFullYear();
function Xi(t, i, n) {
  return i.replace(/yyyy/g, ((t2) => tt(Gi(t2), 4))(t)).replace(/yy/g, ((t2) => tt(Gi(t2) % 100, 2))(t)).replace(/MMMM/g, ((t2, i2) => new Date(t2.getUTCFullYear(), t2.getUTCMonth(), 1).toLocaleString(i2, { month: "long" }))(t, n)).replace(/MMM/g, ((t2, i2) => new Date(t2.getUTCFullYear(), t2.getUTCMonth(), 1).toLocaleString(i2, { month: "short" }))(t, n)).replace(/MM/g, ((t2) => tt(((t3) => t3.getUTCMonth() + 1)(t2), 2))(t)).replace(/dd/g, ((t2) => tt(((t3) => t3.getUTCDate())(t2), 2))(t));
}
class Ji {
  constructor(t = "yyyy-MM-dd", i = "default") {
    this._f = t, this.uf = i;
  }
  Cu(t) {
    return Xi(t, this._f, this.uf);
  }
}
class Qi {
  constructor(t) {
    this.cf = t || "%h:%m:%s";
  }
  Cu(t) {
    return this.cf.replace("%h", tt(t.getUTCHours(), 2)).replace("%m", tt(t.getUTCMinutes(), 2)).replace("%s", tt(t.getUTCSeconds(), 2));
  }
}
const tn = { df: "yyyy-MM-dd", ff: "%h:%m:%s", pf: " ", vf: "default" };
class nn {
  constructor(t = {}) {
    const i = { ...tn, ...t };
    this.mf = new Ji(i.df, i.vf), this.wf = new Qi(i.ff), this.Mf = i.pf;
  }
  Cu(t) {
    return `${this.mf.Cu(t)}${this.Mf}${this.wf.Cu(t)}`;
  }
}
function sn(t) {
  return 60 * t * 60 * 1e3;
}
function en(t) {
  return 60 * t * 1e3;
}
const rn = [{ gf: (hn = 1, 1e3 * hn), bf: 10 }, { gf: en(1), bf: 20 }, { gf: en(5), bf: 21 }, { gf: en(30), bf: 22 }, { gf: sn(1), bf: 30 }, { gf: sn(3), bf: 31 }, { gf: sn(6), bf: 32 }, { gf: sn(12), bf: 33 }];
var hn;
function an(t, i) {
  if (t.getUTCFullYear() !== i.getUTCFullYear()) return 70;
  if (t.getUTCMonth() !== i.getUTCMonth()) return 60;
  if (t.getUTCDate() !== i.getUTCDate()) return 50;
  for (let n = rn.length - 1; n >= 0; --n) if (Math.floor(i.getTime() / rn[n].gf) !== Math.floor(t.getTime() / rn[n].gf)) return rn[n].bf;
  return 0;
}
function ln(t) {
  let i = t;
  if (m(t) && (i = _n(t)), !Ki(i)) throw new Error("time must be of type BusinessDay");
  const n = new Date(Date.UTC(i.year, i.month - 1, i.day, 0, 0, 0, 0));
  return { Sf: Math.round(n.getTime() / 1e3), xf: i };
}
function on(t) {
  if (!Zi(t)) throw new Error("time must be of type isUTCTimestamp");
  return { Sf: t };
}
function _n(t) {
  const i = new Date(t);
  if (isNaN(i.getTime())) throw new Error(`Invalid date string=${t}, expected format=yyyy-mm-dd`);
  return { day: i.getUTCDate(), month: i.getUTCMonth() + 1, year: i.getUTCFullYear() };
}
function un(t) {
  m(t.time) && (t.time = _n(t.time));
}
class cn {
  options() {
    return this.yn;
  }
  setOptions(t) {
    this.yn = t, this.updateFormatter(t.localization);
  }
  preprocessData(t) {
    Array.isArray(t) ? (function(t2) {
      t2.forEach(un);
    })(t) : un(t);
  }
  createConverterToInternalObj(t) {
    return u((function(t2) {
      return 0 === t2.length ? null : Ki(t2[0].time) || m(t2[0].time) ? ln : on;
    })(t));
  }
  key(t) {
    return "object" == typeof t && "Sf" in t ? t.Sf : this.key(this.convertHorzItemToInternal(t));
  }
  cacheKey(t) {
    const i = t;
    return void 0 === i.xf ? new Date(1e3 * i.Sf).getTime() : new Date(Date.UTC(i.xf.year, i.xf.month - 1, i.xf.day)).getTime();
  }
  convertHorzItemToInternal(t) {
    return Zi(i = t) ? on(i) : Ki(i) ? ln(i) : ln(_n(i));
    var i;
  }
  updateFormatter(t) {
    if (!this.yn) return;
    const i = t.dateFormat;
    this.yn.timeScale.timeVisible ? this.Cf = new nn({ df: i, ff: this.yn.timeScale.secondsVisible ? "%h:%m:%s" : "%h:%m", pf: "   ", vf: t.locale }) : this.Cf = new Ji(i, t.locale);
  }
  formatHorzItem(t) {
    const i = t;
    return this.Cf.Cu(new Date(1e3 * i.Sf));
  }
  formatTickmark(t, i) {
    const n = (function(t2, i2, n2) {
      switch (t2) {
        case 0:
        case 10:
          return i2 ? n2 ? 4 : 3 : 2;
        case 20:
        case 21:
        case 22:
        case 30:
        case 31:
        case 32:
        case 33:
          return i2 ? 3 : 2;
        case 50:
          return 2;
        case 60:
          return 1;
        case 70:
          return 0;
      }
    })(t.weight, this.yn.timeScale.timeVisible, this.yn.timeScale.secondsVisible), s = this.yn.timeScale;
    if (void 0 !== s.tickMarkFormatter) {
      const e2 = s.tickMarkFormatter(t.originalTime, n, i.locale);
      if (null !== e2) return e2;
    }
    return (function(t2, i2, n2) {
      const s2 = {};
      switch (i2) {
        case 0:
          s2.year = "numeric";
          break;
        case 1:
          s2.month = "short";
          break;
        case 2:
          s2.day = "numeric";
          break;
        case 3:
          s2.hour12 = false, s2.hour = "2-digit", s2.minute = "2-digit";
          break;
        case 4:
          s2.hour12 = false, s2.hour = "2-digit", s2.minute = "2-digit", s2.second = "2-digit";
      }
      const e2 = void 0 === t2.xf ? new Date(1e3 * t2.Sf) : new Date(Date.UTC(t2.xf.year, t2.xf.month - 1, t2.xf.day));
      return new Date(e2.getUTCFullYear(), e2.getUTCMonth(), e2.getUTCDate(), e2.getUTCHours(), e2.getUTCMinutes(), e2.getUTCSeconds(), e2.getUTCMilliseconds()).toLocaleString(n2, s2);
    })(t.time, n, i.locale);
  }
  maxTickMarkWeight(t) {
    let i = t.reduce(Ni, t[0]).weight;
    return i > 30 && i < 50 && (i = 30), i;
  }
  fillWeightsForPoints(t, i) {
    !(function(t2, i2 = 0) {
      if (0 === t2.length) return;
      let n = 0 === i2 ? null : t2[i2 - 1].time.Sf, s = null !== n ? new Date(1e3 * n) : null, e2 = 0;
      for (let r2 = i2; r2 < t2.length; ++r2) {
        const i3 = t2[r2], h2 = new Date(1e3 * i3.time.Sf);
        null !== s && (i3.timeWeight = an(h2, s)), e2 += i3.time.Sf - (n || i3.time.Sf), n = i3.time.Sf, s = h2;
      }
      if (0 === i2 && t2.length > 1) {
        const i3 = Math.ceil(e2 / (t2.length - 1)), n2 = new Date(1e3 * (t2[0].time.Sf - i3));
        t2[0].timeWeight = an(new Date(1e3 * t2[0].time.Sf), n2);
      }
    })(t, i);
  }
  static yf(t) {
    return f({ localization: { dateFormat: "dd MMM 'yy" } }, t ?? {});
  }
}
const dn = "undefined" != typeof window;
function fn() {
  return !!dn && window.navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
}
function pn() {
  return !!dn && /iPhone|iPad|iPod/.test(window.navigator.platform);
}
function vn(t, i) {
  switch (t) {
    case "custom":
      return void 0 !== i ? "custom-object" : "series";
    case "price-line":
      return "custom-price-line";
    case "marker":
      return "series-marker";
    case "primitive":
      return "primitive";
    default:
      return "series";
  }
}
function mn(t) {
  return t + t % 2;
}
function wn(t) {
  dn && void 0 !== window.chrome && t.addEventListener("mousedown", ((t2) => {
    if (1 === t2.button) return t2.preventDefault(), false;
  }));
}
class Mn {
  constructor(t, i, n) {
    this.kf = 0, this.Pf = null, this.Tf = { _t: Number.NEGATIVE_INFINITY, ut: Number.POSITIVE_INFINITY }, this.Rf = 0, this.Df = null, this.If = { _t: Number.NEGATIVE_INFINITY, ut: Number.POSITIVE_INFINITY }, this.Vf = null, this.Bf = false, this.Ef = null, this.Af = null, this.Lf = false, this.zf = false, this.Of = false, this.Nf = null, this.Ff = null, this.Wf = null, this.Hf = null, this.Uf = null, this.$f = null, this.jf = null, this.qf = 0, this.Yf = false, this.Kf = false, this.Zf = false, this.Gf = 0, this.Xf = null, this.Jf = !pn(), this.Qf = (t2) => {
      this.tp(t2);
    }, this.ip = (t2) => {
      if (this.np(t2)) {
        const i2 = this.sp(t2);
        if (++this.Rf, this.Df && this.Rf > 1) {
          const { ep: n2 } = this.rp(Sn(t2), this.If);
          n2 < 30 && !this.Of && this.hp(i2, this.lp.ap), this.op();
        }
      } else {
        const i2 = this.sp(t2);
        if (++this.kf, this.Pf && this.kf > 1) {
          const { ep: n2 } = this.rp(Sn(t2), this.Tf);
          n2 < 5 && !this.zf && this._p(i2, this.lp.up), this.cp();
        }
      }
    }, this.dp = t, this.lp = i, this.yn = n, this.fp();
  }
  m() {
    null !== this.Nf && (this.Nf(), this.Nf = null), null !== this.Ff && (this.Ff(), this.Ff = null), null !== this.Hf && (this.Hf(), this.Hf = null), null !== this.Uf && (this.Uf(), this.Uf = null), null !== this.$f && (this.$f(), this.$f = null), null !== this.Wf && (this.Wf(), this.Wf = null), this.pp(), this.cp();
  }
  vp(t) {
    this.Hf && this.Hf();
    const i = this.mp.bind(this);
    if (this.Hf = () => {
      this.dp.removeEventListener("mousemove", i);
    }, this.dp.addEventListener("mousemove", i), this.np(t)) return;
    const n = this.sp(t);
    this._p(n, this.lp.wp), this.Jf = true;
  }
  cp() {
    null !== this.Pf && clearTimeout(this.Pf), this.kf = 0, this.Pf = null, this.Tf = { _t: Number.NEGATIVE_INFINITY, ut: Number.POSITIVE_INFINITY };
  }
  op() {
    null !== this.Df && clearTimeout(this.Df), this.Rf = 0, this.Df = null, this.If = { _t: Number.NEGATIVE_INFINITY, ut: Number.POSITIVE_INFINITY };
  }
  mp(t) {
    if (this.Zf || null !== this.Af) return;
    if (this.np(t)) return;
    const i = this.sp(t);
    this._p(i, this.lp.Mp), this.Jf = true;
  }
  gp(t) {
    const i = Cn(t.changedTouches, u(this.Xf));
    if (null === i) return;
    if (this.Gf = xn(t), null !== this.jf) return;
    if (this.Kf) return;
    this.Yf = true;
    const n = this.rp(Sn(i), u(this.Af)), { bp: s, Sp: e2, ep: r2 } = n;
    if (this.Lf || !(r2 < 5)) {
      if (!this.Lf) {
        const t2 = 0.5 * s, i2 = e2 >= t2 && !this.yn.xp(), n2 = t2 > e2 && !this.yn.Cp();
        i2 || n2 || (this.Kf = true), this.Lf = true, this.Of = true, this.pp(), this.op();
      }
      if (!this.Kf) {
        const n2 = this.sp(t, i);
        this.hp(n2, this.lp.yp), bn(t);
      }
    }
  }
  kp(t) {
    if (0 !== t.button) return;
    const i = this.rp(Sn(t), u(this.Ef)), { ep: n } = i;
    if (n >= 5 && (this.zf = true, this.cp()), this.zf) {
      const i2 = this.sp(t);
      this._p(i2, this.lp.Pp);
    }
  }
  rp(t, i) {
    const n = Math.abs(i._t - t._t), s = Math.abs(i.ut - t.ut);
    return { bp: n, Sp: s, ep: n + s };
  }
  Tp(t) {
    let i = Cn(t.changedTouches, u(this.Xf));
    if (null === i && 0 === t.touches.length && (i = t.changedTouches[0]), null === i) return;
    this.Xf = null, this.Gf = xn(t), this.pp(), this.Af = null, this.$f && (this.$f(), this.$f = null);
    const n = this.sp(t, i);
    if (this.hp(n, this.lp.Rp), ++this.Rf, this.Df && this.Rf > 1) {
      const { ep: t2 } = this.rp(Sn(i), this.If);
      t2 < 30 && !this.Of && this.hp(n, this.lp.ap), this.op();
    } else this.Of || (this.hp(n, this.lp.Dp), this.lp.Dp && bn(t));
    0 === this.Rf && bn(t), 0 === t.touches.length && this.Bf && (this.Bf = false, bn(t));
  }
  tp(t) {
    if (0 !== t.button) return;
    const i = this.sp(t);
    if (this.Ef = null, this.Zf = false, this.Uf && (this.Uf(), this.Uf = null), fn()) {
      this.dp.ownerDocument.documentElement.removeEventListener("mouseleave", this.Qf);
    }
    if (!this.np(t)) if (this._p(i, this.lp.Ip), ++this.kf, this.Pf && this.kf > 1) {
      const { ep: n } = this.rp(Sn(t), this.Tf);
      n < 5 && !this.zf && this._p(i, this.lp.up), this.cp();
    } else this.zf || this._p(i, this.lp.Vp);
  }
  pp() {
    null !== this.Vf && (clearTimeout(this.Vf), this.Vf = null);
  }
  Bp(t) {
    if (null !== this.Xf) return;
    const i = t.changedTouches[0];
    this.Xf = i.identifier, this.Gf = xn(t);
    const n = this.dp.ownerDocument.documentElement;
    this.Of = false, this.Lf = false, this.Kf = false, this.Af = Sn(i), this.$f && (this.$f(), this.$f = null);
    {
      const i2 = this.gp.bind(this), s2 = this.Tp.bind(this);
      this.$f = () => {
        n.removeEventListener("touchmove", i2), n.removeEventListener("touchend", s2);
      }, n.addEventListener("touchmove", i2, { passive: false }), n.addEventListener("touchend", s2, { passive: false }), this.pp(), this.Vf = setTimeout(this.Ep.bind(this, t), 240);
    }
    const s = this.sp(t, i);
    this.hp(s, this.lp.Ap), this.Df || (this.Rf = 0, this.Df = setTimeout(this.op.bind(this), 500), this.If = Sn(i));
  }
  Lp(t) {
    if (0 !== t.button) return;
    const i = this.dp.ownerDocument.documentElement;
    fn() && i.addEventListener("mouseleave", this.Qf), this.zf = false, this.Ef = Sn(t), this.Uf && (this.Uf(), this.Uf = null);
    {
      const t2 = this.kp.bind(this), n2 = this.tp.bind(this);
      this.Uf = () => {
        i.removeEventListener("mousemove", t2), i.removeEventListener("mouseup", n2);
      }, i.addEventListener("mousemove", t2), i.addEventListener("mouseup", n2);
    }
    if (this.Zf = true, this.np(t)) return;
    const n = this.sp(t);
    this._p(n, this.lp.zp), this.Pf || (this.kf = 0, this.Pf = setTimeout(this.cp.bind(this), 500), this.Tf = Sn(t));
  }
  fp() {
    this.dp.addEventListener("mouseenter", this.vp.bind(this)), this.dp.addEventListener("touchcancel", this.pp.bind(this));
    {
      const t = this.dp.ownerDocument, i = (t2) => {
        this.lp.Op && (t2.composed && this.dp.contains(t2.composedPath()[0]) || t2.target && this.dp.contains(t2.target) || this.lp.Op());
      };
      this.Ff = () => {
        t.removeEventListener("touchstart", i);
      }, this.Nf = () => {
        t.removeEventListener("mousedown", i);
      }, t.addEventListener("mousedown", i), t.addEventListener("touchstart", i, { passive: true });
    }
    pn() && (this.Wf = () => {
      this.dp.removeEventListener("dblclick", this.ip);
    }, this.dp.addEventListener("dblclick", this.ip)), this.dp.addEventListener("mouseleave", this.Np.bind(this)), this.dp.addEventListener("touchstart", this.Bp.bind(this), { passive: true }), wn(this.dp), this.dp.addEventListener("mousedown", this.Lp.bind(this)), this.Fp(), this.dp.addEventListener("touchmove", (() => {
    }), { passive: false });
  }
  Fp() {
    void 0 === this.lp.Wp && void 0 === this.lp.Hp && void 0 === this.lp.Up || (this.dp.addEventListener("touchstart", ((t) => this.$p(t.touches)), { passive: true }), this.dp.addEventListener("touchmove", ((t) => {
      if (2 === t.touches.length && null !== this.jf && void 0 !== this.lp.Hp) {
        const i = gn(t.touches[0], t.touches[1]) / this.qf;
        this.lp.Hp(this.jf, i), bn(t);
      }
    }), { passive: false }), this.dp.addEventListener("touchend", ((t) => {
      this.$p(t.touches);
    })));
  }
  $p(t) {
    1 === t.length && (this.Yf = false), 2 !== t.length || this.Yf || this.Bf ? this.jp() : this.qp(t);
  }
  qp(t) {
    const i = this.dp.getBoundingClientRect() || { left: 0, top: 0 };
    this.jf = { _t: (t[0].clientX - i.left + (t[1].clientX - i.left)) / 2, ut: (t[0].clientY - i.top + (t[1].clientY - i.top)) / 2 }, this.qf = gn(t[0], t[1]), void 0 !== this.lp.Wp && this.lp.Wp(), this.pp();
  }
  jp() {
    null !== this.jf && (this.jf = null, void 0 !== this.lp.Up && this.lp.Up());
  }
  Np(t) {
    if (this.Hf && this.Hf(), this.np(t)) return;
    if (!this.Jf) return;
    const i = this.sp(t);
    this._p(i, this.lp.Yp), this.Jf = !pn();
  }
  Ep(t) {
    const i = Cn(t.touches, u(this.Xf));
    if (null === i) return;
    const n = this.sp(t, i);
    this.hp(n, this.lp.Kp), this.Of = true, this.Bf = true;
  }
  np(t) {
    return t.sourceCapabilities && void 0 !== t.sourceCapabilities.firesTouchEvents ? t.sourceCapabilities.firesTouchEvents : xn(t) < this.Gf + 500;
  }
  hp(t, i) {
    i && i.call(this.lp, t);
  }
  _p(t, i) {
    i && i.call(this.lp, t);
  }
  sp(t, i) {
    const n = i || t, s = this.dp.getBoundingClientRect() || { left: 0, top: 0 };
    return { clientX: n.clientX, clientY: n.clientY, pageX: n.pageX, pageY: n.pageY, screenX: n.screenX, screenY: n.screenY, localX: n.clientX - s.left, localY: n.clientY - s.top, ctrlKey: t.ctrlKey, altKey: t.altKey, shiftKey: t.shiftKey, metaKey: t.metaKey, Zp: !t.type.startsWith("mouse") && "contextmenu" !== t.type && "click" !== t.type, Gp: t.type, Xp: n.target, gu: t.view, Jp: () => {
      "touchstart" !== t.type && bn(t);
    } };
  }
}
function gn(t, i) {
  const n = t.clientX - i.clientX, s = t.clientY - i.clientY;
  return Math.sqrt(n * n + s * s);
}
function bn(t) {
  t.cancelable && t.preventDefault();
}
function Sn(t) {
  return { _t: t.pageX, ut: t.pageY };
}
function xn(t) {
  return t.timeStamp || performance.now();
}
function Cn(t, i) {
  for (let n = 0; n < t.length; ++n) if (t[n].identifier === i) return t[n];
  return null;
}
class yn {
  constructor(t, i, n) {
    this.Qp = null, this.tv = null, this.iv = true, this.nv = null, this.sv = t, this.ev = t.rv()[i], this.hv = t.rv()[n], this.av = document.createElement("tr"), this.av.style.height = "1px", this.lv = document.createElement("td"), this.lv.style.position = "relative", this.lv.style.padding = "0", this.lv.style.margin = "0", this.lv.setAttribute("colspan", "3"), this.ov(), this.av.appendChild(this.lv), this.iv = this.sv.N().layout.panes.enableResize, this.iv ? this._v() : (this.Qp = null, this.tv = null);
  }
  m() {
    null !== this.tv && this.tv.m();
  }
  uv() {
    return this.av;
  }
  cv() {
    return size({ width: this.ev.cv().width, height: 1 });
  }
  dv() {
    return size({ width: this.ev.dv().width, height: 1 * window.devicePixelRatio });
  }
  fv(t, i, n) {
    const s = this.dv();
    t.fillStyle = this.sv.N().layout.panes.separatorColor, t.fillRect(i, n, s.width, s.height);
  }
  kt() {
    this.ov(), this.sv.N().layout.panes.enableResize !== this.iv && (this.iv = this.sv.N().layout.panes.enableResize, this.iv ? this._v() : (null !== this.Qp && (this.lv.removeChild(this.Qp.pv), this.lv.removeChild(this.Qp.vv), this.Qp = null), null !== this.tv && (this.tv.m(), this.tv = null)));
  }
  _v() {
    const t = document.createElement("div"), i = t.style;
    i.position = "fixed", i.display = "none", i.zIndex = "49", i.top = "0", i.left = "0", i.width = "100%", i.height = "100%", i.cursor = "row-resize", this.lv.appendChild(t);
    const n = document.createElement("div"), s = n.style;
    s.position = "absolute", s.zIndex = "50", s.top = "-4px", s.height = "9px", s.width = "100%", s.backgroundColor = "", s.cursor = "row-resize", this.lv.appendChild(n);
    const e2 = { wp: this.mv.bind(this), Yp: this.wv.bind(this), zp: this.Mv.bind(this), Ap: this.Mv.bind(this), Pp: this.gv.bind(this), yp: this.gv.bind(this), Ip: this.bv.bind(this), Rp: this.bv.bind(this) };
    this.tv = new Mn(n, e2, { xp: () => false, Cp: () => true }), this.Qp = { vv: n, pv: t };
  }
  ov() {
    this.lv.style.background = this.sv.N().layout.panes.separatorColor;
  }
  mv(t) {
    null !== this.Qp && (this.Qp.vv.style.backgroundColor = this.sv.N().layout.panes.separatorHoverColor);
  }
  wv(t) {
    null !== this.Qp && null === this.nv && (this.Qp.vv.style.backgroundColor = "");
  }
  Mv(t) {
    if (null === this.Qp) return;
    const i = this.ev.Sv().z_() + this.hv.Sv().z_(), n = i / (this.ev.cv().height + this.hv.cv().height), s = 30 * n;
    i <= 2 * s || (this.nv = { xv: t.pageY, Cv: this.ev.Sv().z_(), yv: i - s, kv: i, Pv: n, Tv: s }, this.Qp.pv.style.display = "block");
  }
  gv(t) {
    const i = this.nv;
    if (null === i) return;
    const n = (t.pageY - i.xv) * i.Pv, s = ni(i.Cv + n, i.Tv, i.yv);
    this.ev.Sv().O_(s), this.hv.Sv().O_(i.kv - s), this.sv.Qt().Pa();
  }
  bv(t) {
    null !== this.nv && null !== this.Qp && (this.nv = null, this.Qp.pv.style.display = "none");
  }
}
function kn(t, i) {
  return t.Rv - i.Rv;
}
function Pn(t, i, n) {
  const s = (t.Rv - i.Rv) / (t.wt - i.wt);
  return Math.sign(s) * Math.min(Math.abs(s), n);
}
class Tn {
  constructor(t, i, n, s) {
    this.Dv = null, this.Iv = null, this.Vv = null, this.Bv = null, this.Ev = null, this.Av = 0, this.Lv = 0, this.zv = t, this.Ov = i, this.Nv = n, this.ks = s;
  }
  Fv(t, i) {
    if (null !== this.Dv) {
      if (this.Dv.wt === i) return void (this.Dv.Rv = t);
      if (Math.abs(this.Dv.Rv - t) < this.ks) return;
    }
    this.Bv = this.Vv, this.Vv = this.Iv, this.Iv = this.Dv, this.Dv = { wt: i, Rv: t };
  }
  me(t, i) {
    if (null === this.Dv || null === this.Iv) return;
    if (i - this.Dv.wt > 50) return;
    let n = 0;
    const s = Pn(this.Dv, this.Iv, this.Ov), e2 = kn(this.Dv, this.Iv), r2 = [s], h2 = [e2];
    if (n += e2, null !== this.Vv) {
      const t2 = Pn(this.Iv, this.Vv, this.Ov);
      if (Math.sign(t2) === Math.sign(s)) {
        const i2 = kn(this.Iv, this.Vv);
        if (r2.push(t2), h2.push(i2), n += i2, null !== this.Bv) {
          const t3 = Pn(this.Vv, this.Bv, this.Ov);
          if (Math.sign(t3) === Math.sign(s)) {
            const i3 = kn(this.Vv, this.Bv);
            r2.push(t3), h2.push(i3), n += i3;
          }
        }
      }
    }
    let a2 = 0;
    for (let t2 = 0; t2 < r2.length; ++t2) a2 += h2[t2] / n * r2[t2];
    Math.abs(a2) < this.zv || (this.Ev = { Rv: t, wt: i }, this.Lv = a2, this.Av = (function(t2, i2) {
      const n2 = Math.log(i2);
      return Math.log(1 * n2 / -t2) / n2;
    })(Math.abs(a2), this.Nv));
  }
  qc(t) {
    const i = u(this.Ev), n = t - i.wt;
    return i.Rv + this.Lv * (Math.pow(this.Nv, n) - 1) / Math.log(this.Nv);
  }
  jc(t) {
    return null === this.Ev || this.Wv(t) === this.Av;
  }
  Wv(t) {
    const i = t - u(this.Ev).wt;
    return Math.min(i, this.Av);
  }
}
class Rn {
  constructor(t, i) {
    this.Hv = void 0, this.Uv = void 0, this.$v = void 0, this.vn = false, this.jv = t, this.qv = i, this.Yv();
  }
  kt() {
    this.Yv();
  }
  Kv() {
    this.Hv && this.jv.removeChild(this.Hv), this.Uv && this.jv.removeChild(this.Uv), this.Hv = void 0, this.Uv = void 0;
  }
  Zv() {
    return this.vn !== this.Gv() || this.$v !== this.Xv();
  }
  Xv() {
    return this.qv.Qt().Xi().J(this.qv.N().layout.textColor) > 160 ? "dark" : "light";
  }
  Gv() {
    return this.qv.N().layout.attributionLogo;
  }
  Jv() {
    const t = new URL(location.href);
    return t.hostname ? "&utm_source=" + t.hostname + t.pathname : "";
  }
  Yv() {
    this.Zv() && (this.Kv(), this.vn = this.Gv(), this.vn && (this.$v = this.Xv(), this.Uv = document.createElement("style"), this.Uv.innerText = "a#tv-attr-logo{--fill:#131722;--stroke:#fff;position:absolute;left:10px;bottom:10px;height:19px;width:35px;margin:0;padding:0;border:0;z-index:3;}a#tv-attr-logo[data-dark]{--fill:#D1D4DC;--stroke:#131722;}", this.Hv = document.createElement("a"), this.Hv.href = `https://www.tradingview.com/?utm_medium=lwc-link&utm_campaign=lwc-chart${this.Jv()}`, this.Hv.title = "Charting by TradingView", this.Hv.id = "tv-attr-logo", this.Hv.target = "_blank", this.Hv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="35" height="19" fill="none"><g fill-rule="evenodd" clip-path="url(#a)" clip-rule="evenodd"><path fill="var(--stroke)" d="M2 0H0v10h6v9h21.4l.5-1.3 6-15 1-2.7H23.7l-.5 1.3-.2.6a5 5 0 0 0-7-.9V0H2Zm20 17h4l5.2-13 .8-2h-7l-1 2.5-.2.5-1.5 3.8-.3.7V17Zm-.8-10a3 3 0 0 0 .7-2.7A3 3 0 1 0 16.8 7h4.4ZM14 7V2H2v6h6v9h4V7h2Z"/><path fill="var(--fill)" d="M14 2H2v6h6v9h6V2Zm12 15h-7l6-15h7l-6 15Zm-7-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/></g><defs><clipPath id="a"><path fill="var(--stroke)" d="M0 0h35v19H0z"/></clipPath></defs></svg>', this.Hv.toggleAttribute("data-dark", "dark" === this.$v), this.jv.appendChild(this.Uv), this.jv.appendChild(this.Hv)));
  }
}
function Dn(t, n) {
  const s = u(t.ownerDocument).createElement("canvas");
  t.appendChild(s);
  const e2 = bindTo(s, { options: { allowResizeObserver: true }, transform: (t2, i) => ({ width: Math.max(t2.width, i.width), height: Math.max(t2.height, i.height) }) });
  return e2.resizeCanvasElement(n), e2;
}
function In(t) {
  t.width = 1, t.height = 1, t.getContext("2d")?.clearRect(0, 0, 1, 1);
}
function Vn(t, i, n, s) {
  t.qh && t.qh(i, n, s);
}
function Bn(t, i, n, s) {
  t.st(i, n, s);
}
function En(t, i, n, s) {
  const e2 = t(n, s);
  for (const t2 of e2) {
    const n2 = t2.Tt(s);
    null !== n2 && i(n2);
  }
}
function An(t, i) {
  return (n) => {
    if (!(function(t2) {
      return void 0 !== t2.Ft;
    })(n)) return [];
    return (n.Ft()?.cl() ?? "") !== i ? [] : n.Ga?.(t) ?? [];
  };
}
function Ln(t, i, n, s) {
  if (!t.length) return;
  let e2 = 0;
  const r2 = t[0].$t(s, true);
  let h2 = 1 === i ? n / 2 - (t[0].Hi() - r2 / 2) : t[0].Hi() - r2 / 2 - n / 2;
  h2 = Math.max(0, h2);
  for (let r3 = 1; r3 < t.length; r3++) {
    const a2 = t[r3], l2 = t[r3 - 1], o2 = l2.$t(s, false), _2 = a2.Hi(), u2 = l2.Hi();
    if (1 === i ? _2 > u2 - o2 : _2 < u2 + o2) {
      const s2 = u2 - o2 * i;
      a2.Ui(s2);
      const r4 = s2 - i * o2 / 2;
      if ((1 === i ? r4 < 0 : r4 > n) && h2 > 0) {
        const s3 = 1 === i ? -1 - r4 : r4 - n, a3 = Math.min(s3, h2);
        for (let n2 = e2; n2 < t.length; n2++) t[n2].Ui(t[n2].Hi() + i * a3);
        h2 -= a3;
      }
    } else e2 = r3, h2 = 1 === i ? u2 - o2 - _2 : _2 - (u2 + o2);
  }
}
class zn {
  constructor(i, n, s, e2) {
    this.Ki = null, this.Qv = null, this.tm = false, this.im = new rt(200), this.nm = null, this.sm = 0, this.rm = false, this.hm = () => {
      this.rm || this.yt.am().Qt().mr();
    }, this.lm = () => {
      this.rm || this.yt.am().Qt().mr();
    }, this.yt = i, this.yn = n, this.ko = n.layout, this.wd = s, this.om = "left" === e2, this._m = An("normal", e2), this.um = An("top", e2), this.dm = An("bottom", e2), this.lv = document.createElement("div"), this.lv.style.height = "100%", this.lv.style.overflow = "hidden", this.lv.style.width = "25px", this.lv.style.left = "0", this.lv.style.position = "relative", this.fm = Dn(this.lv, size({ width: 16, height: 16 })), this.fm.subscribeSuggestedBitmapSizeChanged(this.hm);
    const r2 = this.fm.canvasElement;
    r2.style.position = "absolute", r2.style.zIndex = "1", r2.style.left = "0", r2.style.top = "0", this.pm = Dn(this.lv, size({ width: 16, height: 16 })), this.pm.subscribeSuggestedBitmapSizeChanged(this.lm);
    const h2 = this.pm.canvasElement;
    h2.style.position = "absolute", h2.style.zIndex = "2", h2.style.left = "0", h2.style.top = "0";
    const a2 = { zp: this.Mv.bind(this), Ap: this.Mv.bind(this), Pp: this.gv.bind(this), yp: this.gv.bind(this), Op: this.vm.bind(this), Ip: this.bv.bind(this), Rp: this.bv.bind(this), up: this.wm.bind(this), ap: this.wm.bind(this), wp: this.Mm.bind(this), Yp: this.wv.bind(this) };
    this.tv = new Mn(this.pm.canvasElement, a2, { xp: () => !this.yn.handleScroll.vertTouchDrag, Cp: () => true });
  }
  m() {
    this.tv.m(), this.pm.unsubscribeSuggestedBitmapSizeChanged(this.lm), In(this.pm.canvasElement), this.pm.dispose(), this.fm.unsubscribeSuggestedBitmapSizeChanged(this.hm), In(this.fm.canvasElement), this.fm.dispose(), null !== this.Ki && this.Ki.a_().u(this), this.Ki = null;
  }
  uv() {
    return this.lv;
  }
  k() {
    return this.ko.fontSize;
  }
  gm() {
    const t = this.wd.N();
    return this.nm !== t.P && (this.im.Os(), this.nm = t.P), t;
  }
  bm() {
    if (null === this.Ki) return 0;
    let t = 0;
    const i = this.gm(), n = u(this.fm.canvasElement.getContext("2d", { colorSpace: this.yt.am().N().layout.colorSpace }));
    n.save();
    const s = this.Ki.El();
    n.font = this.Sm(), s.length > 0 && (t = Math.max(this.im.Ii(n, s[0].io), this.im.Ii(n, s[s.length - 1].io)));
    const e2 = this.xm();
    for (let i2 = e2.length; i2--; ) {
      const s2 = this.im.Ii(n, e2[i2].ri());
      s2 > t && (t = s2);
    }
    const r2 = this.Ki.Lt();
    if (null !== r2 && null !== this.Qv && (2 !== (h2 = this.yn.crosshair).mode && h2.horzLine.visible && h2.horzLine.labelVisible)) {
      const i2 = this.Ki.Tn(1, r2), s2 = this.Ki.Tn(this.Qv.height - 2, r2);
      t = Math.max(t, this.im.Ii(n, this.Ki.Ji(Math.floor(Math.min(i2, s2)) + 0.11111111111111, r2)), this.im.Ii(n, this.Ki.Ji(Math.ceil(Math.max(i2, s2)) - 0.11111111111111, r2)));
    }
    var h2;
    n.restore();
    const a2 = t || 34;
    return mn(Math.ceil(i.S + i.C + i.V + i.B + 5 + a2));
  }
  Cm(t) {
    null !== this.Qv && equalSizes(this.Qv, t) || (this.Qv = t, this.rm = true, this.fm.resizeCanvasElement(t), this.pm.resizeCanvasElement(t), this.rm = false, this.lv.style.width = `${t.width}px`, this.lv.style.height = `${t.height}px`);
  }
  ym() {
    return u(this.Qv).width;
  }
  un(t) {
    this.Ki !== t && (null !== this.Ki && this.Ki.a_().u(this), this.Ki = t, t.a_().i(this.po.bind(this), this));
  }
  Ft() {
    return this.Ki;
  }
  Os() {
    const t = this.yt.Sv();
    this.yt.am().Qt().eu(t, u(this.Ft()));
  }
  km(t) {
    if (null === this.Qv) return;
    const i = { colorSpace: this.yt.am().N().layout.colorSpace };
    if (1 !== t) {
      this.Pm(), this.fm.applySuggestedBitmapSize();
      const t2 = tryCreateCanvasRenderingTarget2D(this.fm, i);
      null !== t2 && (t2.useBitmapCoordinateSpace(((t3) => {
        this.Tm(t3), this.Rm(t3);
      })), this.yt.Dm(t2, this.dm), this.Im(t2), this.yt.Dm(t2, this._m), this.Vm(t2));
    }
    this.pm.applySuggestedBitmapSize();
    const n = tryCreateCanvasRenderingTarget2D(this.pm, i);
    null !== n && (n.useBitmapCoordinateSpace((({ context: t2, bitmapSize: i2 }) => {
      t2.clearRect(0, 0, i2.width, i2.height);
    })), this.Bm(n), this.yt.Dm(n, this.um));
  }
  dv() {
    return this.fm.bitmapSize;
  }
  fv(t, i, n, s) {
    const e2 = this.dv();
    if (e2.width > 0 && e2.height > 0 && (t.drawImage(this.fm.canvasElement, i, n), s)) {
      const s2 = this.pm.canvasElement;
      t.drawImage(s2, i, n);
    }
  }
  kt() {
    this.Ki?.El();
  }
  Mv(t) {
    if (null === this.Ki || this.Ki.Gi() || !this.yn.handleScale.axisPressedMouseMove.price) return;
    const i = this.yt.am().Qt(), n = this.yt.Sv();
    this.tm = true, i.G_(n, this.Ki, t.localY);
  }
  gv(t) {
    if (null === this.Ki || !this.yn.handleScale.axisPressedMouseMove.price) return;
    const i = this.yt.am().Qt(), n = this.yt.Sv(), s = this.Ki;
    i.X_(n, s, t.localY);
  }
  vm() {
    if (null === this.Ki || !this.yn.handleScale.axisPressedMouseMove.price) return;
    const t = this.yt.am().Qt(), i = this.yt.Sv(), n = this.Ki;
    this.tm && (this.tm = false, t.J_(i, n));
  }
  bv(t) {
    if (null === this.Ki || !this.yn.handleScale.axisPressedMouseMove.price) return;
    const i = this.yt.am().Qt(), n = this.yt.Sv();
    this.tm = false, i.J_(n, this.Ki);
  }
  wm(t) {
    this.yn.handleScale.axisDoubleClickReset.price && this.Os();
  }
  Mm(t) {
    if (null === this.Ki) return;
    !this.yt.am().Qt().N().handleScale.axisPressedMouseMove.price || this.Ki.je() || this.Ki.Lo() || this.Em(1);
  }
  wv(t) {
    this.Em(0);
  }
  xm() {
    const t = [], i = null === this.Ki ? void 0 : this.Ki;
    return ((n) => {
      for (let s = 0; s < n.length; ++s) {
        const e2 = n[s].qn(this.yt.Sv(), i);
        for (let i2 = 0; i2 < e2.length; i2++) t.push(e2[i2]);
      }
    })(this.yt.Sv().Dt()), t;
  }
  Tm({ context: t, bitmapSize: i }) {
    const { width: n, height: s } = i, e2 = this.yt.Sv().Qt(), r2 = e2.$(), h2 = e2.ef();
    r2 === h2 ? z(t, 0, 0, n, s, r2) : F(t, 0, 0, n, s, r2, h2);
  }
  Rm({ context: t, bitmapSize: i, horizontalPixelRatio: n }) {
    if (null === this.Qv || null === this.Ki || !this.Ki.N().borderVisible) return;
    t.fillStyle = this.Ki.N().borderColor;
    const s = Math.max(1, Math.floor(this.gm().S * n));
    let e2;
    e2 = this.om ? i.width - s : 0, t.fillRect(e2, 0, s, i.height);
  }
  Im(t) {
    if (null === this.Qv || null === this.Ki) return;
    const i = this.Ki.El(), n = this.Ki.N(), s = this.gm(), e2 = this.om ? this.Qv.width - s.C : 0;
    n.borderVisible && n.ticksVisible && t.useBitmapCoordinateSpace((({ context: t2, horizontalPixelRatio: r2, verticalPixelRatio: h2 }) => {
      t2.fillStyle = n.borderColor;
      const a2 = Math.max(1, Math.floor(h2)), l2 = Math.floor(0.5 * h2), o2 = Math.round(s.C * r2);
      t2.beginPath();
      for (const n2 of i) t2.rect(Math.floor(e2 * r2), Math.round(n2.Rl * h2) - l2, o2, a2);
      t2.fill();
    })), t.useMediaCoordinateSpace((({ context: t2 }) => {
      t2.font = this.Sm(), t2.fillStyle = n.textColor ?? this.ko.textColor, t2.textAlign = this.om ? "right" : "left", t2.textBaseline = "middle";
      const r2 = this.om ? Math.round(e2 - s.V) : Math.round(e2 + s.C + s.V), h2 = i.map(((i2) => this.im.Di(t2, i2.io)));
      for (let n2 = i.length; n2--; ) {
        const s2 = i[n2];
        t2.fillText(s2.io, r2, s2.Rl + h2[n2]);
      }
    }));
  }
  Pm() {
    if (null === this.Qv || null === this.Ki) return;
    let t = this.Qv.height / 2;
    const i = [], n = this.Ki.Dt().slice(), s = this.yt.Sv(), e2 = this.gm();
    this.Ki === s.Gs() && this.yt.Sv().Dt().forEach(((t2) => {
      s.Zs(t2) && n.push(t2);
    }));
    const r2 = this.Ki.Cl()[0], h2 = this.Ki;
    n.forEach(((n2) => {
      const e3 = n2.qn(s, h2);
      e3.forEach(((t2) => {
        t2.$i() && null === t2.Wi() && (t2.Ui(null), i.push(t2));
      })), r2 === n2 && e3.length > 0 && (t = e3[0].Ei());
    }));
    this.Ki.N().alignLabels && this.Am(i, e2, t);
  }
  Am(t, i, n) {
    if (null === this.Qv) return;
    const s = t.filter(((t2) => t2.Ei() <= n)), e2 = t.filter(((t2) => t2.Ei() > n));
    s.sort(((t2, i2) => i2.Ei() - t2.Ei())), s.length && e2.length && e2.push(s[0]), e2.sort(((t2, i2) => t2.Ei() - i2.Ei()));
    for (const n2 of t) {
      const t2 = Math.floor(n2.$t(i) / 2), s2 = n2.Ei();
      s2 > -t2 && s2 < t2 && n2.Ui(t2), s2 > this.Qv.height - t2 && s2 < this.Qv.height + t2 && n2.Ui(this.Qv.height - t2);
    }
    Ln(s, 1, this.Qv.height, i), Ln(e2, -1, this.Qv.height, i);
  }
  Vm(t) {
    if (null === this.Qv) return;
    const i = this.xm(), n = this.gm(), s = this.om ? "right" : "left";
    i.forEach(((i2) => {
      if (i2.ji()) {
        i2.Tt(u(this.Ki)).st(t, n, this.im, s);
      }
    }));
  }
  Bm(t) {
    if (null === this.Qv || null === this.Ki) return;
    const i = this.yt.am().Qt(), n = [], s = this.yt.Sv(), e2 = i.Rd().qn(s, this.Ki);
    e2.length && n.push(e2);
    const r2 = this.gm(), h2 = this.om ? "right" : "left";
    n.forEach(((i2) => {
      i2.forEach(((i3) => {
        i3.Tt(u(this.Ki)).st(t, r2, this.im, h2);
      }));
    }));
  }
  Em(t) {
    this.lv.style.cursor = 1 === t ? "ns-resize" : "default";
  }
  po() {
    const t = this.bm();
    this.sm < t && this.yt.am().Qt().Pa(), this.sm = t;
  }
  Sm() {
    return x(this.ko.fontSize, this.ko.fontFamily);
  }
}
function On(t, i) {
  return t.Ka?.(i) ?? [];
}
function Nn(t, i) {
  return t.jn?.(i) ?? [];
}
function Fn(t, i) {
  return t.cn?.(i) ?? [];
}
function Wn(t, i) {
  return t.ja?.(i) ?? [];
}
class Hn {
  constructor(i, n) {
    this.Qv = size({ width: 0, height: 0 }), this.Lm = null, this.zm = null, this.Om = null, this.Nm = null, this.Fm = false, this.Wm = new d(), this.Hm = new d(), this.Um = 0, this.$m = false, this.jm = null, this.qm = false, this.Ym = null, this.Km = null, this.rm = false, this.hm = () => {
      this.rm || null === this.Zm || this.sn().mr();
    }, this.lm = () => {
      this.rm || null === this.Zm || this.sn().mr();
    }, this.qv = i, this.Zm = n, this.Zm.fu().i(this.Gm.bind(this), this, true), this.Xm = document.createElement("td"), this.Xm.style.padding = "0", this.Xm.style.position = "relative";
    const s = document.createElement("div");
    s.style.width = "100%", s.style.height = "100%", s.style.position = "relative", s.style.overflow = "hidden", this.Jm = document.createElement("td"), this.Jm.style.padding = "0", this.Qm = document.createElement("td"), this.Qm.style.padding = "0", this.Xm.appendChild(s), this.fm = Dn(s, size({ width: 16, height: 16 })), this.fm.subscribeSuggestedBitmapSizeChanged(this.hm);
    const e2 = this.fm.canvasElement;
    e2.style.position = "absolute", e2.style.zIndex = "1", e2.style.left = "0", e2.style.top = "0", this.pm = Dn(s, size({ width: 16, height: 16 })), this.pm.subscribeSuggestedBitmapSizeChanged(this.lm);
    const r2 = this.pm.canvasElement;
    r2.style.position = "absolute", r2.style.zIndex = "2", r2.style.left = "0", r2.style.top = "0", this.av = document.createElement("tr"), this.av.appendChild(this.Jm), this.av.appendChild(this.Xm), this.av.appendChild(this.Qm), this.tw(), this.tv = new Mn(this.pm.canvasElement, this, { xp: () => null === this.jm && !this.qv.N().handleScroll.vertTouchDrag, Cp: () => null === this.jm && !this.qv.N().handleScroll.horzTouchDrag });
  }
  m() {
    null !== this.Lm && this.Lm.m(), null !== this.zm && this.zm.m(), this.Om = null, this.pm.unsubscribeSuggestedBitmapSizeChanged(this.lm), In(this.pm.canvasElement), this.pm.dispose(), this.fm.unsubscribeSuggestedBitmapSizeChanged(this.hm), In(this.fm.canvasElement), this.fm.dispose(), null !== this.Zm && (this.Zm.fu().u(this), this.Zm.m()), this.tv.m();
  }
  Sv() {
    return u(this.Zm);
  }
  iw(t) {
    null !== this.Zm && this.Zm.fu().u(this), this.Zm = t, null !== this.Zm && this.Zm.fu().i(Hn.prototype.Gm.bind(this), this, true), this.tw(), this.qv.rv().indexOf(this) === this.qv.rv().length - 1 ? (this.Om = this.Om ?? new Rn(this.Xm, this.qv), this.Om.kt()) : (this.Om?.Kv(), this.Om = null);
  }
  am() {
    return this.qv;
  }
  uv() {
    return this.av;
  }
  tw() {
    if (null !== this.Zm && (this.nw(), 0 !== this.sn().Jn().length)) {
      if (null !== this.Lm) {
        const t = this.Zm.K_();
        this.Lm.un(u(t));
      }
      if (null !== this.zm) {
        const t = this.Zm.Z_();
        this.zm.un(u(t));
      }
    }
  }
  sw() {
    null !== this.Lm && this.Lm.kt(), null !== this.zm && this.zm.kt();
  }
  z_() {
    return null !== this.Zm ? this.Zm.z_() : 0;
  }
  O_(t) {
    this.Zm && this.Zm.O_(t);
  }
  wp(t) {
    if (!this.Zm) return;
    this.ew();
    const i = t.localX, n = t.localY;
    this.rw(i, n, t);
  }
  zp(t) {
    this.ew(), this.hw(), this.rw(t.localX, t.localY, t);
  }
  Mp(t) {
    if (!this.Zm) return;
    this.ew();
    const i = t.localX, n = t.localY;
    this.rw(i, n, t);
  }
  Vp(t) {
    null !== this.Zm && (this.ew(), this.rw(t.localX, t.localY, t), this.aw(t));
  }
  up(t) {
    null !== this.Zm && this.lw(this.Hm, t);
  }
  ap(t) {
    this.up(t);
  }
  Pp(t) {
    this.ew(), this.ow(t), this.rw(t.localX, t.localY, t);
  }
  Ip(t) {
    null !== this.Zm && (this.ew(), this.$m = false, this._w(t));
  }
  Dp(t) {
    null !== this.Zm && this.aw(t);
  }
  Kp(t) {
    if (this.$m = true, null === this.jm) {
      const i = { x: t.localX, y: t.localY };
      this.uw(i, i, t);
    }
  }
  Yp(t) {
    null !== this.Zm && (this.ew(), this.Zm.Qt().kd(null), this.cw());
  }
  dw() {
    return this.Wm;
  }
  fw() {
    return this.Hm;
  }
  Wp() {
    this.Um = 1, this.sn().cs();
  }
  Hp(t, i) {
    if (!this.qv.N().handleScale.pinch) return;
    const n = 5 * (i - this.Um);
    this.Um = i, this.sn().Od(t._t, n);
  }
  Ap(t) {
    this.$m = false, this.qm = null !== this.jm, this.hw();
    const i = this.sn().Rd();
    null !== this.jm && i.It() && (this.Ym = { x: i.ni(), y: i.si() }, this.jm = { x: t.localX, y: t.localY });
  }
  yp(t) {
    if (null === this.Zm) return;
    const i = t.localX, n = t.localY;
    if (null === this.jm) this.ow(t);
    else {
      this.qm = false;
      const s = u(this.Ym), e2 = s.x + (i - this.jm.x), r2 = s.y + (n - this.jm.y);
      this.rw(e2, r2, t);
    }
  }
  Rp(t) {
    0 === this.am().N().trackingMode.exitMode && (this.qm = true), this.pw(), this._w(t);
  }
  Qs(t, i) {
    const n = this.Zm;
    return null === n ? null : Bi(n, t, i);
  }
  mw(i, n) {
    u("left" === n ? this.Lm : this.zm).Cm(size({ width: i, height: this.Qv.height }));
  }
  cv() {
    return this.Qv;
  }
  Cm(t) {
    equalSizes(this.Qv, t) || (this.Qv = t, this.rm = true, this.fm.resizeCanvasElement(t), this.pm.resizeCanvasElement(t), this.rm = false, this.Xm.style.width = t.width + "px", this.Xm.style.height = t.height + "px");
  }
  ww() {
    const t = u(this.Zm);
    t.q_(t.K_()), t.q_(t.Z_());
    for (const i of t.Cl()) if (t.Zs(i)) {
      const n = i.Ft();
      null !== n && t.q_(n), i.Nn();
    }
    for (const i of t.vu()) i.Nn();
  }
  dv() {
    return this.fm.bitmapSize;
  }
  fv(t, i, n, s) {
    const e2 = this.dv();
    if (e2.width > 0 && e2.height > 0 && (t.drawImage(this.fm.canvasElement, i, n), s)) {
      const s2 = this.pm.canvasElement;
      null !== t && t.drawImage(s2, i, n);
    }
  }
  km(t) {
    if (0 === t) return;
    if (null === this.Zm) return;
    t > 1 && this.ww(), null !== this.Lm && this.Lm.km(t), null !== this.zm && this.zm.km(t);
    const i = { colorSpace: this.qv.N().layout.colorSpace };
    if (1 !== t) {
      this.fm.applySuggestedBitmapSize();
      const t2 = tryCreateCanvasRenderingTarget2D(this.fm, i);
      null !== t2 && (t2.useBitmapCoordinateSpace(((t3) => {
        this.Tm(t3);
      })), this.Zm && (this.Mw(t2, On), this.gw(t2), this.Mw(t2, Nn), this.Mw(t2, Fn)));
    }
    this.pm.applySuggestedBitmapSize();
    const n = tryCreateCanvasRenderingTarget2D(this.pm, i);
    null !== n && (n.useBitmapCoordinateSpace((({ context: t2, bitmapSize: i2 }) => {
      t2.clearRect(0, 0, i2.width, i2.height);
    })), this.bw(n), this.Mw(n, Wn), this.Mw(n, Fn));
  }
  Sw() {
    return this.Lm;
  }
  xw() {
    return this.zm;
  }
  Dm(t, i) {
    this.Mw(t, i);
  }
  Gm() {
    null !== this.Zm && this.Zm.fu().u(this), this.Zm = null;
  }
  aw(t) {
    this.lw(this.Wm, t);
  }
  lw(t, i) {
    const n = i.localX, s = i.localY;
    t.v() && t.p(this.sn().Et().Rc(n), { x: n, y: s }, i);
  }
  Tm({ context: t, bitmapSize: i }) {
    const { width: n, height: s } = i, e2 = this.sn(), r2 = e2.$(), h2 = e2.ef();
    r2 === h2 ? z(t, 0, 0, n, s, h2) : F(t, 0, 0, n, s, r2, h2);
  }
  gw(t) {
    const i = u(this.Zm), n = i.pu().wr().Tt(i);
    null !== n && n.st(t, false);
  }
  bw(t) {
    this.Cw(t, Nn, Bn, this.sn().Rd());
  }
  Mw(t, i) {
    const n = u(this.Zm), s = n.au(), e2 = n.vu();
    for (const n2 of e2) this.Cw(t, i, Vn, n2);
    for (const n2 of s) this.Cw(t, i, Vn, n2);
    for (const n2 of e2) this.Cw(t, i, Bn, n2);
    for (const n2 of s) this.Cw(t, i, Bn, n2);
  }
  Cw(t, i, n, s) {
    const e2 = u(this.Zm), r2 = e2.Qt().ou(), h2 = null !== r2 && r2.lu === s, a2 = null !== r2 && h2 && void 0 !== r2.wu ? r2.wu.ie : void 0;
    En(i, ((i2) => n(i2, t, h2, a2)), s, e2);
  }
  nw() {
    if (null === this.Zm) return;
    const t = this.qv, i = this.Zm.K_().N().visible, n = this.Zm.Z_().N().visible;
    i || null === this.Lm || (this.Jm.removeChild(this.Lm.uv()), this.Lm.m(), this.Lm = null), n || null === this.zm || (this.Qm.removeChild(this.zm.uv()), this.zm.m(), this.zm = null);
    const s = t.Qt().Zd();
    i && null === this.Lm && (this.Lm = new zn(this, t.N(), s, "left"), this.Jm.appendChild(this.Lm.uv())), n && null === this.zm && (this.zm = new zn(this, t.N(), s, "right"), this.Qm.appendChild(this.zm.uv()));
  }
  yw(t) {
    return t.Zp && this.$m || null !== this.jm;
  }
  rw(t, i, n) {
    t = Math.max(0, Math.min(t, this.Qv.width - 1)), i = Math.max(0, Math.min(i, this.Qv.height - 1)), this.sn().jd(t, i, n, u(this.Zm));
  }
  cw() {
    this.sn().Yd();
  }
  pw() {
    this.qm && (this.jm = null, this.cw());
  }
  uw(t, i, n) {
    this.jm = t, this.qm = false, this.rw(i.x, i.y, n);
    const s = this.sn().Rd();
    this.Ym = { x: s.ni(), y: s.si() };
  }
  sn() {
    return this.qv.Qt();
  }
  _w(t) {
    if (!this.Fm) return;
    const i = this.sn(), n = this.Sv();
    if (i.iu(n, n.Pn()), this.Nm = null, this.Fm = false, i.Hd(), null !== this.Km) {
      const t2 = performance.now(), n2 = i.Et();
      this.Km.me(n2.Ac(), t2), this.Km.jc(t2) || i.ps(this.Km);
    }
  }
  ew() {
    this.jm = null;
  }
  hw() {
    if (!this.Zm) return;
    if (this.sn().cs(), document.activeElement !== document.body && document.activeElement !== document.documentElement) u(document.activeElement).blur();
    else {
      const t = document.getSelection();
      null !== t && t.removeAllRanges();
    }
    !this.Zm.Pn().Gi() && this.sn().Et().Gi();
  }
  ow(t) {
    if (null === this.Zm) return;
    const i = this.sn(), n = i.Et();
    if (n.Gi()) return;
    const s = this.qv.N(), e2 = s.handleScroll, r2 = s.kineticScroll;
    if ((!e2.pressedMouseMove || t.Zp) && (!e2.horzTouchDrag && !e2.vertTouchDrag || !t.Zp)) return;
    const h2 = this.Zm.Pn(), a2 = performance.now();
    if (null !== this.Nm || this.yw(t) || (this.Nm = { x: t.clientX, y: t.clientY, Sf: a2, kw: t.localX, Pw: t.localY }), null !== this.Nm && !this.Fm && (this.Nm.x !== t.clientX || this.Nm.y !== t.clientY)) {
      if (t.Zp && r2.touch || !t.Zp && r2.mouse) {
        const t2 = n.fl();
        this.Km = new Tn(0.2 / t2, 7 / t2, 0.997, 15 / t2), this.Km.Fv(n.Ac(), this.Nm.Sf);
      } else this.Km = null;
      h2.Gi() || i.Q_(this.Zm, h2, t.localY), i.Fd(t.localX), this.Fm = true;
    }
    this.Fm && (h2.Gi() || i.tu(this.Zm, h2, t.localY), i.Wd(t.localX), null !== this.Km && this.Km.Fv(n.Ac(), a2));
  }
}
class Un {
  constructor(i, n, s, e2, r2) {
    this.xt = true, this.Qv = size({ width: 0, height: 0 }), this.hm = () => this.km(3), this.om = "left" === i, this.wd = s.Zd, this.yn = n, this.Tw = e2, this.Rw = r2, this.lv = document.createElement("div"), this.lv.style.width = "25px", this.lv.style.height = "100%", this.lv.style.overflow = "hidden", this.fm = Dn(this.lv, size({ width: 16, height: 16 })), this.fm.subscribeSuggestedBitmapSizeChanged(this.hm);
  }
  m() {
    this.fm.unsubscribeSuggestedBitmapSizeChanged(this.hm), In(this.fm.canvasElement), this.fm.dispose();
  }
  uv() {
    return this.lv;
  }
  cv() {
    return this.Qv;
  }
  Cm(t) {
    equalSizes(this.Qv, t) || (this.Qv = t, this.fm.resizeCanvasElement(t), this.lv.style.width = `${t.width}px`, this.lv.style.height = `${t.height}px`, this.xt = true);
  }
  km(t) {
    if (t < 3 && !this.xt) return;
    if (0 === this.Qv.width || 0 === this.Qv.height) return;
    this.xt = false, this.fm.applySuggestedBitmapSize();
    const i = tryCreateCanvasRenderingTarget2D(this.fm, { colorSpace: this.yn.layout.colorSpace });
    null !== i && i.useBitmapCoordinateSpace(((t2) => {
      this.Tm(t2), this.Rm(t2);
    }));
  }
  dv() {
    return this.fm.bitmapSize;
  }
  fv(t, i, n) {
    const s = this.dv();
    s.width > 0 && s.height > 0 && t.drawImage(this.fm.canvasElement, i, n);
  }
  Rm({ context: t, bitmapSize: i, horizontalPixelRatio: n, verticalPixelRatio: s }) {
    if (!this.Tw()) return;
    t.fillStyle = this.yn.timeScale.borderColor;
    const e2 = Math.floor(this.wd.N().S * n), r2 = Math.floor(this.wd.N().S * s), h2 = this.om ? i.width - e2 : 0;
    t.fillRect(h2, 0, e2, r2);
  }
  Tm({ context: t, bitmapSize: i }) {
    z(t, 0, 0, i.width, i.height, this.Rw());
  }
}
function $n(t) {
  return (i) => i.Xa?.(t) ?? [];
}
const jn = $n("normal"), qn = $n("top"), Yn = $n("bottom");
class Kn {
  constructor(i, n) {
    this.Dw = null, this.Iw = null, this.M = null, this.Vw = false, this.Qv = size({ width: 0, height: 0 }), this.Bw = new d(), this.im = new rt(5), this.rm = false, this.hm = () => {
      this.rm || this.qv.Qt().mr();
    }, this.lm = () => {
      this.rm || this.qv.Qt().mr();
    }, this.qv = i, this.xu = n, this.yn = i.N().layout, this.Hv = document.createElement("tr"), this.Ew = document.createElement("td"), this.Ew.style.padding = "0", this.Aw = document.createElement("td"), this.Aw.style.padding = "0", this.lv = document.createElement("td"), this.lv.style.height = "25px", this.lv.style.padding = "0", this.Lw = document.createElement("div"), this.Lw.style.width = "100%", this.Lw.style.height = "100%", this.Lw.style.position = "relative", this.Lw.style.overflow = "hidden", this.lv.appendChild(this.Lw), this.fm = Dn(this.Lw, size({ width: 16, height: 16 })), this.fm.subscribeSuggestedBitmapSizeChanged(this.hm);
    const s = this.fm.canvasElement;
    s.style.position = "absolute", s.style.zIndex = "1", s.style.left = "0", s.style.top = "0", this.pm = Dn(this.Lw, size({ width: 16, height: 16 })), this.pm.subscribeSuggestedBitmapSizeChanged(this.lm);
    const e2 = this.pm.canvasElement;
    e2.style.position = "absolute", e2.style.zIndex = "2", e2.style.left = "0", e2.style.top = "0", this.Hv.appendChild(this.Ew), this.Hv.appendChild(this.lv), this.Hv.appendChild(this.Aw), this.zw(), this.qv.Qt().L_().i(this.zw.bind(this), this), this.tv = new Mn(this.pm.canvasElement, this, { xp: () => true, Cp: () => !this.qv.N().handleScroll.horzTouchDrag });
  }
  m() {
    this.tv.m(), null !== this.Dw && this.Dw.m(), null !== this.Iw && this.Iw.m(), this.pm.unsubscribeSuggestedBitmapSizeChanged(this.lm), In(this.pm.canvasElement), this.pm.dispose(), this.fm.unsubscribeSuggestedBitmapSizeChanged(this.hm), In(this.fm.canvasElement), this.fm.dispose();
  }
  uv() {
    return this.Hv;
  }
  Ow() {
    return this.Dw;
  }
  Nw() {
    return this.Iw;
  }
  zp(t) {
    if (this.Vw) return;
    this.Vw = true;
    const i = this.qv.Qt();
    !i.Et().Gi() && this.qv.N().handleScale.axisPressedMouseMove.time && i.zd(t.localX);
  }
  Ap(t) {
    this.zp(t);
  }
  Op() {
    const t = this.qv.Qt();
    !t.Et().Gi() && this.Vw && (this.Vw = false, this.qv.N().handleScale.axisPressedMouseMove.time && t.$d());
  }
  Pp(t) {
    const i = this.qv.Qt();
    !i.Et().Gi() && this.qv.N().handleScale.axisPressedMouseMove.time && i.Ud(t.localX);
  }
  yp(t) {
    this.Pp(t);
  }
  Ip() {
    this.Vw = false;
    const t = this.qv.Qt();
    t.Et().Gi() && !this.qv.N().handleScale.axisPressedMouseMove.time || t.$d();
  }
  Rp() {
    this.Ip();
  }
  up() {
    this.qv.N().handleScale.axisDoubleClickReset.time && this.qv.Qt().ws();
  }
  ap() {
    this.up();
  }
  wp() {
    this.qv.Qt().N().handleScale.axisPressedMouseMove.time && this.Em(1);
  }
  Yp() {
    this.Em(0);
  }
  cv() {
    return this.Qv;
  }
  Fw() {
    return this.Bw;
  }
  Ww(i, s, e2) {
    equalSizes(this.Qv, i) || (this.Qv = i, this.rm = true, this.fm.resizeCanvasElement(i), this.pm.resizeCanvasElement(i), this.rm = false, this.lv.style.width = `${i.width}px`, this.lv.style.height = `${i.height}px`, this.Bw.p(i)), null !== this.Dw && this.Dw.Cm(size({ width: s, height: i.height })), null !== this.Iw && this.Iw.Cm(size({ width: e2, height: i.height }));
  }
  Hw() {
    const t = this.Uw();
    return Math.ceil(t.S + t.C + t.k + t.A + t.I + t.$w);
  }
  kt() {
    this.qv.Qt().Et().El();
  }
  dv() {
    return this.fm.bitmapSize;
  }
  fv(t, i, n, s) {
    const e2 = this.dv();
    if (e2.width > 0 && e2.height > 0 && (t.drawImage(this.fm.canvasElement, i, n), s)) {
      const s2 = this.pm.canvasElement;
      t.drawImage(s2, i, n);
    }
  }
  km(t) {
    if (0 === t) return;
    const i = { colorSpace: this.yn.colorSpace };
    if (1 !== t) {
      this.fm.applySuggestedBitmapSize();
      const n2 = tryCreateCanvasRenderingTarget2D(this.fm, i);
      null !== n2 && (n2.useBitmapCoordinateSpace(((t2) => {
        this.Tm(t2), this.Rm(t2), this.jw(n2, Yn);
      })), this.Im(n2), this.jw(n2, jn)), null !== this.Dw && this.Dw.km(t), null !== this.Iw && this.Iw.km(t);
    }
    this.pm.applySuggestedBitmapSize();
    const n = tryCreateCanvasRenderingTarget2D(this.pm, i);
    null !== n && (n.useBitmapCoordinateSpace((({ context: t2, bitmapSize: i2 }) => {
      t2.clearRect(0, 0, i2.width, i2.height);
    })), this.qw([...this.qv.Qt().Jn(), this.qv.Qt().Rd()], n), this.jw(n, qn));
  }
  jw(t, i) {
    const n = this.qv.Qt().Jn();
    for (const s of n) En(i, ((i2) => Vn(i2, t, false, void 0)), s, void 0);
    for (const s of n) En(i, ((i2) => Bn(i2, t, false, void 0)), s, void 0);
  }
  Tm({ context: t, bitmapSize: i }) {
    z(t, 0, 0, i.width, i.height, this.qv.Qt().ef());
  }
  Rm({ context: t, bitmapSize: i, verticalPixelRatio: n }) {
    if (this.qv.N().timeScale.borderVisible) {
      t.fillStyle = this.Yw();
      const s = Math.max(1, Math.floor(this.Uw().S * n));
      t.fillRect(0, 0, i.width, s);
    }
  }
  Im(t) {
    const i = this.qv.Qt().Et(), n = i.El();
    if (!n || 0 === n.length) return;
    const s = this.xu.maxTickMarkWeight(n), e2 = this.Uw(), r2 = i.N();
    r2.borderVisible && r2.ticksVisible && t.useBitmapCoordinateSpace((({ context: t2, horizontalPixelRatio: i2, verticalPixelRatio: s2 }) => {
      t2.strokeStyle = this.Yw(), t2.fillStyle = this.Yw();
      const r3 = Math.max(1, Math.floor(i2)), h2 = Math.floor(0.5 * i2);
      t2.beginPath();
      const a2 = Math.round(e2.C * s2);
      for (let s3 = n.length; s3--; ) {
        const e3 = Math.round(n[s3].coord * i2);
        t2.rect(e3 - h2, 0, r3, a2);
      }
      t2.fill();
    })), t.useMediaCoordinateSpace((({ context: t2 }) => {
      const i2 = e2.S + e2.C + e2.A + e2.k / 2;
      t2.textAlign = "center", t2.textBaseline = "middle", t2.fillStyle = this.H(), t2.font = this.Sm();
      for (const e3 of n) if (e3.weight < s) {
        const n2 = e3.needAlignCoordinate ? this.Kw(t2, e3.coord, e3.label) : e3.coord;
        t2.fillText(e3.label, n2, i2);
      }
      this.qv.N().timeScale.allowBoldLabels && (t2.font = this.Zw());
      for (const e3 of n) if (e3.weight >= s) {
        const n2 = e3.needAlignCoordinate ? this.Kw(t2, e3.coord, e3.label) : e3.coord;
        t2.fillText(e3.label, n2, i2);
      }
    }));
  }
  Kw(t, i, n) {
    const s = this.im.Ii(t, n), e2 = s / 2, r2 = Math.floor(i - e2) + 0.5;
    return r2 < 0 ? i += Math.abs(0 - r2) : r2 + s > this.Qv.width && (i -= Math.abs(this.Qv.width - (r2 + s))), i;
  }
  qw(t, i) {
    const n = this.Uw();
    for (const s of t) for (const t2 of s.dn()) t2.Tt().st(i, n);
  }
  Yw() {
    return this.qv.N().timeScale.borderColor;
  }
  H() {
    return this.yn.textColor;
  }
  F() {
    return this.yn.fontSize;
  }
  Sm() {
    return x(this.F(), this.yn.fontFamily);
  }
  Zw() {
    return x(this.F(), this.yn.fontFamily, "bold");
  }
  Uw() {
    null === this.M && (this.M = { S: 1, L: NaN, A: NaN, I: NaN, tn: NaN, C: 5, k: NaN, P: "", Qi: new rt(), $w: 0 });
    const t = this.M, i = this.Sm();
    if (t.P !== i) {
      const n = this.F();
      t.k = n, t.P = i, t.A = 3 * n / 12, t.I = 3 * n / 12, t.tn = 9 * n / 12, t.L = 0, t.$w = 4 * n / 12, t.Qi.Os();
    }
    return this.M;
  }
  Em(t) {
    this.lv.style.cursor = 1 === t ? "ew-resize" : "default";
  }
  zw() {
    const t = this.qv.Qt(), i = t.N();
    i.leftPriceScale.visible || null === this.Dw || (this.Ew.removeChild(this.Dw.uv()), this.Dw.m(), this.Dw = null), i.rightPriceScale.visible || null === this.Iw || (this.Aw.removeChild(this.Iw.uv()), this.Iw.m(), this.Iw = null);
    const n = { Zd: this.qv.Qt().Zd() }, s = () => i.leftPriceScale.borderVisible && t.Et().N().borderVisible, e2 = () => t.ef();
    i.leftPriceScale.visible && null === this.Dw && (this.Dw = new Un("left", i, n, s, e2), this.Ew.appendChild(this.Dw.uv())), i.rightPriceScale.visible && null === this.Iw && (this.Iw = new Un("right", i, n, s, e2), this.Aw.appendChild(this.Iw.uv()));
  }
}
const Zn = !!dn && !!navigator.userAgentData && navigator.userAgentData.brands.some(((t) => t.brand.includes("Chromium"))) && !!dn && (navigator?.userAgentData?.platform ? "Windows" === navigator.userAgentData.platform : navigator.userAgent.toLowerCase().indexOf("win") >= 0);
class Gn {
  constructor(t, i, n) {
    var s;
    this.Gw = [], this.Xw = [], this.Jw = 0, this.ho = 0, this.C_ = 0, this.Qw = 0, this.tM = 0, this.iM = null, this.nM = false, this.Wm = new d(), this.Hm = new d(), this.pd = new d(), this.sM = null, this.eM = null, this.jv = t, this.yn = i, this.xu = n, this.Hv = document.createElement("div"), this.Hv.classList.add("tv-lightweight-charts"), this.Hv.style.overflow = "hidden", this.Hv.style.direction = "ltr", this.Hv.style.width = "100%", this.Hv.style.height = "100%", (s = this.Hv).style.userSelect = "none", s.style.webkitUserSelect = "none", s.style.msUserSelect = "none", s.style.MozUserSelect = "none", s.style.webkitTapHighlightColor = "transparent", this.rM = document.createElement("table"), this.rM.setAttribute("cellspacing", "0"), this.Hv.appendChild(this.rM), this.hM = this.aM.bind(this), Xn(this.yn) && this.lM(true), this.sn = new qi(this.md.bind(this), this.yn, n), this.Qt().Dd().i(this.oM.bind(this), this), this._M = new Kn(this, this.xu), this.rM.appendChild(this._M.uv());
    const e2 = i.autoSize && this.uM();
    let r2 = this.yn.width, h2 = this.yn.height;
    if (e2 || 0 === r2 || 0 === h2) {
      const i2 = t.getBoundingClientRect();
      r2 = r2 || i2.width, h2 = h2 || i2.height;
    }
    this.cM(r2, h2), this.dM(), t.appendChild(this.Hv), this.fM(), this.sn.Et().Zc().i(this.sn.Pa.bind(this.sn), this), this.sn.L_().i(this.sn.Pa.bind(this.sn), this);
  }
  Qt() {
    return this.sn;
  }
  N() {
    return this.yn;
  }
  rv() {
    return this.Gw;
  }
  pM() {
    return this._M;
  }
  m() {
    this.lM(false), 0 !== this.Jw && window.cancelAnimationFrame(this.Jw), this.sn.Dd().u(this), this.sn.Et().Zc().u(this), this.sn.L_().u(this), this.sn.m();
    for (const t of this.Gw) this.rM.removeChild(t.uv()), t.dw().u(this), t.fw().u(this), t.m();
    this.Gw = [];
    for (const t of this.Xw) this.vM(t);
    this.Xw = [], u(this._M).m(), null !== this.Hv.parentElement && this.Hv.parentElement.removeChild(this.Hv), this.pd.m(), this.Wm.m(), this.Hm.m(), this.mM();
  }
  cM(i, n, s = false) {
    if (this.ho === n && this.C_ === i) return;
    const e2 = (function(i2) {
      const n2 = Math.floor(i2.width), s2 = Math.floor(i2.height);
      return size({ width: n2 - n2 % 2, height: s2 - s2 % 2 });
    })(size({ width: i, height: n }));
    this.ho = e2.height, this.C_ = e2.width;
    const r2 = this.ho + "px", h2 = this.C_ + "px";
    if (this.wM() || (u(this.Hv).style.height = r2, u(this.Hv).style.width = h2), this.rM.style.height = r2, this.rM.style.width = h2, s) {
      0 !== this.Jw && (window.cancelAnimationFrame(this.Jw), this.Jw = 0), this.nM = false;
      const t = X.ys();
      null !== this.iM && (t.Ss(this.iM), this.iM = null), this.MM(t, performance.now());
    } else this.sn.Pa();
  }
  km(t) {
    void 0 === t && (t = X.ys());
    for (let i = 0; i < this.Gw.length; i++) this.Gw[i].km(t._s(i).rs);
    this.yn.timeScale.visible && this._M.km(t.ls());
  }
  vr(t) {
    const i = Xn(this.yn);
    this.sn.vr(t);
    const n = Xn(this.yn);
    n !== i && this.lM(n), t.layout?.panes && this.gM(), this.fM(), this.bM(t);
  }
  dw() {
    return this.Wm;
  }
  fw() {
    return this.Hm;
  }
  Dd() {
    return this.pd;
  }
  SM(t = false) {
    null !== this.iM && (this.MM(this.iM, performance.now()), this.iM = null);
    const i = this.xM(null), n = document.createElement("canvas");
    n.width = i.width, n.height = i.height;
    const s = u(n.getContext("2d"));
    return this.xM(s, t), n;
  }
  CM(t) {
    if ("left" === t && !this.yM()) return 0;
    if ("right" === t && !this.kM()) return 0;
    if (0 === this.Gw.length) return 0;
    return u("left" === t ? this.Gw[0].Sw() : this.Gw[0].xw()).ym();
  }
  wM() {
    return this.yn.autoSize && null !== this.sM;
  }
  vv() {
    return this.Hv;
  }
  PM(t) {
    this.eM = t, this.eM ? this.vv().style.setProperty("cursor", t) : this.vv().style.removeProperty("cursor");
  }
  TM() {
    return this.eM;
  }
  RM(t) {
    return _(this.Gw[t]).cv();
  }
  gM() {
    this.Xw.forEach(((t) => {
      t.kt();
    }));
  }
  bM(t) {
    (void 0 !== t.autoSize || !this.sM || void 0 === t.width && void 0 === t.height) && (t.autoSize && !this.sM && this.uM(), false === t.autoSize && null !== this.sM && this.mM(), t.autoSize || void 0 === t.width && void 0 === t.height || this.cM(t.width || this.C_, t.height || this.ho));
  }
  xM(i, n) {
    let s = 0, e2 = 0;
    const r2 = this.Gw[0], h2 = (t, s2) => {
      let e3 = 0;
      for (let r3 = 0; r3 < this.Gw.length; r3++) {
        const h3 = this.Gw[r3], a3 = u("left" === t ? h3.Sw() : h3.xw()), l2 = a3.dv();
        if (null !== i && a3.fv(i, s2, e3, n), e3 += l2.height, r3 < this.Gw.length - 1) {
          const t2 = this.Xw[r3], n2 = t2.dv();
          null !== i && t2.fv(i, s2, e3), e3 += n2.height;
        }
      }
    };
    if (this.yM()) {
      h2("left", 0);
      s += u(r2.Sw()).dv().width;
    }
    for (let t = 0; t < this.Gw.length; t++) {
      const r3 = this.Gw[t], h3 = r3.dv();
      if (null !== i && r3.fv(i, s, e2, n), e2 += h3.height, t < this.Gw.length - 1) {
        const n2 = this.Xw[t], r4 = n2.dv();
        null !== i && n2.fv(i, s, e2), e2 += r4.height;
      }
    }
    if (s += r2.dv().width, this.kM()) {
      h2("right", s);
      s += u(r2.xw()).dv().width;
    }
    const a2 = (t, n2, s2) => {
      u("left" === t ? this._M.Ow() : this._M.Nw()).fv(u(i), n2, s2);
    };
    if (this.yn.timeScale.visible) {
      const t = this._M.dv();
      if (null !== i) {
        let s2 = 0;
        this.yM() && (a2("left", s2, e2), s2 = u(r2.Sw()).dv().width), this._M.fv(i, s2, e2, n), s2 += t.width, this.kM() && a2("right", s2, e2);
      }
      e2 += t.height;
    }
    return size({ width: s, height: e2 });
  }
  DM() {
    let i = 0, n = 0, s = 0;
    for (const t of this.Gw) this.yM() && (n = Math.max(n, u(t.Sw()).bm(), this.yn.leftPriceScale.minimumWidth)), this.kM() && (s = Math.max(s, u(t.xw()).bm(), this.yn.rightPriceScale.minimumWidth)), i += t.z_();
    n = mn(n), s = mn(s);
    const e2 = this.C_, r2 = this.ho, h2 = Math.max(e2 - n - s, 0), a2 = 1 * this.Xw.length, l2 = this.yn.timeScale.visible;
    let o2 = l2 ? Math.max(this._M.Hw(), this.yn.timeScale.minimumHeight) : 0;
    var _2;
    o2 = (_2 = o2) + _2 % 2;
    const c2 = a2 + o2, d2 = r2 < c2 ? 0 : r2 - c2, f2 = d2 / i;
    let p2 = 0;
    const v2 = window.devicePixelRatio || 1;
    for (let i2 = 0; i2 < this.Gw.length; ++i2) {
      const e3 = this.Gw[i2];
      e3.iw(this.sn.Zn()[i2]);
      let r3 = 0, a3 = 0;
      a3 = i2 === this.Gw.length - 1 ? Math.ceil((d2 - p2) * v2) / v2 : Math.round(e3.z_() * f2 * v2) / v2, r3 = Math.max(a3, 2), p2 += r3, e3.Cm(size({ width: h2, height: r3 })), this.yM() && e3.mw(n, "left"), this.kM() && e3.mw(s, "right"), e3.Sv() && this.sn.Id(e3.Sv(), r3);
    }
    this._M.Ww(size({ width: l2 ? h2 : 0, height: o2 }), l2 ? n : 0, l2 ? s : 0), this.sn.N_(h2), this.Qw !== n && (this.Qw = n), this.tM !== s && (this.tM = s);
  }
  lM(t) {
    t ? this.Hv.addEventListener("wheel", this.hM, { passive: false }) : this.Hv.removeEventListener("wheel", this.hM);
  }
  IM(t) {
    switch (t.deltaMode) {
      case t.DOM_DELTA_PAGE:
        return 120;
      case t.DOM_DELTA_LINE:
        return 32;
    }
    return Zn ? 1 / window.devicePixelRatio : 1;
  }
  aM(t) {
    if (!(0 !== t.deltaX && this.yn.handleScroll.mouseWheel || 0 !== t.deltaY && this.yn.handleScale.mouseWheel)) return;
    const i = this.IM(t), n = i * t.deltaX / 100, s = -i * t.deltaY / 100;
    if (t.cancelable && t.preventDefault(), 0 !== s && this.yn.handleScale.mouseWheel) {
      const i2 = Math.sign(s) * Math.min(1, Math.abs(s)), n2 = t.clientX - this.Hv.getBoundingClientRect().left;
      this.Qt().Od(n2, i2);
    }
    0 !== n && this.yn.handleScroll.mouseWheel && this.Qt().Nd(-80 * n);
  }
  MM(t, i) {
    const n = t.ls();
    3 === n && this.VM(), 3 !== n && 2 !== n || (this.BM(t), this.EM(t, i), this._M.kt(), this.Gw.forEach(((t2) => {
      t2.sw();
    })), 3 === this.iM?.ls() && (this.iM.Ss(t), this.VM(), this.BM(this.iM), this.EM(this.iM, i), t = this.iM, this.iM = null)), this.km(t);
  }
  EM(t, i) {
    for (const n of t.bs()) this.xs(n, i);
  }
  BM(t) {
    const i = this.sn.Zn();
    for (let n = 0; n < i.length; n++) t._s(n).hs && i[n].ru();
  }
  xs(t, i) {
    const n = this.sn.Et();
    switch (t.ds) {
      case 0:
        n.Xc();
        break;
      case 1:
        n.Jc(t.Wt);
        break;
      case 2:
        n.Ms(t.Wt);
        break;
      case 3:
        n.gs(t.Wt);
        break;
      case 4:
        n.Oc();
        break;
      case 5:
        t.Wt.jc(i) || n.gs(t.Wt.qc(i));
    }
  }
  md(t) {
    null !== this.iM ? this.iM.Ss(t) : this.iM = t, this.nM || (this.nM = true, this.Jw = window.requestAnimationFrame(((t2) => {
      if (this.nM = false, this.Jw = 0, null !== this.iM) {
        const i = this.iM;
        this.iM = null, this.MM(i, t2);
        for (const n of i.bs()) if (5 === n.ds && !n.Wt.jc(t2)) {
          this.Qt().ps(n.Wt);
          break;
        }
      }
    })));
  }
  VM() {
    this.dM();
  }
  vM(t) {
    this.rM.removeChild(t.uv()), t.m();
  }
  dM() {
    const t = this.sn.Zn(), i = t.length, n = this.Gw.length;
    for (let t2 = i; t2 < n; t2++) {
      const t3 = _(this.Gw.pop());
      this.rM.removeChild(t3.uv()), t3.dw().u(this), t3.fw().u(this), t3.m();
      const i2 = this.Xw.pop();
      void 0 !== i2 && this.vM(i2);
    }
    for (let s = n; s < i; s++) {
      const i2 = new Hn(this, t[s]);
      if (i2.dw().i(this.AM.bind(this, i2), this), i2.fw().i(this.LM.bind(this, i2), this), this.Gw.push(i2), s > 0) {
        const t2 = new yn(this, s - 1, s);
        this.Xw.push(t2), this.rM.insertBefore(t2.uv(), this._M.uv());
      }
      this.rM.insertBefore(i2.uv(), this._M.uv());
    }
    for (let n2 = 0; n2 < i; n2++) {
      const i2 = t[n2], s = this.Gw[n2];
      s.Sv() !== i2 ? s.iw(i2) : s.tw();
    }
    this.fM(), this.DM();
  }
  zM(t, i, n, s) {
    const e2 = /* @__PURE__ */ new Map();
    if (null !== t) {
      this.sn.Jn().forEach(((i2) => {
        const n2 = i2.Un().Hn(t);
        null !== n2 && e2.set(i2, n2);
      }));
    }
    let r2;
    if (null !== t) {
      const i2 = this.sn.Et().en(t)?.originalTime;
      void 0 !== i2 && (r2 = i2);
    }
    const h2 = this.Qt().ou(), a2 = this.OM(s), l2 = (function(t2, i2) {
      const n2 = null !== t2 && t2.lu instanceof Jt ? t2.lu : void 0, s2 = t2?.wu?.te, e3 = void 0 !== i2 && -1 !== i2 ? i2 : void 0;
      return null === t2 || void 0 === t2.ee ? { NM: n2, FM: s2 } : { NM: n2, FM: s2, WM: { ds: t2.ee, HM: (r3 = t2.lu, h3 = t2.ee, r3 instanceof ki ? "pane-primitive" : "marker" === h3 || "primitive" === h3 ? "series-primitive" : "series"), UM: vn(t2.ee, s2), U_: n2, $M: s2, jM: e3 } };
      var r3, h3;
    })(h2, a2);
    return { Qr: r2, $n: t ?? void 0, qM: i ?? void 0, jM: -1 !== a2 ? a2 : void 0, NM: l2.NM, YM: e2, FM: l2.FM, WM: l2.WM, KM: n ?? void 0 };
  }
  OM(t) {
    let i = -1;
    if (t) i = this.Gw.indexOf(t);
    else {
      const t2 = this.Qt().Rd().Kn();
      null !== t2 && (i = this.Qt().Zn().indexOf(t2));
    }
    return i;
  }
  AM(t, i, n, s) {
    this.Wm.p((() => this.zM(i, n, s, t)));
  }
  LM(t, i, n, s) {
    this.Hm.p((() => this.zM(i, n, s, t)));
  }
  oM(t, i, n) {
    this.PM(this.Qt().ou()?.mu ?? null), this.pd.p((() => this.zM(t, i, n)));
  }
  fM() {
    const t = this.yn.timeScale.visible ? "" : "none";
    this._M.uv().style.display = t;
  }
  yM() {
    return this.Gw[0].Sv().K_().N().visible;
  }
  kM() {
    return this.Gw[0].Sv().Z_().N().visible;
  }
  uM() {
    return "ResizeObserver" in window && (this.sM = new ResizeObserver(((t) => {
      const i = t[t.length - 1];
      if (!i) return;
      const n = i.contentRect.width, s = i.contentRect.height;
      this.cM(n, s, true);
    })), this.sM.observe(this.jv, { box: "border-box" }), true);
  }
  mM() {
    null !== this.sM && this.sM.disconnect(), this.sM = null;
  }
}
function Xn(t) {
  return Boolean(t.handleScroll.mouseWheel || t.handleScale.mouseWheel);
}
function Jn(t) {
  return void 0 === t.open && void 0 === t.value;
}
function Qn(t) {
  return (function(t2) {
    return void 0 !== t2.open;
  })(t) || (function(t2) {
    return void 0 !== t2.value;
  })(t);
}
function ts(t, i, n, s) {
  const e2 = n.value, r2 = { $n: i, wt: t, Wt: [e2, e2, e2, e2], Qr: s };
  return void 0 !== n.color && (r2.R = n.color), r2;
}
function is(t, i, n, s) {
  const e2 = n.value, r2 = { $n: i, wt: t, Wt: [e2, e2, e2, e2], Qr: s };
  return void 0 !== n.lineColor && (r2.vt = n.lineColor), void 0 !== n.topColor && (r2.ah = n.topColor), void 0 !== n.bottomColor && (r2.oh = n.bottomColor), r2;
}
function ns(t, i, n, s) {
  const e2 = n.value, r2 = { $n: i, wt: t, Wt: [e2, e2, e2, e2], Qr: s };
  return void 0 !== n.topLineColor && (r2._h = n.topLineColor), void 0 !== n.bottomLineColor && (r2.uh = n.bottomLineColor), void 0 !== n.topFillColor1 && (r2.dh = n.topFillColor1), void 0 !== n.topFillColor2 && (r2.fh = n.topFillColor2), void 0 !== n.bottomFillColor1 && (r2.ph = n.bottomFillColor1), void 0 !== n.bottomFillColor2 && (r2.mh = n.bottomFillColor2), r2;
}
function ss(t, i, n, s) {
  const e2 = { $n: i, wt: t, Wt: [n.open, n.high, n.low, n.close], Qr: s };
  return void 0 !== n.color && (e2.R = n.color), e2;
}
function es(t, i, n, s) {
  const e2 = { $n: i, wt: t, Wt: [n.open, n.high, n.low, n.close], Qr: s };
  return void 0 !== n.color && (e2.R = n.color), void 0 !== n.borderColor && (e2.Ht = n.borderColor), void 0 !== n.wickColor && (e2.hh = n.wickColor), e2;
}
function rs(t, i, n, s, e2) {
  const r2 = _(e2)(n), h2 = Math.max(...r2), a2 = Math.min(...r2), l2 = r2[r2.length - 1], o2 = [l2, h2, a2, l2], { time: u2, color: c2, ...d2 } = n;
  return { $n: i, wt: t, Wt: o2, Qr: s, ue: d2, R: c2 };
}
function hs(t) {
  return void 0 !== t.Wt;
}
function as(t, i) {
  return void 0 !== i.customValues && (t.ZM = i.customValues), t;
}
function ls(t) {
  return (i, n, s, e2, r2, h2) => (function(t2, i2) {
    return i2 ? i2(t2) : Jn(t2);
  })(s, h2) ? as({ wt: i, $n: n, Qr: e2 }, s) : as(t(i, n, s, e2, r2), s);
}
function os(t) {
  return { Candlestick: ls(es), Bar: ls(ss), Area: ls(is), Baseline: ls(ns), Histogram: ls(ts), Line: ls(ts), Custom: ls(rs) }[t];
}
function _s(t) {
  return { $n: 0, GM: /* @__PURE__ */ new Map(), za: t };
}
function us(t, i) {
  if (void 0 !== t && 0 !== t.length) return { XM: i.key(t[0].wt), JM: i.key(t[t.length - 1].wt) };
}
function cs(t) {
  let i;
  return t.forEach(((t2) => {
    void 0 === i && (i = t2.Qr);
  })), _(i);
}
class ds {
  constructor(t) {
    this.QM = /* @__PURE__ */ new Map(), this.tg = /* @__PURE__ */ new Map(), this.ig = /* @__PURE__ */ new Map(), this.ng = [], this.xu = t;
  }
  m() {
    this.QM.clear(), this.tg.clear(), this.ig.clear(), this.ng = [];
  }
  sg(t, i) {
    let n = 0 !== this.QM.size, s = false;
    const e2 = this.tg.get(t);
    if (void 0 !== e2) if (1 === this.tg.size) n = false, s = true, this.QM.clear();
    else for (const i2 of this.ng) i2.pointData.GM.delete(t) && (s = true);
    let r2 = [];
    if (0 !== i.length) {
      const n2 = i.map(((t2) => t2.time)), e3 = this.xu.createConverterToInternalObj(i), h3 = os(t.bh()), a2 = t.ll(), l2 = t.ol();
      r2 = i.map(((i2, r3) => {
        const o2 = e3(i2.time), _2 = this.xu.key(o2);
        let u2 = this.QM.get(_2);
        void 0 === u2 && (u2 = _s(o2), this.QM.set(_2, u2), s = true);
        const c2 = h3(o2, u2.$n, i2, n2[r3], a2, l2);
        return u2.GM.set(t, c2), c2;
      }));
    }
    n && this.eg(), this.rg(t, r2);
    let h2 = -1;
    if (s) {
      const t2 = [];
      this.QM.forEach(((i2) => {
        t2.push({ timeWeight: 0, time: i2.za, pointData: i2, originalTime: cs(i2.GM) });
      })), t2.sort(((t3, i2) => this.xu.key(t3.time) - this.xu.key(i2.time))), h2 = this.hg(t2);
    }
    return this.ag(t, h2, (function(t2, i2, n2) {
      const s2 = us(t2, n2), e3 = us(i2, n2);
      if (void 0 !== s2 && void 0 !== e3) return { lg: false, Ia: s2.JM >= e3.JM && s2.XM >= e3.XM };
    })(this.tg.get(t), e2, this.xu));
  }
  Jd(t) {
    return this.sg(t, []);
  }
  og(t, i, n) {
    if (n && t.Na()) throw new Error("Historical updates are not supported when conflation is enabled. Conflation requires data to be processed in order.");
    const s = i;
    !(function(t2) {
      void 0 === t2.Qr && (t2.Qr = t2.time);
    })(s), this.xu.preprocessData(i);
    const e2 = this.xu.createConverterToInternalObj([i])(i.time), r2 = this.ig.get(t);
    if (!n && void 0 !== r2 && this.xu.key(e2) < this.xu.key(r2)) throw new Error(`Cannot update oldest data, last time=${r2}, new time=${e2}`);
    let h2 = this.QM.get(this.xu.key(e2));
    if (n && void 0 === h2) throw new Error("Cannot update non-existing data point when historicalUpdate is true");
    const a2 = void 0 === h2;
    void 0 === h2 && (h2 = _s(e2), this.QM.set(this.xu.key(e2), h2));
    const l2 = os(t.bh()), o2 = t.ll(), _2 = t.ol(), u2 = l2(e2, h2.$n, i, s.Qr, o2, _2), c2 = !n && !a2 && void 0 !== r2 && this.xu.key(e2) === this.xu.key(r2);
    h2.GM.set(t, u2), n ? this._g(t, u2, h2.$n) : c2 && t.Na() && hs(u2) ? (t.Rr(u2), this.ug(t, u2)) : this.ug(t, u2);
    const d2 = { Ia: hs(u2), lg: n };
    if (!a2) return this.ag(t, -1, d2);
    const f2 = { timeWeight: 0, time: h2.za, pointData: h2, originalTime: cs(h2.GM) }, p2 = Rt(this.ng, this.xu.key(f2.time), ((t2, i2) => this.xu.key(t2.time) < i2));
    this.ng.splice(p2, 0, f2);
    for (let t2 = p2; t2 < this.ng.length; ++t2) fs(this.ng[t2].pointData, t2);
    return this.xu.fillWeightsForPoints(this.ng, p2), this.ag(t, p2, d2);
  }
  cg(t, i) {
    const n = this.tg.get(t);
    if (void 0 === n || i <= 0) return [[], this.dg()];
    i = Math.min(i, n.length);
    const s = n.splice(-i).reverse();
    0 === n.length ? this.ig.delete(t) : this.ig.set(t, n[n.length - 1].wt);
    for (const i2 of s) {
      const n2 = this.QM.get(this.xu.key(i2.wt));
      if (n2 && (n2.GM.delete(t), 0 === n2.GM.size)) {
        this.QM.delete(this.xu.key(n2.za)), this.ng.splice(n2.$n, 1);
        for (let t2 = n2.$n; t2 < this.ng.length; ++t2) fs(this.ng[t2].pointData, t2);
      }
    }
    return [s, this.ag(t, this.ng.length - 1, { lg: false, Ia: false })];
  }
  ug(t, i) {
    let n = this.tg.get(t);
    void 0 === n && (n = [], this.tg.set(t, n));
    const s = 0 !== n.length ? n[n.length - 1] : null;
    null === s || this.xu.key(i.wt) > this.xu.key(s.wt) ? hs(i) && n.push(i) : hs(i) ? n[n.length - 1] = i : n.splice(-1, 1), this.ig.set(t, i.wt);
  }
  _g(t, i, n) {
    const s = this.tg.get(t);
    if (void 0 === s) return;
    const e2 = Rt(s, n, ((t2, i2) => t2.$n < i2));
    hs(i) ? s[e2] = i : s.splice(e2, 1);
  }
  rg(t, i) {
    0 !== i.length ? (this.tg.set(t, i.filter(hs)), this.ig.set(t, i[i.length - 1].wt)) : (this.tg.delete(t), this.ig.delete(t));
  }
  eg() {
    for (const t of this.ng) 0 === t.pointData.GM.size && this.QM.delete(this.xu.key(t.time));
  }
  hg(t) {
    let i = -1;
    for (let n = 0; n < this.ng.length && n < t.length; ++n) {
      const s = this.ng[n], e2 = t[n];
      if (this.xu.key(s.time) !== this.xu.key(e2.time)) {
        i = n;
        break;
      }
      e2.timeWeight = s.timeWeight, fs(e2.pointData, n);
    }
    if (-1 === i && this.ng.length !== t.length && (i = Math.min(this.ng.length, t.length)), -1 === i) return -1;
    for (let n = i; n < t.length; ++n) fs(t[n].pointData, n);
    return this.xu.fillWeightsForPoints(t, i), this.ng = t, i;
  }
  fg() {
    if (0 === this.tg.size) return null;
    let t = 0;
    return this.tg.forEach(((i) => {
      0 !== i.length && (t = Math.max(t, i[i.length - 1].$n));
    })), t;
  }
  ag(t, i, n) {
    const s = this.dg();
    if (-1 !== i) this.tg.forEach(((i2, e2) => {
      s.U_.set(e2, { ue: i2, pg: e2 === t ? n : void 0 });
    })), this.tg.has(t) || s.U_.set(t, { ue: [], pg: n }), s.Et.vg = this.ng, s.Et.mg = i;
    else {
      const i2 = this.tg.get(t);
      s.U_.set(t, { ue: i2 || [], pg: n });
    }
    return s;
  }
  dg() {
    return { U_: /* @__PURE__ */ new Map(), Et: { Pc: this.fg() } };
  }
}
function fs(t, i) {
  t.$n = i, t.GM.forEach(((t2) => {
    t2.$n = i;
  }));
}
function ps(t, i) {
  return t._t < i;
}
function vs(t, i) {
  return i < t._t;
}
function ms(t, i, n, s) {
  return Rt(t, i, ps, n, s);
}
function ws(t, i, n, s) {
  return Dt(t, i, vs, n, s);
}
function Ms(t, i, n) {
  return { ne: t, se: i, ee: n };
}
function gs(t, i, n, s) {
  return t >= i - s && t <= n + s;
}
function bs(t, i, n, s, e2, r2) {
  const h2 = e2 - n, a2 = r2 - s;
  if (0 === h2 && 0 === a2) return Math.hypot(t - n, i - s);
  const l2 = ((t - n) * h2 + (i - s) * a2) / (h2 * h2 + a2 * a2), o2 = Math.max(0, Math.min(1, l2)), _2 = n + h2 * o2, u2 = s + a2 * o2;
  return Math.hypot(t - _2, i - u2);
}
const Ss = [0, 0];
function xs(t, i, n) {
  return void 0 === i || i.wt !== t.wt - 1 ? t._t - n / 2 : (i._t + t._t) / 2;
}
function Cs(t, i, n) {
  return void 0 === i || i.wt !== t.wt + 1 ? t._t + n / 2 : (t._t + i._t) / 2;
}
function ys(t, i, n, s, e2, r2, h2) {
  if (null === i || i.from >= i.to || 0 === t.length) return null;
  const a2 = e2 / 2 + r2, l2 = ms(t, n - a2, i.from, i.to), o2 = ws(t, n + a2, l2, i.to);
  if (l2 >= o2) return null;
  let _2 = Number.POSITIVE_INFINITY;
  for (let a3 = l2; a3 < o2; a3++) {
    const l3 = t[a3], o3 = a3 > i.from ? t[a3 - 1] : void 0, u2 = a3 < i.to - 1 ? t[a3 + 1] : void 0, c2 = xs(l3, o3, e2) - r2, d2 = Cs(l3, u2, e2) + r2;
    if (n < c2 || n > d2) continue;
    h2(l3, Ss);
    const f2 = Ss[0], p2 = Ss[1], v2 = Math.min(f2, p2), m2 = Math.max(f2, p2), w2 = v2 - r2, M2 = m2 + r2;
    if (s >= v2 && s <= m2) _2 = Math.min(_2, 0);
    else if (s >= w2 && s <= M2) {
      const t2 = Math.min(Math.abs(s - v2), Math.abs(m2 - s));
      _2 = Math.min(_2, t2);
    }
  }
  return Number.isFinite(_2) ? Ms(_2, 0, "series-range") : null;
}
function ks(t, i) {
  return t.wt < i;
}
function Ps(t, i) {
  return i < t.wt;
}
function Ts(t, i, n) {
  const s = i.Oa(), e2 = i.bi(), r2 = Rt(t, s, ks), h2 = Dt(t, e2, Ps);
  if (!n) return { from: r2, to: h2 };
  let a2 = r2, l2 = h2;
  return r2 > 0 && r2 < t.length && t[r2].wt >= s && (a2 = r2 - 1), h2 > 0 && h2 < t.length && t[h2 - 1].wt <= e2 && (l2 = h2 + 1), { from: a2, to: l2 };
}
class Rs {
  constructor(t, i, n) {
    this.wg = true, this.Mg = true, this.gg = true, this.bg = [], this.Sg = null, this.xg = -1, this.ae = t, this.le = i, this.Cg = n;
  }
  kt(t) {
    this.wg = true, "data" === t && (this.Mg = true), "options" === t && (this.gg = true);
  }
  Tt() {
    return this.ae.It() ? (this.yg(), null === this.Sg ? null : this.kg) : null;
  }
  Qs(t, i) {
    return this.ae.It() ? (this.yg(), null === this.Sg ? null : this.Pg(t, i)) : null;
  }
  Pg(t, i) {
    return null;
  }
  Tg() {
    this.bg = this.bg.map(((t) => ({ ...t, ...this.ae.Sa().Sh(t.wt) })));
  }
  Rg() {
    this.Sg = null;
  }
  yg() {
    const t = this.le.Et(), i = t.N().enableConflation ? t.Qc() : 0;
    i !== this.xg && (this.Mg = true, this.xg = i), this.Mg && (this.Dg(), this.Mg = false), this.gg && (this.Tg(), this.gg = false), this.wg && (this.Ig(), this.wg = false);
  }
  Ig() {
    const t = this.ae.Ft(), i = this.le.Et();
    if (this.Rg(), i.Gi() || t.Gi()) return;
    const n = i.Ee();
    if (null === n) return;
    if (0 === this.ae.Un().Th()) return;
    const s = this.ae.Lt();
    null !== s && (this.Sg = Ts(this.bg, n, this.Cg), this.Vg(t, i, s.Wt), this.Bg());
  }
}
class Ds {
  constructor(t, i) {
    this.Eg = t, this.Ki = i;
  }
  st(t, i, n) {
    this.Eg.draw(t, this.Ki, i, n);
  }
}
function Is(t) {
  switch (t) {
    case "point":
      return 2;
    case "range":
      return 0;
    default:
      return 1;
  }
}
class Vs extends Rs {
  constructor(t, i, n) {
    super(t, i, false), this.Yh = n, this.Eg = this.Yh.renderer(), this.kg = new Ds(this.Eg, ((t2) => this.Ag(t2)));
  }
  get ga() {
    return this.Yh.conflationReducer;
  }
  Wa(t) {
    return this.Yh.priceValueBuilder(t);
  }
  _l(t) {
    return this.Yh.isWhitespace(t);
  }
  Pg(t, i) {
    const n = this.Eg.hitTest?.(t, i, ((t2) => this.Ag(t2)));
    if (null != n) return { ne: (s = n).distance, se: Is(s.type), ee: "custom", mu: s.cursorStyle, te: s.objectId, ie: s.hitTestData };
    var s;
    const e2 = ys(this.bg, this.Sg, t, i, this.le.Et().fl(), this.ae.N().hitTestTolerance, ((t2, i2) => {
      const n2 = t2.Lg;
      let s2 = NaN, e3 = NaN;
      if (void 0 !== n2 && !this.Yh.isWhitespace(n2)) for (const t3 of this.Yh.priceValueBuilder(n2)) {
        const i3 = this.Ag(t3);
        null !== i3 && (s2 = Number.isNaN(s2) ? i3 : Math.min(s2, i3), e3 = Number.isNaN(e3) ? i3 : Math.max(e3, i3));
      }
      i2[0] = s2, i2[1] = e3;
    }));
    return null === e2 ? null : { ...e2, ee: "custom" };
  }
  Dg() {
    const t = this.ae.Sa();
    this.bg = this.ae.Ha().Bh().map(((i) => ({ wt: i.$n, _t: NaN, ...t.Sh(i.$n), Lg: i.ue })));
  }
  Vg(t, i) {
    i.Tc(this.bg, b(this.Sg));
  }
  Bg() {
    this.Yh.update({ bars: this.bg.map(Bs), barSpacing: this.le.Et().fl(), visibleRange: this.Sg, conflationFactor: this.le.Et().Qc() }, this.ae.N());
  }
  Ag(t) {
    const i = this.ae.Lt();
    return null === i ? null : this.ae.Ft().Nt(t, i.Wt);
  }
}
function Bs(t) {
  return { x: t._t, time: t.wt, originalData: t.Lg, barColor: t.sh };
}
const Es = { color: "#2196f3" }, As = (t, i, n) => {
  const s = c(n);
  return new Vs(t, i, s);
};
function Ls(t) {
  const i = { value: t.Wt[3], time: t.Qr };
  return void 0 !== t.ZM && (i.customValues = t.ZM), i;
}
function zs(t) {
  const i = Ls(t);
  return void 0 !== t.R && (i.color = t.R), i;
}
function Os(t) {
  const i = Ls(t);
  return void 0 !== t.vt && (i.lineColor = t.vt), void 0 !== t.ah && (i.topColor = t.ah), void 0 !== t.oh && (i.bottomColor = t.oh), i;
}
function Ns(t) {
  const i = Ls(t);
  return void 0 !== t._h && (i.topLineColor = t._h), void 0 !== t.uh && (i.bottomLineColor = t.uh), void 0 !== t.dh && (i.topFillColor1 = t.dh), void 0 !== t.fh && (i.topFillColor2 = t.fh), void 0 !== t.ph && (i.bottomFillColor1 = t.ph), void 0 !== t.mh && (i.bottomFillColor2 = t.mh), i;
}
function Fs(t) {
  const i = { open: t.Wt[0], high: t.Wt[1], low: t.Wt[2], close: t.Wt[3], time: t.Qr };
  return void 0 !== t.ZM && (i.customValues = t.ZM), i;
}
function Ws(t) {
  const i = Fs(t);
  return void 0 !== t.R && (i.color = t.R), i;
}
function Hs(t) {
  const i = Fs(t), { R: n, Ht: s, hh: e2 } = t;
  return void 0 !== n && (i.color = n), void 0 !== s && (i.borderColor = s), void 0 !== e2 && (i.wickColor = e2), i;
}
function Us(t) {
  return { Area: Os, Line: zs, Baseline: Ns, Histogram: zs, Bar: Ws, Candlestick: Hs, Custom: $s }[t];
}
function $s(t) {
  const i = t.Qr;
  return { ...t.ue, time: i };
}
const js = { vertLine: { color: "#9598A1", width: 1, style: 3, visible: true, labelVisible: true, labelBackgroundColor: "#131722" }, horzLine: { color: "#9598A1", width: 1, style: 3, visible: true, labelVisible: true, labelBackgroundColor: "#131722" }, mode: 1, doNotSnapToHiddenSeriesIndices: false }, qs = { vertLines: { color: "#D6DCDE", style: 0, visible: true }, horzLines: { color: "#D6DCDE", style: 0, visible: true } }, Ys = { background: { type: "solid", color: "#FFFFFF" }, textColor: "#191919", fontSize: 12, fontFamily: S, panes: { enableResize: true, separatorColor: "#E0E3EB", separatorHoverColor: "rgba(178, 181, 189, 0.2)" }, attributionLogo: true, colorSpace: "srgb", colorParsers: [] }, Ks = { autoScale: true, mode: 0, invertScale: false, alignLabels: true, borderVisible: true, borderColor: "#2B2B43", entireTextOnly: false, visible: false, ticksVisible: false, scaleMargins: { bottom: 0.1, top: 0.2 }, minimumWidth: 0, ensureEdgeTickMarksVisible: false, tickMarkDensity: 2.5 }, Zs = { rightOffset: 0, barSpacing: 6, minBarSpacing: 0.5, maxBarSpacing: 0, fixLeftEdge: false, fixRightEdge: false, lockVisibleTimeRangeOnResize: false, rightBarStaysOnScroll: false, borderVisible: true, borderColor: "#2B2B43", visible: true, timeVisible: false, secondsVisible: true, shiftVisibleRangeOnNewBar: true, allowShiftVisibleRangeOnWhitespaceReplacement: false, ticksVisible: false, uniformDistribution: false, minimumHeight: 0, allowBoldLabels: true, ignoreWhitespaceIndices: false, enableConflation: false, conflationThresholdFactor: 1, precomputeConflationOnInit: false, precomputeConflationPriority: "background" };
function Gs() {
  return { addDefaultPane: true, hoveredSeriesOnTop: true, width: 0, height: 0, autoSize: false, layout: Ys, crosshair: js, grid: qs, overlayPriceScales: { ...Ks }, leftPriceScale: { ...Ks, visible: false }, rightPriceScale: { ...Ks, visible: true }, defaultVisiblePriceScaleId: "right", timeScale: Zs, localization: { locale: dn ? navigator.language : "", dateFormat: "dd MMM 'yy" }, handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true }, handleScale: { axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: { time: true, price: true }, mouseWheel: true, pinch: true }, kineticScroll: { mouse: false, touch: true }, trackingMode: { exitMode: 1 } };
}
class Xs {
  constructor(t, i, n) {
    this.sv = t, this.zg = i, this.Og = n ?? 0;
  }
  applyOptions(t) {
    this.sv.Qt().Pd(this.zg, t, this.Og);
  }
  options() {
    return this.Ki().N();
  }
  width() {
    return G(this.zg) ? this.sv.CM(this.zg) : 0;
  }
  setVisibleRange(t) {
    this.setAutoScale(false), this.Ki().qo(new mt(t.from, t.to));
  }
  getVisibleRange() {
    let t, i, n = this.Ki().ar();
    if (null === n) return null;
    if (this.Ki().so()) {
      const s = this.Ki().M_(), e2 = Yi(s);
      n = vi(n, this.Ki().ro()), t = Number((Math.round(n.Je() / s) * s).toFixed(e2)), i = Number((Math.round(n.Qe() / s) * s).toFixed(e2));
    } else t = n.Je(), i = n.Qe();
    return { from: t, to: i };
  }
  setAutoScale(t) {
    this.applyOptions({ autoScale: t });
  }
  Ki() {
    return u(this.sv.Qt().Td(this.zg, this.Og)).Ft;
  }
}
class Js {
  constructor(t, i, n, s) {
    this.sv = t, this.yt = n, this.Ng = i, this.Fg = s;
  }
  getHeight() {
    return this.yt.$t();
  }
  setHeight(t) {
    const i = this.sv.Qt(), n = i.hf(this.yt);
    i.Bd(n, t);
  }
  getStretchFactor() {
    return this.yt.z_();
  }
  setStretchFactor(t) {
    this.yt.O_(t), this.sv.Qt().Pa();
  }
  paneIndex() {
    return this.sv.Qt().hf(this.yt);
  }
  moveTo(t) {
    const i = this.paneIndex();
    i !== t && (o(t >= 0 && t < this.sv.rv().length, "Invalid pane index"), this.sv.Qt().Ad(i, t));
  }
  getSeries() {
    return this.yt.U_().map(((t) => this.Ng(t))) ?? [];
  }
  getHTMLElement() {
    const t = this.sv.rv();
    return t && 0 !== t.length && t[this.paneIndex()] ? t[this.paneIndex()].uv() : null;
  }
  attachPrimitive(t) {
    this.yt.hl(t), t.attached && t.attached({ chart: this.Fg, requestUpdate: () => this.yt.Qt().Pa() });
  }
  detachPrimitive(t) {
    this.yt.al(t);
  }
  priceScale(t) {
    if (null === this.yt.A_(t)) throw new Error(`Cannot find price scale with id: ${t}`);
    return new Xs(this.sv, t, this.paneIndex());
  }
  setPreserveEmptyPane(t) {
    this.yt.W_(t);
  }
  preserveEmptyPane() {
    return this.yt.H_();
  }
  addCustomSeries(t, i = {}, n = 0) {
    return this.Fg.addCustomSeries(t, i, n);
  }
  addSeries(t, i = {}) {
    return this.Fg.addSeries(t, i, this.paneIndex());
  }
}
const Qs = { color: "#FF0000", price: 0, lineStyle: 2, lineWidth: 1, lineVisible: true, axisLabelVisible: true, title: "", axisLabelColor: "", axisLabelTextColor: "" };
class te {
  constructor(t) {
    this._r = t;
  }
  applyOptions(t) {
    this._r.vr(t);
  }
  options() {
    return this._r.N();
  }
  Wg() {
    return this._r;
  }
}
class ie {
  constructor(t, i, n, s, e2, r2) {
    this.Hg = new d(), this.ae = t, this.Ug = i, this.$g = n, this.xu = e2, this.Fg = s, this.jg = r2;
  }
  m() {
    this.Hg.m();
  }
  priceFormatter() {
    return this.ae.tl();
  }
  priceToCoordinate(t) {
    const i = this.ae.Lt();
    return null === i ? null : this.ae.Ft().Nt(t, i.Wt);
  }
  coordinateToPrice(t) {
    const i = this.ae.Lt();
    return null === i ? null : this.ae.Ft().Tn(t, i.Wt);
  }
  barsInLogicalRange(t) {
    if (null === t) return null;
    const i = new Oi(new Ai(t.from, t.to)).Fu(), n = this.ae.Un();
    if (n.Gi()) return null;
    const s = n.Hn(i.Oa(), 1), e2 = n.Hn(i.bi(), -1), r2 = u(n.Rh()), h2 = u(n.Qn());
    if (null !== s && null !== e2 && s.$n > e2.$n) return { barsBefore: t.from - r2, barsAfter: h2 - t.to };
    const a2 = { barsBefore: null === s || s.$n === r2 ? t.from - r2 : s.$n - r2, barsAfter: null === e2 || e2.$n === h2 ? h2 - t.to : h2 - e2.$n };
    return null !== s && null !== e2 && (a2.from = s.Qr, a2.to = e2.Qr), a2;
  }
  setData(t) {
    this.xu, this.ae.bh(), this.Ug.qg(this.ae, t), this.Yg("full");
  }
  update(t, i = false) {
    this.ae.bh(), this.Ug.Kg(this.ae, t, i), this.Yg("update");
  }
  pop(t = 1) {
    const i = this.Ug.Zg(this.ae, t);
    0 !== i.length && this.Yg("update");
    const n = Us(this.seriesType());
    return i.map(((t2) => n(t2)));
  }
  dataByIndex(t, i) {
    const n = this.ae.Un().Hn(t, i);
    if (null === n) return null;
    return Us(this.seriesType())(n);
  }
  data() {
    const t = Us(this.seriesType());
    return this.ae.Un().Bh().map(((i) => t(i)));
  }
  subscribeDataChanged(t) {
    this.Hg.i(t);
  }
  unsubscribeDataChanged(t) {
    this.Hg._(t);
  }
  applyOptions(t) {
    this.ae.vr(t);
  }
  options() {
    return M(this.ae.N());
  }
  priceScale() {
    return this.$g.priceScale(this.ae.Ft().cl(), this.getPane().paneIndex());
  }
  createPriceLine(t) {
    const i = f(M(Qs), t), n = this.ae.Ba(i);
    return new te(n);
  }
  removePriceLine(t) {
    this.ae.Ea(t.Wg());
  }
  priceLines() {
    return this.ae.Aa().map(((t) => new te(t)));
  }
  seriesType() {
    return this.ae.bh();
  }
  lastValueData(t) {
    const i = this.ae.Ae(t);
    return i.Le ? { noData: true } : { noData: false, price: i.Mt, color: i.R };
  }
  attachPrimitive(t) {
    this.ae.hl(t), t.attached && t.attached({ chart: this.Fg, series: this, requestUpdate: () => this.ae.Qt().Pa(), horzScaleBehavior: this.xu });
  }
  detachPrimitive(t) {
    this.ae.al(t), t.detached && t.detached(), this.ae.Qt().Pa();
  }
  getPane() {
    const t = this.ae, i = u(this.ae.Qt().Ks(t));
    return this.jg(i);
  }
  moveToPane(t) {
    this.ae.Qt().nf(this.ae, t);
  }
  seriesOrder() {
    const t = this.ae.Qt().Ks(this.ae);
    return null === t ? -1 : t.U_().indexOf(this.ae);
  }
  setSeriesOrder(t) {
    const i = this.ae.Qt().Ks(this.ae);
    null !== i && i.du(this.ae, t);
  }
  Yg(t) {
    this.Hg.v() && this.Hg.p(t);
  }
}
class ne {
  constructor(t, i, n) {
    this.Gg = new d(), this.Gu = new d(), this.Bw = new d(), this.sn = t, this.ia = t.Et(), this._M = i, this.ia.Yc().i(this.Xg.bind(this)), this.ia.Kc().i(this.Jg.bind(this)), this._M.Fw().i(this.Qg.bind(this)), this.xu = n;
  }
  m() {
    this.ia.Yc().u(this), this.ia.Kc().u(this), this._M.Fw().u(this), this.Gg.m(), this.Gu.m(), this.Bw.m();
  }
  scrollPosition() {
    return this.ia.Ac();
  }
  scrollToPosition(t, i) {
    i ? this.ia.$c(t, 1e3) : this.sn.gs(t);
  }
  scrollToRealTime() {
    this.ia.Uc();
  }
  getVisibleRange() {
    const t = this.ia.gc();
    return null === t ? null : { from: t.from.originalTime, to: t.to.originalTime };
  }
  setVisibleRange(t) {
    const i = { from: this.xu.convertHorzItemToInternal(t.from), to: this.xu.convertHorzItemToInternal(t.to) }, n = this.ia.Cc(i);
    this.sn.tf(n);
  }
  getVisibleLogicalRange() {
    const t = this.ia.Mc();
    return null === t ? null : { from: t.Oa(), to: t.bi() };
  }
  setVisibleLogicalRange(t) {
    o(t.from <= t.to, "The from index cannot be after the to index."), this.sn.tf(t);
  }
  resetTimeScale() {
    this.sn.ws();
  }
  fitContent() {
    this.sn.Xc();
  }
  logicalToCoordinate(t) {
    const i = this.sn.Et();
    return i.Gi() ? null : i.jt(t);
  }
  coordinateToLogical(t) {
    return this.ia.Gi() ? null : this.ia.Rc(t);
  }
  timeToIndex(t, i) {
    const n = this.xu.convertHorzItemToInternal(t);
    return this.ia.vc(n, i);
  }
  timeToCoordinate(t) {
    const i = this.timeToIndex(t, false);
    return null === i ? null : this.ia.jt(i);
  }
  coordinateToTime(t) {
    const i = this.sn.Et(), n = i.Rc(t), s = i.en(n);
    return null === s ? null : s.originalTime;
  }
  width() {
    return this._M.cv().width;
  }
  height() {
    return this._M.cv().height;
  }
  subscribeVisibleTimeRangeChange(t) {
    this.Gg.i(t);
  }
  unsubscribeVisibleTimeRangeChange(t) {
    this.Gg._(t);
  }
  subscribeVisibleLogicalRangeChange(t) {
    this.Gu.i(t);
  }
  unsubscribeVisibleLogicalRangeChange(t) {
    this.Gu._(t);
  }
  subscribeSizeChange(t) {
    this.Bw.i(t);
  }
  unsubscribeSizeChange(t) {
    this.Bw._(t);
  }
  applyOptions(t) {
    this.ia.vr(t);
  }
  options() {
    return { ...M(this.ia.N()), barSpacing: this.ia.fl() };
  }
  Xg() {
    this.Gg.v() && this.Gg.p(this.getVisibleRange());
  }
  Jg() {
    this.Gu.v() && this.Gu.p(this.getVisibleLogicalRange());
  }
  Qg(t) {
    this.Bw.p(t.width, t.height);
  }
}
function se(t) {
  return (function(t2) {
    if (w(t2.handleScale)) {
      const i2 = t2.handleScale;
      t2.handleScale = { axisDoubleClickReset: { time: i2, price: i2 }, axisPressedMouseMove: { time: i2, price: i2 }, mouseWheel: i2, pinch: i2 };
    } else if (void 0 !== t2.handleScale) {
      const { axisPressedMouseMove: i2, axisDoubleClickReset: n } = t2.handleScale;
      w(i2) && (t2.handleScale.axisPressedMouseMove = { time: i2, price: i2 }), w(n) && (t2.handleScale.axisDoubleClickReset = { time: n, price: n });
    }
    const i = t2.handleScroll;
    w(i) && (t2.handleScroll = { horzTouchDrag: i, vertTouchDrag: i, mouseWheel: i, pressedMouseMove: i });
  })(t), t;
}
class ee {
  constructor(t, i, n) {
    this.tb = /* @__PURE__ */ new Map(), this.ib = /* @__PURE__ */ new Map(), this.nb = new d(), this.sb = new d(), this.eb = new d(), this.od = /* @__PURE__ */ new WeakMap(), this.rb = new ds(i);
    const s = void 0 === n ? M(Gs()) : f(M(Gs()), se(n));
    this.hb = i, this.sv = new Gn(t, s, i), this.sv.dw().i(((t2) => {
      this.nb.v() && this.nb.p(this.ab(t2()));
    }), this), this.sv.fw().i(((t2) => {
      this.sb.v() && this.sb.p(this.ab(t2()));
    }), this), this.sv.Dd().i(((t2) => {
      this.eb.v() && this.eb.p(this.ab(t2()));
    }), this);
    const e2 = this.sv.Qt();
    this.lb = new ne(e2, this.sv.pM(), this.hb);
  }
  remove() {
    this.sv.dw().u(this), this.sv.fw().u(this), this.sv.Dd().u(this), this.lb.m(), this.sv.m(), this.tb.clear(), this.ib.clear(), this.nb.m(), this.sb.m(), this.eb.m(), this.rb.m();
  }
  resize(t, i, n) {
    this.autoSizeActive() || this.sv.cM(t, i, n);
  }
  addCustomSeries(t, i = {}, n = 0) {
    const s = ((t2) => ({ type: "Custom", isBuiltIn: false, defaultOptions: { ...Es, ...t2.defaultOptions() }, ob: As, _b: t2 }))(c(t));
    return this.ub(s, i, n);
  }
  addSeries(t, i = {}, n = 0) {
    return this.ub(t, i, n);
  }
  removeSeries(t) {
    const i = _(this.tb.get(t)), n = this.rb.Jd(i);
    this.sv.Qt().Jd(i), this.cb(n), this.tb.delete(t), this.ib.delete(i);
  }
  qg(t, i) {
    this.cb(this.rb.sg(t, i));
  }
  Kg(t, i, n) {
    this.cb(this.rb.og(t, i, n));
  }
  Zg(t, i) {
    const [n, s] = this.rb.cg(t, i);
    return 0 !== n.length && this.cb(s), n;
  }
  subscribeClick(t) {
    this.nb.i(t);
  }
  unsubscribeClick(t) {
    this.nb._(t);
  }
  subscribeCrosshairMove(t) {
    this.eb.i(t);
  }
  unsubscribeCrosshairMove(t) {
    this.eb._(t);
  }
  subscribeDblClick(t) {
    this.sb.i(t);
  }
  unsubscribeDblClick(t) {
    this.sb._(t);
  }
  priceScale(t, i = 0) {
    return new Xs(this.sv, t, i);
  }
  timeScale() {
    return this.lb;
  }
  applyOptions(t) {
    this.sv.vr(se(t));
  }
  options() {
    return this.sv.N();
  }
  takeScreenshot(t = false, i = false) {
    let n, s;
    try {
      i || (n = this.sv.Qt().N().crosshair.mode, this.sv.vr({ crosshair: { mode: 2 } })), s = this.sv.SM(t);
    } finally {
      i || void 0 === n || this.sv.Qt().vr({ crosshair: { mode: n } });
    }
    return s;
  }
  addPane(t = false) {
    const i = this.sv.Qt().af();
    return i.W_(t), this.fb(i);
  }
  removePane(t) {
    this.sv.Qt().Vd(t);
  }
  swapPanes(t, i) {
    this.sv.Qt().Ed(t, i);
  }
  autoSizeActive() {
    return this.sv.wM();
  }
  chartElement() {
    return this.sv.vv();
  }
  panes() {
    return this.sv.Qt().Zn().map(((t) => this.fb(t)));
  }
  paneSize(t = 0) {
    const i = this.sv.RM(t);
    return { height: i.height, width: i.width };
  }
  setCrosshairPosition(t, i, n) {
    const s = this.tb.get(n);
    if (void 0 === s) return;
    const e2 = this.sv.Qt().Ks(s);
    null !== e2 && this.sv.Qt().qd(t, i, e2);
  }
  clearCrosshairPosition() {
    this.sv.Qt().Yd(true);
  }
  horzBehaviour() {
    return this.hb;
  }
  ub(t, i = {}, n = 0) {
    o(void 0 !== t.ob), (function(t2) {
      if (void 0 === t2 || "custom" === t2.type) return;
      const i2 = t2;
      void 0 !== i2.minMove && void 0 === i2.precision && (i2.precision = Yi(i2.minMove));
    })(i.priceFormat), "Candlestick" === t.type && (function(t2) {
      void 0 !== t2.borderColor && (t2.borderUpColor = t2.borderColor, t2.borderDownColor = t2.borderColor), void 0 !== t2.wickColor && (t2.wickUpColor = t2.wickColor, t2.wickDownColor = t2.wickColor);
    })(i);
    const s = f(M(e), M(t.defaultOptions), i), r2 = t.ob, h2 = new Jt(this.sv.Qt(), t.type, s, r2, t._b);
    this.sv.Qt().Gd(h2, n);
    const a2 = new ie(h2, this, this, this, this.hb, ((t2) => this.fb(t2)));
    return this.tb.set(a2, h2), this.ib.set(h2, a2), a2;
  }
  cb(t) {
    const i = this.sv.Qt();
    i.Kd(t.Et.Pc, t.Et.vg, t.Et.mg), t.U_.forEach(((t2, i2) => i2.ht(t2.ue, t2.pg))), i.Et()._c(), i.Bc();
  }
  pb(t) {
    return _(this.ib.get(t));
  }
  mb(t) {
    return void 0 !== t && this.ib.has(t) ? this.pb(t) : void 0;
  }
  ab(t) {
    const i = /* @__PURE__ */ new Map();
    t.YM.forEach(((t2, n2) => {
      const s2 = n2.bh(), e2 = Us(s2)(t2);
      if ("Custom" !== s2) o(Qn(e2));
      else {
        const t3 = n2.ol();
        o(!t3 || false === t3(e2));
      }
      i.set(this.pb(n2), e2);
    }));
    const n = this.mb(t.NM), s = void 0 === t.WM ? void 0 : { type: t.WM.ds, sourceKind: t.WM.HM, objectKind: t.WM.UM, series: this.mb(t.WM.U_), objectId: t.WM.$M, paneIndex: t.WM.jM };
    return { time: t.Qr, logical: t.$n, point: t.qM, paneIndex: t.jM, hoveredInfo: s, hoveredSeries: n, hoveredObjectId: t.FM, seriesData: i, sourceEvent: t.KM };
  }
  fb(t) {
    let i = this.od.get(t);
    return i || (i = new Js(this.sv, ((t2) => this.pb(t2)), t, this), this.od.set(t, i)), i;
  }
}
function re(t) {
  if (m(t)) {
    const i = document.getElementById(t);
    return o(null !== i, `Cannot find element in DOM with id=${t}`), i;
  }
  return t;
}
function he(t, i, n) {
  const s = re(t), e2 = new ee(s, i, n);
  return i.setOptions(e2.options()), e2;
}
function ae(t, i) {
  return he(t, new cn(), cn.yf(i));
}
function oe(t, i, n, s) {
  return Math.hypot(n - t, s - i);
}
function _e(t, i, n, s, e2, r2, h2, a2 = 0) {
  if (0 === i.length || s.from >= i.length || s.to <= 0) return;
  const { context: l2, horizontalPixelRatio: o2, verticalPixelRatio: _2 } = t, u2 = i[s.from];
  let c2 = r2(t, u2), d2 = u2;
  if (s.to - s.from < 2) {
    const i2 = e2 / 2;
    l2.beginPath();
    const n2 = { _t: u2._t - i2, ut: u2.ut }, s2 = { _t: u2._t + i2, ut: u2.ut };
    l2.moveTo(n2._t * o2, n2.ut * _2), l2.lineTo(s2._t * o2, s2.ut * _2), h2(t, c2, n2, s2);
  } else {
    const e3 = a2 > 0;
    let f2 = 0;
    const p2 = (i2, n2) => {
      if (h2(t, c2, d2, n2), l2.beginPath(), c2 = i2, d2 = n2, e3) {
        const t2 = f2 % a2;
        l2.lineDashOffset = t2, f2 = t2;
      }
    };
    let v2 = d2;
    l2.beginPath(), l2.moveTo(u2._t * o2, u2.ut * _2);
    for (let h3 = s.from + 1; h3 < s.to; ++h3) {
      v2 = i[h3];
      const s2 = v2._t * o2, a3 = v2.ut * _2, u3 = r2(t, v2);
      switch (n) {
        case 0:
          if (l2.lineTo(s2, a3), e3) {
            const t2 = i[h3 - 1], n2 = t2._t * o2, e4 = t2.ut * _2;
            f2 += oe(n2, e4, s2, a3);
          }
          break;
        case 1: {
          const t2 = i[h3 - 1], n2 = t2.ut * _2;
          l2.lineTo(s2, n2), e3 && (f2 += Math.abs(v2._t - t2._t) * o2), u3 !== c2 && (p2(u3, v2), l2.lineTo(s2, n2)), l2.lineTo(s2, a3), e3 && (f2 += Math.abs(v2.ut - t2.ut) * _2);
          break;
        }
        case 2: {
          const [t2, n2] = fe(i, h3 - 1, h3), r3 = t2._t * o2, u4 = t2.ut * _2, c3 = n2._t * o2, d3 = n2.ut * _2;
          if (l2.bezierCurveTo(r3, u4, c3, d3, s2, a3), e3) {
            const t3 = i[h3 - 1], n3 = t3._t * o2, e4 = t3.ut * _2, l3 = oe(n3, e4, s2, a3), p3 = oe(n3, e4, r3, u4) + oe(r3, u4, c3, d3) + oe(c3, d3, s2, a3);
            f2 += (l3 + p3) / 2;
          }
          break;
        }
      }
      1 !== n && u3 !== c2 && (p2(u3, v2), l2.moveTo(s2, a3));
    }
    (d2 !== v2 || d2 === v2 && 1 === n) && h2(t, c2, d2, v2), e3 && (l2.lineDashOffset = 0);
  }
}
const ue = 6;
function ce(t, i) {
  return { _t: t._t - i._t, ut: t.ut - i.ut };
}
function de(t, i) {
  return { _t: t._t / i, ut: t.ut / i };
}
function fe(t, i, n) {
  const s = Math.max(0, i - 1), e2 = Math.min(t.length - 1, n + 1);
  var r2, h2;
  return [(r2 = t[i], h2 = de(ce(t[n], t[s]), ue), { _t: r2._t + h2._t, ut: r2.ut + h2.ut }), ce(t[n], de(ce(t[e2], t[i]), ue))];
}
function pe(t, i) {
  const n = t.context;
  n.strokeStyle = i, n.stroke();
}
class ve extends R {
  constructor() {
    super(...arguments), this.rt = null;
  }
  ht(t) {
    this.rt = t;
  }
  et(t) {
    if (null === this.rt) return;
    const { ot: i, lt: n, wb: s, Mb: e2, ct: r2, Zt: h2, gb: l2 } = this.rt;
    if (null === n) return;
    const o2 = t.context;
    o2.lineCap = "butt", o2.lineWidth = r2 * t.verticalPixelRatio;
    const _2 = a(o2, h2);
    o2.lineJoin = "round";
    const u2 = this.bb.bind(this), c2 = (function(t2) {
      return t2.reduce(((t3, i2) => t3 + i2), 0);
    })(_2);
    void 0 !== e2 && _e(t, i, e2, n, s, u2, pe, c2), l2 && (function(t2, i2, n2, s2, e3) {
      if (s2.to - s2.from <= 0) return;
      const { horizontalPixelRatio: r3, verticalPixelRatio: h3, context: a2 } = t2;
      let l3 = null;
      const o3 = Math.max(1, Math.floor(r3)) % 2 / 2, _3 = n2 * h3 + o3;
      for (let n3 = s2.to - 1; n3 >= s2.from; --n3) {
        const s3 = i2[n3];
        if (s3) {
          const i3 = e3(t2, s3);
          i3 !== l3 && (null !== l3 && a2.fill(), a2.beginPath(), a2.fillStyle = i3, l3 = i3);
          const n4 = Math.round(s3._t * r3) + o3, u3 = s3.ut * h3;
          a2.moveTo(n4, u3), a2.arc(n4, u3, _3, 0, 2 * Math.PI);
        }
      }
      a2.fill();
    })(t, i, l2, n, u2);
  }
}
class me extends ve {
  bb(t, i) {
    return i.vt;
  }
}
function we(t, i, n, s, e2) {
  const r2 = 1 - e2;
  return r2 * r2 * r2 * t + 3 * r2 * r2 * e2 * i + 3 * r2 * e2 * e2 * n + e2 * e2 * e2 * s;
}
function Me(t, i, n, s, e2) {
  if (2 === n) {
    const [n2, r2] = fe(s, e2 - 1, e2);
    return [Math.min(t._t, i._t, n2._t, r2._t), Math.max(t._t, i._t, n2._t, r2._t)];
  }
  return [Math.min(t._t, i._t), Math.max(t._t, i._t)];
}
function ge(t, i, n, s, e2, r2, h2, a2) {
  switch (e2) {
    case 1: {
      const e3 = bs(t, i, n._t, n.ut, s._t, n.ut), r3 = bs(t, i, s._t, n.ut, s._t, s.ut), h3 = Math.min(e3, r3);
      return h3 <= a2 ? h3 : null;
    }
    case 2: {
      const [e3, l2] = fe(r2, h2 - 1, h2), o2 = (function(t2, i2, n2) {
        let s2 = Number.POSITIVE_INFINITY, e4 = n2[0];
        for (let r3 = 1; r3 <= 12; r3++) {
          const h3 = r3 / 12, a3 = { _t: we(n2[0]._t, n2[1]._t, n2[2]._t, n2[3]._t, h3), ut: we(n2[0].ut, n2[1].ut, n2[2].ut, n2[3].ut, h3) };
          s2 = Math.min(s2, bs(t2, i2, e4._t, e4.ut, a3._t, a3.ut)), e4 = a3;
        }
        return s2;
      })(t, i, [n, e3, l2, s]);
      return o2 <= a2 ? o2 : null;
    }
    default: {
      const e3 = bs(t, i, n._t, n.ut, s._t, s.ut);
      return e3 <= a2 ? e3 : null;
    }
  }
}
class be extends Rs {
  constructor(t, i) {
    super(t, i, true);
  }
  Vg(t, i, n) {
    i.Tc(this.bg, b(this.Sg)), t.Zo(this.bg, n, b(this.Sg));
  }
  Sb(t, i) {
    return { wt: t, Mt: i, _t: NaN, ut: NaN };
  }
  Dg() {
    const t = this.ae.Sa();
    this.bg = this.ae.Ha().Bh().map(((i) => {
      let n;
      if ((i.Zr ?? 1) > 1) {
        const t2 = i.Wt[1], s = i.Wt[2], e2 = i.Wt[3];
        n = Math.abs(t2 - e2) > Math.abs(s - e2) ? t2 : s;
      } else n = i.Wt[3];
      return this.xb(i.$n, n, t);
    }));
  }
}
class Se extends be {
  Pg(t, i) {
    const n = this.ae.N();
    return (function(t2, i2, n2, s, e2, r2, h2, a2 = 0, l2 = 0) {
      if (null === i2 || i2.from >= i2.to || 0 === t2.length) return null;
      const o2 = Math.max(r2 / 2, h2 ?? 0) + l2;
      let _2 = Number.POSITIVE_INFINITY;
      if (void 0 !== h2) {
        const e3 = h2 + l2, r3 = ms(t2, n2 - e3, i2.from, i2.to), a3 = ws(t2, n2 + e3, r3, i2.to);
        for (let i3 = r3; i3 < a3; i3++) {
          const e4 = t2[i3];
          if (!gs(n2, e4._t, e4._t, h2 + l2)) continue;
          const r4 = Math.hypot(n2 - e4._t, s - e4.ut);
          r4 <= h2 + l2 && (_2 = Math.min(_2, r4));
        }
      }
      if (i2.to - i2.from < 2) {
        const e3 = t2[i2.from], r3 = Math.max(a2 / 2, o2), h3 = bs(n2, s, e3._t - r3, e3.ut, e3._t + r3, e3.ut);
        return h3 <= o2 && (_2 = Math.min(_2, h3)), Number.isFinite(_2) ? Ms(_2, 2, "series-point") : null;
      }
      let u2 = Number.POSITIVE_INFINITY;
      const c2 = ms(t2, n2 - o2, i2.from, i2.to), d2 = ws(t2, n2 + o2, c2, i2.to), f2 = Math.max(i2.from + 1, c2), p2 = Math.min(i2.to, d2 + 1);
      for (let i3 = f2; i3 < p2; i3++) {
        const r3 = t2[i3 - 1], h3 = t2[i3], [a3, l3] = Me(r3, h3, e2, t2, i3);
        if (!gs(n2, a3, l3, o2)) continue;
        const _3 = ge(n2, s, r3, h3, e2, t2, i3, o2);
        null !== _3 && (u2 = Math.min(u2, _3));
      }
      return Number.isFinite(_2) ? Ms(_2, 2, "series-point") : Number.isFinite(u2) ? Ms(u2, 1, "series-line") : null;
    })(this.bg, this.Sg, t, i, n.lineType, n.lineVisible ? n.lineWidth : 1, n.pointMarkersVisible ? n.pointMarkersRadius || n.lineWidth / 2 + 2 : void 0, this.le.Et().fl(), n.hitTestTolerance);
  }
}
class xe extends Se {
  constructor() {
    super(...arguments), this.kg = new me();
  }
  xb(t, i, n) {
    return { ...this.Sb(t, i), ...n.Sh(t) };
  }
  Bg() {
    const t = this.ae.N(), i = { ot: this.bg, Zt: t.lineStyle, Mb: t.lineVisible ? t.lineType : void 0, ct: t.lineWidth, gb: t.pointMarkersVisible ? t.pointMarkersRadius || t.lineWidth / 2 + 2 : void 0, lt: this.Sg, wb: this.le.Et().fl() };
    this.kg.ht(i);
  }
}
const Ce = { type: "Line", isBuiltIn: true, defaultOptions: { color: "#2196f3", lineStyle: 0, lineWidth: 3, lineType: 0, lineVisible: true, crosshairMarkerVisible: true, crosshairMarkerRadius: 4, crosshairMarkerBorderColor: "", crosshairMarkerBorderWidth: 2, crosshairMarkerBackgroundColor: "", lastPriceAnimation: 0, pointMarkersVisible: false }, ob: (t, i) => new xe(t, i) };
function Ee(t, i, n, s, e2) {
  const { context: r2, horizontalPixelRatio: h2, verticalPixelRatio: a2 } = i;
  r2.lineTo(e2._t * h2, t * a2), r2.lineTo(s._t * h2, t * a2), r2.closePath(), r2.fillStyle = n, r2.fill();
}
class Ae extends R {
  constructor() {
    super(...arguments), this.rt = null;
  }
  ht(t) {
    this.rt = t;
  }
  et(t) {
    if (null === this.rt) return;
    const { ot: i, lt: n, wb: s, ct: e2, Zt: r2, Mb: h2 } = this.rt, l2 = this.rt.Db ?? (this.rt.Ib ? 0 : t.mediaSize.height);
    if (null === n) return;
    const o2 = t.context;
    o2.lineCap = "butt", o2.lineJoin = "round", o2.lineWidth = e2, a(o2, r2), o2.lineWidth = 1, _e(t, i, h2, n, s, this.Vb.bind(this), Ee.bind(null, l2));
  }
}
class Le {
  Bb(t, i) {
    const n = this.Eb, { Ab: s, Lb: e2, zb: r2, Ob: h2, Db: a2, Nb: l2, Fb: o2 } = i;
    if (void 0 === this.Wb || void 0 === n || n.Ab !== s || n.Lb !== e2 || n.zb !== r2 || n.Ob !== h2 || n.Db !== a2 || n.Nb !== l2 || n.Fb !== o2) {
      const { verticalPixelRatio: n2 } = t, _2 = a2 || l2 > 0 ? n2 : 1, u2 = l2 * _2, c2 = o2 === t.bitmapSize.height ? o2 : o2 * _2, d2 = (a2 ?? 0) * _2, f2 = t.context.createLinearGradient(0, u2, 0, c2);
      if (f2.addColorStop(0, s), null != a2) {
        const t2 = ni((d2 - u2) / (c2 - u2), 0, 1);
        f2.addColorStop(t2, e2), f2.addColorStop(t2, r2);
      }
      f2.addColorStop(1, h2), this.Wb = f2, this.Eb = i;
    }
    return this.Wb;
  }
}
class We extends Ae {
  constructor() {
    super(...arguments), this.Hb = new Le();
  }
  Vb(t, i) {
    return this.Hb.Bb(t, { Ab: i.ah, Lb: "", zb: "", Ob: i.oh, Nb: this.rt?.Nb ?? 0, Fb: t.bitmapSize.height });
  }
}
class He extends Se {
  constructor(t, i) {
    super(t, i), this.kg = new T(), this.qb = new We(), this.Yb = new me(), this.kg.nt([this.qb, this.Yb]);
  }
  xb(t, i, n) {
    return { ...this.Sb(t, i), ...n.Sh(t) };
  }
  Bg() {
    const t = this.ae.N();
    if (null === this.Sg || 0 === this.bg.length) return;
    let i;
    if (t.relativeGradient) {
      i = this.bg[this.Sg.from].ut;
      for (let t2 = this.Sg.from; t2 < this.Sg.to; t2++) {
        const n = this.bg[t2];
        n.ut < i && (i = n.ut);
      }
    }
    this.qb.ht({ Mb: t.lineType, ot: this.bg, Zt: t.lineStyle, ct: t.lineWidth, Db: null, Nb: i, Ib: t.invertFilledArea, lt: this.Sg, wb: this.le.Et().fl() }), this.Yb.ht({ Mb: t.lineVisible ? t.lineType : void 0, ot: this.bg, Zt: t.lineStyle, ct: t.lineWidth, lt: this.Sg, wb: this.le.Et().fl(), gb: t.pointMarkersVisible ? t.pointMarkersRadius || t.lineWidth / 2 + 2 : void 0 });
  }
}
const Ue = { type: "Area", isBuiltIn: true, defaultOptions: { topColor: "rgba( 46, 220, 135, 0.4)", bottomColor: "rgba( 40, 221, 100, 0)", invertFilledArea: false, relativeGradient: false, lineColor: "#33D778", lineStyle: 0, lineWidth: 3, lineType: 0, lineVisible: true, crosshairMarkerVisible: true, crosshairMarkerRadius: 4, crosshairMarkerBorderColor: "", crosshairMarkerBorderWidth: 2, crosshairMarkerBackgroundColor: "", lastPriceAnimation: 0, pointMarkersVisible: false }, ob: (t, i) => new He(t, i) };
class je extends Rs {
  constructor(t, i) {
    super(t, i, false);
  }
  Pg(t, i) {
    return ys(this.bg, this.Sg, t, i, this.le.Et().fl(), this.ae.N().hitTestTolerance, ((t2, i2) => {
      i2[0] = t2.Qo, i2[1] = t2.t_;
    }));
  }
  Vg(t, i, n) {
    i.Tc(this.bg, b(this.Sg)), t.Xo(this.bg, n, b(this.Sg));
  }
  Qb(t, i, n) {
    return { wt: t, jr: i.Wt[0], qr: i.Wt[1], Yr: i.Wt[2], Kr: i.Wt[3], _t: NaN, Jo: NaN, Qo: NaN, t_: NaN, i_: NaN };
  }
  Dg() {
    const t = this.ae.Sa();
    this.bg = this.ae.Ha().Bh().map(((i) => this.xb(i.$n, i, t)));
  }
}
class Ke extends R {
  constructor() {
    super(...arguments), this.qt = null, this.Kb = 0;
  }
  ht(t) {
    this.qt = t;
  }
  et(t) {
    if (null === this.qt || 0 === this.qt.Un.length || null === this.qt.lt) return;
    const { horizontalPixelRatio: i } = t;
    if (this.Kb = (function(t2, i2) {
      if (t2 >= 2.5 && t2 <= 4) return Math.floor(3 * i2);
      const n2 = 1 - 0.2 * Math.atan(Math.max(4, t2) - 4) / (0.5 * Math.PI), s2 = Math.floor(t2 * n2 * i2), e2 = Math.floor(t2 * i2), r2 = Math.min(s2, e2);
      return Math.max(Math.floor(i2), r2);
    })(this.qt.fl, i), this.Kb >= 2) {
      Math.floor(i) % 2 != this.Kb % 2 && this.Kb--;
    }
    const n = this.qt.Un;
    this.qt.tS && this.iS(t, n, this.qt.lt), this.qt.gi && this.Rm(t, n, this.qt.lt);
    const s = this.nS(i);
    (!this.qt.gi || this.Kb > 2 * s) && this.sS(t, n, this.qt.lt);
  }
  iS(t, i, n) {
    if (null === this.qt) return;
    const { context: s, horizontalPixelRatio: e2, verticalPixelRatio: r2 } = t;
    let h2 = "", a2 = Math.min(Math.floor(e2), Math.floor(this.qt.fl * e2));
    a2 = Math.max(Math.floor(e2), Math.min(a2, this.Kb));
    const l2 = Math.floor(0.5 * a2);
    let o2 = null;
    for (let t2 = n.from; t2 < n.to; t2++) {
      const n2 = i[t2];
      n2.rh !== h2 && (s.fillStyle = n2.rh, h2 = n2.rh);
      const _2 = Math.round(Math.min(n2.Jo, n2.i_) * r2), u2 = Math.round(Math.max(n2.Jo, n2.i_) * r2), c2 = Math.round(n2.Qo * r2), d2 = Math.round(n2.t_ * r2);
      let f2 = Math.round(e2 * n2._t) - l2;
      const p2 = f2 + a2 - 1;
      null !== o2 && (f2 = Math.max(o2 + 1, f2), f2 = Math.min(f2, p2));
      const v2 = p2 - f2 + 1;
      s.fillRect(f2, c2, v2, _2 - c2), s.fillRect(f2, u2 + 1, v2, d2 - u2), o2 = p2;
    }
  }
  nS(t) {
    let i = Math.floor(1 * t);
    this.Kb <= 2 * i && (i = Math.floor(0.5 * (this.Kb - 1)));
    const n = Math.max(Math.floor(t), i);
    return this.Kb <= 2 * n ? Math.max(Math.floor(t), Math.floor(1 * t)) : n;
  }
  Rm(t, i, n) {
    if (null === this.qt) return;
    const { context: s, horizontalPixelRatio: e2, verticalPixelRatio: r2 } = t;
    let h2 = "";
    const a2 = this.nS(e2);
    let l2 = null;
    for (let t2 = n.from; t2 < n.to; t2++) {
      const n2 = i[t2];
      n2.eh !== h2 && (s.fillStyle = n2.eh, h2 = n2.eh);
      let o2 = Math.round(n2._t * e2) - Math.floor(0.5 * this.Kb);
      const _2 = o2 + this.Kb - 1, u2 = Math.round(Math.min(n2.Jo, n2.i_) * r2), c2 = Math.round(Math.max(n2.Jo, n2.i_) * r2);
      if (null !== l2 && (o2 = Math.max(l2 + 1, o2), o2 = Math.min(o2, _2)), this.qt.fl * e2 > 2 * a2) L(s, o2, u2, _2 - o2 + 1, c2 - u2 + 1, a2);
      else {
        const t3 = _2 - o2 + 1;
        s.fillRect(o2, u2, t3, c2 - u2 + 1);
      }
      l2 = _2;
    }
  }
  sS(t, i, n) {
    if (null === this.qt) return;
    const { context: s, horizontalPixelRatio: e2, verticalPixelRatio: r2 } = t;
    let h2 = "";
    const a2 = this.nS(e2);
    for (let t2 = n.from; t2 < n.to; t2++) {
      const n2 = i[t2];
      let l2 = Math.round(Math.min(n2.Jo, n2.i_) * r2), o2 = Math.round(Math.max(n2.Jo, n2.i_) * r2), _2 = Math.round(n2._t * e2) - Math.floor(0.5 * this.Kb), u2 = _2 + this.Kb - 1;
      if (n2.sh !== h2) {
        const t3 = n2.sh;
        s.fillStyle = t3, h2 = t3;
      }
      this.qt.gi && (_2 += a2, l2 += a2, u2 -= a2, o2 -= a2), l2 > o2 || s.fillRect(_2, l2, u2 - _2 + 1, o2 - l2 + 1);
    }
  }
}
class Ze extends je {
  constructor() {
    super(...arguments), this.kg = new Ke();
  }
  xb(t, i, n) {
    return { ...this.Qb(t, i, n), ...n.Sh(t) };
  }
  Bg() {
    const t = this.ae.N();
    this.kg.ht({ Un: this.bg, fl: this.le.Et().fl(), tS: t.wickVisible, gi: t.borderVisible, lt: this.Sg });
  }
}
const Ge = { type: "Candlestick", isBuiltIn: true, defaultOptions: { upColor: "#26a69a", downColor: "#ef5350", wickVisible: true, borderVisible: true, borderColor: "#378658", borderUpColor: "#26a69a", borderDownColor: "#ef5350", wickColor: "#737375", wickUpColor: "#26a69a", wickDownColor: "#ef5350" }, ob: (t, i) => new Ze(t, i) };
({ ...e });
export {
  Ce as C,
  Ge as G,
  Ue as U,
  ae as a
};
