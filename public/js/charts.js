// 手绘 Canvas 图表：折线图（得分趋势）+ 柱状图（各科平均分），无第三方依赖
(function () {
  const C_GRID = '#ded9cf', C_TEXT = '#6b746f', C_LINE = '#35675a', C_BAR = '#6f9185';

  function prep(cv) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 600, h = cv.clientHeight || 280;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  function empty(ctx, w, h) {
    ctx.fillStyle = C_TEXT;
    ctx.font = '14px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无数据', w / 2, h / 2);
  }

  function line(cv, labels, values) {
    const p = prep(cv);
    const ctx = p.ctx, w = p.w, h = p.h;
    if (!values.length) return empty(ctx, w, h);
    const L = 46, R = 16, T = 20, B = 32;
    const pw = w - L - R, ph = h - T - B;
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    // 网格与Y轴
    ctx.strokeStyle = C_GRID;
    ctx.fillStyle = C_TEXT;
    ctx.textAlign = 'right';
    for (let v = 0; v <= 100; v += 20) {
      const y = T + ph - (v / 100) * ph;
      ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w - R, y); ctx.stroke();
      ctx.fillText(String(v), L - 8, y + 4);
    }
    // X 位置
    const n = values.length;
    const xs = values.map(function (_, i) { return n === 1 ? L + pw / 2 : L + (pw * i) / (n - 1); });
    const ys = values.map(function (v) { return T + ph - (Math.max(0, Math.min(100, v)) / 100) * ph; });
    // 折线
    ctx.strokeStyle = C_LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    xs.forEach(function (x, i) { i === 0 ? ctx.moveTo(x, ys[i]) : ctx.lineTo(x, ys[i]); });
    ctx.stroke();
    // 点与数值
    ctx.textAlign = 'center';
    const showVal = n <= 16;
    xs.forEach(function (x, i) {
      ctx.fillStyle = C_LINE;
      ctx.beginPath(); ctx.arc(x, ys[i], 3.2, 0, Math.PI * 2); ctx.fill();
      if (showVal) {
        ctx.fillStyle = '#27332f';
        ctx.font = '10.5px "Microsoft YaHei", sans-serif';
        ctx.fillText(String(values[i]), x, ys[i] - 8);
      }
    });
    // X 标签
    ctx.fillStyle = C_TEXT;
    ctx.font = '10.5px "Microsoft YaHei", sans-serif';
    const step = Math.ceil(n / 10);
    labels.forEach(function (lb, i) {
      if (i % step !== 0 && i !== n - 1) return;
      ctx.fillText(lb, xs[i], h - 10);
    });
  }

  function bars(cv, labels, values) {
    const p = prep(cv);
    const ctx = p.ctx, w = p.w, h = p.h;
    if (!values.length) return empty(ctx, w, h);
    const L = 46, R = 16, T = 20, B = 32;
    const pw = w - L - R, ph = h - T - B;
    const max = Math.max(20, Math.ceil(Math.max.apply(null, values) / 10) * 10);
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.strokeStyle = C_GRID;
    ctx.fillStyle = C_TEXT;
    ctx.textAlign = 'right';
    for (let v = 0; v <= max; v += max / 5) {
      const y = T + ph - (v / max) * ph;
      ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w - R, y); ctx.stroke();
      ctx.fillText(String(Math.round(v)), L - 8, y + 4);
    }
    const n = values.length;
    const slot = pw / n;
    const bw = Math.min(56, slot * 0.52);
    ctx.textAlign = 'center';
    labels.forEach(function (lb, i) {
      const x = L + slot * i + (slot - bw) / 2;
      const bh = (values[i] / max) * ph;
      const y = T + ph - bh;
      ctx.fillStyle = C_BAR;
      // 圆角矩形
      const r = Math.min(5, bw / 2, bh);
      ctx.beginPath();
      ctx.moveTo(x, T + ph);
      ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
      ctx.lineTo(x + bw - r, y); ctx.arcTo(x + bw, y, x + bw, y + r, r);
      ctx.lineTo(x + bw, T + ph);
      ctx.closePath(); ctx.fill();
      // 数值
      ctx.fillStyle = '#27332f';
      ctx.font = '11px "Microsoft YaHei", sans-serif';
      ctx.fillText(String(values[i]), x + bw / 2, y - 6);
      // 标签
      ctx.fillStyle = C_TEXT;
      ctx.font = '11.5px "Microsoft YaHei", sans-serif';
      ctx.fillText(lb, x + bw / 2, h - 10);
    });
  }

  window.Charts = { line: line, bars: bars };
})();
