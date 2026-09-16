// 通用 UI 组件与工具函数
(function () {
  const SUBJECTS = ['刑法', '民法', '刑事诉讼法', '民事诉讼法', '行政法', '商经知', '理论法', '未分类'];
  const SUBJECT_COLORS = {
    '刑法': '#a44e43', '民法': '#52738a', '刑事诉讼法': '#786485', '民诉': '#4f7d79',
    '民事诉讼法': '#4f7d79', '行政法': '#a06d35', '商经知': '#8a5b70', '理论法': '#35675a'
  };
  const FALLBACK_COLOR = '#717871';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr(d) {
    const t = d || new Date();
    return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate());
  }
  function addDaysStr(dateStr, n) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const t = new Date(y, m - 1, d + n);
    return todayStr(t);
  }
  function fmtDateTime(iso) {
    if (!iso) return '';
    const t = new Date(iso);
    return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate()) + ' ' + pad2(t.getHours()) + ':' + pad2(t.getMinutes());
  }
  function fmtDate(dateStr) {
    if (!dateStr) return '';
    const today = todayStr();
    if (dateStr === today) return '今天';
    if (dateStr === addDaysStr(today, 1)) return '明天';
    const diff = daysBetween(today, dateStr);
    if (diff < 0) return '逾期' + (-diff) + '天';
    if (diff <= 30) return diff + '天后';
    return dateStr;
  }
  function daysBetween(a, b) {
    const [y1, m1, d1] = a.split('-').map(Number);
    const [y2, m2, d2] = b.split('-').map(Number);
    return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
  }

  function toast(msg, type) {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'ok');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s'; el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 320);
    }, 2200);
  }

  function openModal(innerHtml, opts) {
    opts = opts || {};
    const root = document.getElementById('modal-root');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = '<div class="modal-card ' + (opts.wide ? 'wide' : '') + '">' + innerHtml + '</div>';
    root.appendChild(overlay);
    return overlay;
  }
  function closeModal(overlay) {
    if (overlay) overlay.remove();
    else {
      const root = document.getElementById('modal-root');
      if (root.lastElementChild) root.lastElementChild.remove();
    }
  }

  function confirmBox(title, msg, danger) {
    return new Promise(function (resolve) {
      const overlay = openModal(
        '<div class="modal-head"><h3>' + esc(title) + '</h3><button class="modal-close" data-act="no">×</button></div>' +
        '<div class="modal-body">' + msg + '</div>' +
        '<div class="modal-foot"><button class="btn" data-act="no">取消</button>' +
        '<button class="btn ' + (danger ? 'danger' : 'primary') + '" data-act="yes">确定</button></div>'
      );
      overlay.addEventListener('click', function (e) {
        const act = e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'yes') { closeModal(overlay); resolve(true); }
        else if (act === 'no' || e.target === overlay) { closeModal(overlay); resolve(false); }
      });
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { }
    ta.remove();
    if (!ok) throw new Error('复制失败，请手动全选复制');
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
  }

  function subjectTag(subject) {
    const color = SUBJECT_COLORS[subject] || FALLBACK_COLOR;
    return '<span class="tag" style="background:' + color + '">' + esc(subject || '其他') + '</span>';
  }
  function scoreBadge(score) {
    if (score == null || isNaN(score)) return '<span class="badge gray">未判分</span>';
    const s = Number(score);
    let cls = 'red';
    if (s >= 90) cls = 'green';
    else if (s >= 70) cls = 'blue';
    else if (s >= 60) cls = 'orange';
    return '<span class="badge ' + cls + '">' + s + ' 分</span>';
  }

  window.UI = {
    SUBJECTS: SUBJECTS, SUBJECT_COLORS: SUBJECT_COLORS,
    esc: esc, uid: uid, todayStr: todayStr, addDaysStr: addDaysStr,
    fmtDateTime: fmtDateTime, fmtDate: fmtDate, daysBetween: daysBetween,
    toast: toast, openModal: openModal, closeModal: closeModal, confirmBox: confirmBox,
    copyText: copyText, download: download, subjectTag: subjectTag, scoreBadge: scoreBadge
  };
  window.h = esc;
})();
