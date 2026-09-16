// 练习页：默写模式 / 填空模式 / 提示模式 + 判分（复制粘贴流程）
window.Views = window.Views || {};

Views.practice = function (view, params) {
  const q = Store.getQuestion(params.id);
  if (!q) {
    view.innerHTML = '<div class="card empty-state"><div class="big-ico">🤔</div>题目不存在或已删除<br><a class="btn primary mt16" href="#/bank">返回题库</a></div>';
    return;
  }

  let mode = params.mode === 'fill' ? 'fill' : 'dictation';
  const focusPoint = params.focus || '';
  let fillState = null;   // {parts, count, total, fillText}
  let hints = [];         // [{level, text}]
  const openedAt = Date.now();

  // ===== 顶部 =====
  function render() {
    App.setActions('<button class="btn small" id="pt-exit">退出练习</button>');
    view.innerHTML =
      '<div class="card q-head-card">' +
        '<div class="row">' +
          UI.subjectTag(q.subject) +
          '<h2 style="margin:0">' + h(q.title) + '</h2>' +
          (focusPoint ? '<span class="badge orange">弱点速练：' + h(focusPoint) + '</span>' : '') +
          '<div class="spacer"></div>' +
          '<span class="muted small">⏱ <b id="pt-timer">00:00</b></span>' +
          '<label class="small muted">宽容度</label>' +
          '<select class="select" id="pt-strict">' +
            ['严格', '标准', '宽松'].map(function (s) {
              const def = (Store.db.settings.strictness || '标准');
              return '<option' + (s === def ? ' selected' : '') + '>' + s + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="q-stem">' + h(q.stem || q.title) + '</div>' +
        (!q.answer || !q.answer.trim() ? '<div class="mt8"><span class="badge red">注意：该题没有标准答案，判分将不准确，请先在题库中编辑补全。</span></div>' : '') +
        '<div id="pt-hints"></div>' +
      '</div>' +
      '<div class="row mb8" style="gap:0">' +
        '<div class="tabs">' +
          '<button class="tab ' + (mode === 'dictation' ? 'active' : '') + '" id="tab-dictation">默写模式</button>' +
          '<button class="tab ' + (mode === 'fill' ? 'active' : '') + '" id="tab-fill">填空模式</button>' +
        '</div>' +
        '<div class="spacer"></div>' +
        '<span class="muted small">按固定采分点与标准答案直接判分</span>' +
      '</div>' +
      '<div id="pt-pane"></div>';

    document.querySelector('#pt-exit').addEventListener('click', function () {
      location.hash = '#/bank';
    });
    view.querySelector('#tab-dictation').addEventListener('click', function () { mode = 'dictation'; render(); });
    view.querySelector('#tab-fill').addEventListener('click', function () { mode = 'fill'; render(); });

    renderHints();
    if (mode === 'dictation') renderDictation(); else renderFill();

    // 计时器
    const timerEl = view.querySelector('#pt-timer');
    const iv = setInterval(function () {
      const s = Math.floor((Date.now() - openedAt) / 1000);
      timerEl.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }, 1000);
    App.onCleanup(function () { clearInterval(iv); });
  }

  function renderHints() {
    const box = view.querySelector('#pt-hints');
    if (!box) return;
    box.innerHTML = hints.map(function (hh, i) {
      const name = { 1: '一级·段落主题', 2: '二级·首2字', 3: '三级·关键词' }[hh.level] || ('提示' + hh.level);
      return '<div class="hint-chip"><span class="lv">💡 第' + (i + 1) + '次提示（' + name + '）</span><span>' + h(hh.text) + '</span></div>';
    }).join('');
  }

  // ===== 默写模式 =====
  function renderDictation() {
    const pane = view.querySelector('#pt-pane');
    const draft = (Store.db.drafts[q.id] || {}).text || '';
    pane.innerHTML =
      '<div class="card">' +
        '<textarea class="textarea answer-area" id="dt-answer" placeholder="在此默写完整答案……（草稿会自动保存）"></textarea>' +
        '<div class="row mt8 small"><label for="dt-file">或上传作答文件：</label><input type="file" id="dt-file" accept=".docx,.txt,.md,.markdown,.pdf,.png,.jpg,.jpeg,.webp" class="input" style="max-width:330px"><span class="muted">支持 Word、PDF 与图片，核对后提交</span></div>' +
        '<div class="char-count"><span id="dt-count">' + draft.length + '</span> 字</div>' +
        '<div class="row mt16">' +
          '<button class="btn" id="dt-hint">💡 请求提示</button>' +
          '<button class="btn ghost" id="dt-clear">清空草稿</button>' +
          '<div class="spacer"></div>' +
          '<button class="btn primary big" id="dt-submit">提交判分 →</button>' +
        '</div>' +
        '<div class="muted small mt8">提示会按「段落主题 → 首2字 → 关键词」逐级给出，不会泄露完整答案。</div>' +
      '</div>';
    const ta = pane.querySelector('#dt-answer');
    ta.value = draft;
    if (draft) ta.placeholder = '已恢复上次草稿，可继续作答……';
    let saveTimer = null;
    ta.addEventListener('input', function () {
      pane.querySelector('#dt-count').textContent = ta.value.length;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { Store.saveDraft(q.id, ta.value); }, 500);
    });
    pane.querySelector('#dt-file').addEventListener('change', async function (e) {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await Documents.extract(file);
        if (!text.trim()) throw new Error('文件中没有可识别的文字，扫描图片需要先做 OCR');
        ta.value = text.trim();
        ta.dispatchEvent(new Event('input'));
        UI.toast('作答文件已读取，请核对文字后提交判分');
      } catch (err) {
        UI.toast('读取作答文件失败：' + err.message, 'err');
      }
    });
    pane.querySelector('#dt-clear').addEventListener('click', function () {
      ta.value = '';
      pane.querySelector('#dt-count').textContent = '0';
      Store.saveDraft(q.id, '');
    });
    pane.querySelector('#dt-hint').addEventListener('click', openHintModal);
    pane.querySelector('#dt-submit').addEventListener('click', function () {
      const text = ta.value.trim();
      if (!text) {
        UI.toast('作答为空：按判分规则，空白作答直接判 0 分，请先作答。', 'warn');
        return;
      }
      if (text.length < 12) {
        UI.confirmBox('作答过短', '当前作答不足 12 字，按规则可能被认定为敷衍而直接判 <b>0 分</b>。<br>确定仍要提交判分吗？')
          .then(function (ok) { if (ok) openGradingModal(ta.value.trim()); });
        return;
      }
      openGradingModal(text);
    });
  }

  // ===== 填空模式 =====
  function renderFill() {
    const pane = view.querySelector('#pt-pane');
    if (!fillState) {
      pane.innerHTML =
        '<div class="card">' +
          '<h2>🧩 生成填空题</h2>' +
          '<p class="muted">将标准答案中的关键采分点挖空（每空 2-8 字，约挖 60%，保留框架文字）。</p>' +
          '<div class="row mt16">' +
            '<button class="btn primary big" id="fg-ai">🤖 AI 智能挖空</button>' +
            '<button class="btn big" id="fg-local">⚡ 本地快速挖空</button>' +
          '</div>' +
          '<div class="muted small mt16">AI 智能挖空按采分点挖空、更精准，走「复制提示词 → 粘贴回结果」流程；本地快速挖空为近似规则、立即生成、无需 AI。</div>' +
        '</div>';
      pane.querySelector('#fg-ai').addEventListener('click', function () { openFillGenModal(); });
      pane.querySelector('#fg-local').addEventListener('click', function () {
        const text = Blanks.generateLocal(q.answer);
        const st = Blanks.parseToParts(text);
        if (!st) { UI.toast('生成失败：该题答案太短或没有可挖空的术语', 'err'); return; }
        st.expectedAnswers = Blanks.lastExpected();
        applyFillState(st, text);
      });
      return;
    }
    // 已有填空题 → 渲染作答
    const inputsHtml = fillState.parts.map(function (p) {
      if (p.type === 'text') return h(p.text);
      return '<span class="blank-wrap"><input class="blank-input" data-idx="' + p.idx + '" style="width:' + Math.max(72, Math.round(p.score * 9)) + 'px" autocomplete="off"><span class="blank-score">' + p.score + '分</span></span>';
    }).join('');
    pane.innerHTML =
      '<div class="card">' +
        '<div class="row mb8">' +
          '<span class="badge blue">共 ' + fillState.count + ' 空 · 合计 ' + fillState.total + ' 分</span>' +
          '<div class="spacer"></div>' +
          '<button class="btn small" id="fl-regen">↻ 重新挖空</button>' +
        '</div>' +
        '<div class="fill-text" style="white-space:pre-wrap">' + inputsHtml + '</div>' +
        '<div class="row mt16">' +
          '<button class="btn ghost" id="fl-showanswer">偷看标准答案（将不计入成绩）</button>' +
          '<div class="spacer"></div>' +
          '<button class="btn primary big" id="fl-submit">提交判分 →</button>' +
        '</div>' +
        '<div id="fl-answer" hidden><hr class="divider"><h3 style="font-size:15px;margin-bottom:6px">标准答案</h3><div class="md small">' + MD.render(q.answer).replace(/<h2>/g, '<h3 style="font-size:15px">') + '</div></div>' +
      '</div>';
    pane.querySelector('#fl-regen').addEventListener('click', function () { fillState = null; renderFill(); });
    pane.querySelector('#fl-showanswer').addEventListener('click', function () {
      const el = pane.querySelector('#fl-answer');
      el.hidden = !el.hidden;
    });
    pane.querySelector('#fl-submit').addEventListener('click', function () {
      const answers = [];
      pane.querySelectorAll('.blank-input').forEach(function (inp) { answers.push(inp.value); });
      openGradingModal(null, answers);
    });
  }

  function applyFillState(st, rawText) {
    // 规范化填空题原文（保证带分值标注，供判分提示词使用）
    const canonical = st.parts.map(function (p) {
      return p.type === 'text' ? p.text : '______（' + p.score + '分）';
    }).join('');
    fillState = { parts: st.parts, count: st.count, total: st.total, fillText: canonical };
    render();
  }

  // ===== AI 智能挖空弹窗（AI 自动 / 手动） =====
  function openFillGenModal() {
    const promptText = Prompt.fillGenPrompt(q);
    const overlay = UI.openModal(
      '<div class="modal-head"><h3>AI 智能挖空</h3><button class="modal-close">×</button></div>' +
      '<div class="modal-body" id="fg-body"></div>',
      { wide: true }
    );
    overlay.querySelector('.modal-close').addEventListener('click', function () { UI.closeModal(overlay); });
    const body = overlay.querySelector('#fg-body');

    function applyGenerated(text) {
      const st = Blanks.parseToParts(text);
      if (!st) throw new Error('AI 输出中未包含 ______ 挖空标记');
      UI.closeModal(overlay);
      applyFillState(st, text);
      UI.toast('已生成 ' + st.count + ' 个填空，开始作答吧');
    }

    function renderAuto() {
      body.innerHTML =
        '<div style="text-align:center;padding:16px 6px">' +
          '<div style="font-size:36px">🧩</div>' +
          '<p class="muted small">按采分点智能挖空（约挖 60%，每空 2-8 字，保留框架文字）</p>' +
          '<button class="btn primary big" id="fg-auto">⚡ 一键生成填空题</button>' +
          '<div id="fg-status" class="muted small mt8"></div>' +
          '<div class="mt16"><button class="btn small ghost" id="fg-switch">改用手动复制粘贴</button></div>' +
        '</div>';
      body.querySelector('#fg-switch').addEventListener('click', renderManual);
      body.querySelector('#fg-auto').addEventListener('click', async function () {
        const status = body.querySelector('#fg-status');
        const btn = body.querySelector('#fg-auto');
        btn.disabled = true;
        status.innerHTML = '<span class="spin">⏳</span> AI 正在挖空，约需 10-30 秒…';
        try {
          const text = await LLM.chat(promptText, { temperature: 0.2 });
          applyGenerated(text);
        } catch (e) {
          status.innerHTML = '<span style="color:var(--red)">❌ ' + h(e.message) + '</span>';
          btn.disabled = false;
        }
      });
    }

    function renderManual() {
      body.innerHTML =
        '<div class="steps"><div class="step"><span class="no">1</span><div class="t">复制挖空提示词</div></div>' +
        '<div class="step"><span class="no">2</span><div class="t">粘贴到 AI 发送</div></div>' +
        '<div class="step"><span class="no">3</span><div class="t">把生成的填空题贴回来</div></div></div>' +
        '<textarea class="prompt-box" readonly id="fg-prompt"></textarea>' +
        '<div class="row mt8">' +
          '<button class="btn primary" id="fg-copy">📋 复制提示词</button>' +
          '<span class="muted small">打开：</span>' +
          aiLinksHtml() +
        '</div>' +
        '<hr class="divider">' +
        '<textarea class="textarea" id="fg-paste" rows="7" placeholder="把 AI 生成的填空题（含 ______ 和分值标注）完整粘贴到这里…"></textarea>' +
        '<div class="row mt8"><button class="btn primary" id="fg-parse">解析填空题 →</button></div>';
      body.querySelector('#fg-prompt').value = promptText;
      body.querySelector('#fg-copy').addEventListener('click', function () {
        UI.copyText(promptText).then(function () { UI.toast('提示词已复制，去粘贴给 AI 吧'); });
      });
      body.querySelector('#fg-parse').addEventListener('click', function () {
        const text = body.querySelector('#fg-paste').value.trim();
        if (!text) { UI.toast('请先粘贴 AI 生成的填空题', 'warn'); return; }
        try {
          applyGenerated(text);
        } catch (e) {
          UI.toast(e.message, 'err');
        }
      });
    }

    if (LLM.configured()) renderAuto(); else renderManual();
  }

  // ===== 提示模式弹窗（AI 自动 / 手动） =====
  function openHintModal() {
    const overlay = UI.openModal(
      '<div class="modal-head"><h3>💡 请求提示（绝不泄露完整答案）</h3><button class="modal-close">×</button></div>' +
      '<div class="modal-body" id="hm-body"></div>',
      { wide: true }
    );
    overlay.querySelector('.modal-close').addEventListener('click', function () { UI.closeModal(overlay); });
    const body = overlay.querySelector('#hm-body');

    function currentAnswer() {
      const ta = view.querySelector('#dt-answer');
      return ta ? ta.value : '';
    }

    function renderLevels() {
      body.innerHTML =
        '<p class="muted small mb8">选择提示级别，针对你当前还没写出的下一个采分点给出帮助。</p>' +
        '<div class="row">' +
          '<button class="btn big" data-lv="1">一级<br><span class="small muted">段落主题</span></button>' +
          '<button class="btn big" data-lv="2">二级<br><span class="small muted">首 2 个字</span></button>' +
          '<button class="btn big" data-lv="3">三级<br><span class="small muted">关键词≤5字</span></button>' +
        '</div>' +
        (LLM.configured() ? '' :
          '<div class="row mt8 small" style="background:var(--primary-bg);padding:8px 12px;border-radius:8px">' +
            '<span>提示词中包含本题标准答案，仅用于 AI 判断遗漏点，系统严格禁止 AI 输出完整答案。</span>' +
          '</div>');
      body.querySelectorAll('[data-lv]').forEach(function (b) {
        b.addEventListener('click', function () { chooseLevel(Number(b.dataset.lv)); });
      });
    }

    function chooseLevel(level) {
      if (LLM.configured()) renderAutoHint(level); else renderManualHint(level);
    }

    // AI 自动获取提示
    function renderAutoHint(level) {
      const lvName = { 1: '一级·段落主题', 2: '二级·首2字', 3: '三级·关键词' }[level];
      body.innerHTML =
        '<div style="text-align:center;padding:16px 6px">' +
          '<div style="font-size:36px">💡</div>' +
          '<h3>' + lvName + '</h3>' +
          '<div id="hm-status" class="muted small mt8"><span class="spin">⏳</span> AI 正在生成提示…</div>' +
          '<div class="mt16"><button class="btn small ghost" id="hm-manual">改用手动方式</button></div>' +
        '</div>';
      body.querySelector('#hm-manual').addEventListener('click', function () { renderManualHint(level); });
      LLM.chat(Prompt.hintPrompt(q, currentAnswer(), level), { temperature: 0.3 }).then(function (text) {
        hints.push({ level: level, text: text.replace(/```[a-z]*\n?/g, '').trim().slice(0, 200) });
        renderHints();
        UI.closeModal(overlay);
        UI.toast('提示已添加，继续默写吧');
      }).catch(function (e) {
        body.querySelector('#hm-status').innerHTML = '<span style="color:var(--red)">❌ ' + h(e.message) + '</span>';
      });
    }

    // 手动复制粘贴获取提示
    function renderManualHint(level) {
      const ta = view.querySelector('#dt-answer');
      const promptText = Prompt.hintPrompt(q, ta ? ta.value : '', level);
      body.innerHTML =
        '<div class="steps">' +
          '<div class="step"><span class="no">1</span><div class="t">复制提示词</div></div>' +
          '<div class="step"><span class="no">2</span><div class="t">粘贴到 AI 发送</div></div>' +
          '<div class="step"><span class="no">3</span><div class="t">把提示贴回来</div></div>' +
        '</div>' +
        '<textarea class="prompt-box" readonly id="hm-prompt"></textarea>' +
        '<div class="row mt8">' +
          '<button class="btn primary" id="hm-copy">📋 复制提示词</button>' +
          '<span class="muted small">打开：</span>' + aiLinksHtml() +
        '</div>' +
        '<div class="muted small mt8">⚠️ 提示词中包含本题标准答案，仅用于 AI 判断你遗漏了哪个采分点；系统设定已严格禁止 AI 在提示模式输出完整答案。</div>' +
        '<hr class="divider">' +
        '<textarea class="textarea" id="hm-paste" rows="4" placeholder="把 AI 给出的提示粘贴到这里…"></textarea>' +
        '<div class="row mt8"><button class="btn primary" id="hm-parse">✅ 收下这条提示</button></div>';
      body.querySelector('#hm-prompt').value = promptText;
      body.querySelector('#hm-copy').addEventListener('click', function () {
        UI.copyText(promptText).then(function () { UI.toast('提示词已复制'); });
      });
      body.querySelector('#hm-parse').addEventListener('click', function () {
        let text = body.querySelector('#hm-paste').value.trim();
        if (!text) { UI.toast('请先粘贴 AI 给出的提示', 'warn'); return; }
        text = text.replace(/```[a-z]*\n?/g, '').trim();
        hints.push({ level: level, text: text.slice(0, 200) });
        renderHints();
        UI.closeModal(overlay);
        UI.toast('提示已添加，继续默写吧');
      });
    }

    renderLevels();
  }

  // ===== AI 快捷链接 =====
  function aiLinksHtml() {
    const links = (Store.db.settings.aiLinks || []);
    return links.map(function (l) {
      return '<a class="btn small" target="_blank" rel="noopener" href="' + h(l.url) + '">' + h(l.name) + ' ↗</a>';
    }).join('');
  }
  function bindAiLinks() { /* 链接为原生 <a>，无需绑定 */ }

  // ===== 判分弹窗（AI 自动判分 / 手动复制粘贴） =====
  function openGradingModal(answerText, fillAnswers) {
    const strictness = view.querySelector('#pt-strict').value;
    const isFill = mode === 'fill';
    const targetPoint = focusPoint && Rubric.normalize(q.rubric || Rubric.derive(q.answer)).find(function (p) { return p.name === focusPoint; });
    const gradingQuestion = targetPoint ? Object.assign({}, q, {
      title: q.title + ' · ' + targetPoint.name,
      stem: '请只回答本题采分点：“' + targetPoint.name + '”',
      answer: targetPoint.correct,
      rubric: [{ name: targetPoint.name, full: 100, correct: targetPoint.correct }]
    }) : q;
    const promptText = isFill
      ? Prompt.fillGradingPrompt(gradingQuestion, fillState.fillText, fillAnswers, strictness)
      : Prompt.gradingPrompt(gradingQuestion, answerText, strictness);

    const overlay = UI.openModal(
      '<div class="modal-head"><h3>提交判分（' + (isFill ? '填空' : '默写') + '模式 · ' + h(strictness) + '）</h3><button class="modal-close">×</button></div>' +
      '<div class="modal-body" id="gm-body"></div>',
      { wide: true }
    );
    overlay.querySelector('.modal-close').addEventListener('click', function () { UI.closeModal(overlay); });

    async function finalize(score, summary, raw) {
      try {
        const candidateAnswer = isFill
          ? (fillAnswers || []).map(function (a, i) { return '空' + (i + 1) + '：' + a; }).join('\n')
          : answerText;
        const entryId = await finalizeGrading(q, focusPoint ? '弱点' : (isFill ? '填空' : '默写'), score, summary, raw, strictness, candidateAnswer);
        UI.closeModal(overlay);
        UI.toast('判分结果已保存');
        location.hash = '#/result/' + entryId;
      } catch (e) {
        UI.toast('保存失败：' + e.message, 'err');
      }
    }

    // —— 一键直接判分：固定采分点，本地可复现；已配置接口时后台语义复核 ——
    function renderAuto() {
      const body = overlay.querySelector('#gm-body');
      body.innerHTML =
        '<div style="text-align:center;padding:22px 10px 10px">' +
          '<div style="font-size:44px">⚖️</div>' +
          '<h3 style="margin:6px 0 4px">一键精准判分</h3>' +
          '<p class="muted small">固定采分点和分值，逐项引用你的作答原句作为证据<br>' +
            (LLM.configured() ? '网站将在后台完成语义复核，无需复制或粘贴任何提示词' : '当前使用本地结构化判分，结果可重复、不会调用外部 AI') + '</p>' +
          '<div class="row" style="justify-content:center;margin:12px 0"><span class="badge blue">采分点 ' + Rubric.normalize(gradingQuestion.rubric || Rubric.derive(gradingQuestion.answer)).length + ' 项</span><span class="badge green">总分固定 100</span><span class="badge gray">证据必须来自作答原文</span></div>' +
          '<button class="btn primary big" id="gm-auto">⚡ 直接判分</button>' +
        '</div>' +
        '<div id="gm-status" class="muted small" style="text-align:center;min-height:24px"></div>';
      body.querySelector('#gm-auto').addEventListener('click', async function () {
        const status = body.querySelector('#gm-status');
        const btn = body.querySelector('#gm-auto');
        btn.disabled = true;
        status.innerHTML = '<span class="spin">⏳</span> 正在逐项核对采分点与作答证据…';
        try {
          let r;
          if (isFill && fillState.expectedAnswers && fillState.expectedAnswers.length) {
            r = GradeEngine.gradeFill(fillAnswers, fillState.expectedAnswers, fillState.parts.filter(function (p) { return p.type === 'blank'; }).map(function (p) { return p.score; }));
          } else if (isFill) {
            if (!LLM.configured()) throw new Error('这份 AI 填空题没有保存标准空答案，请重新选择“本地快速挖空”后直接判分');
            const reply = await LLM.chat(promptText, { temperature: 0 });
            const parsed = Prompt.parseResult(reply);
            if (parsed.score == null) throw new Error('填空语义复核未返回有效分数');
            r = { score: parsed.score, summary: parsed.summary, display: parsed.display || reply };
          } else {
            r = await GradeEngine.grade(gradingQuestion, answerText, strictness, function (message) { status.innerHTML = '<span class="spin">⏳</span> ' + h(message); });
          }
          if (r.warning) UI.toast(r.warning, 'warn');
          await finalize(r.score, r.summary, r.display);
        } catch (e) {
          status.innerHTML = '<span style="color:var(--red)">❌ ' + h(e.message) + '</span>';
          btn.disabled = false;
        }
      });
    }

    // —— 手动复制粘贴 ——
    function renderManual() {
      const body = overlay.querySelector('#gm-body');
      body.innerHTML =
        (LLM.configured() ? '' :
          '<div class="row mb8 small" style="background:var(--primary-bg);padding:8px 12px;border-radius:8px">' +
            '<span>💡 在「设置」配置可用的 AI 接口后，这里可以在站内自动判分。</span>' +
            '<a class="btn small" href="#/settings">去配置 →</a>' +
          '</div>') +
        '<div class="steps">' +
          '<div class="step"><span class="no">1</span><div class="t">复制下方判分提示词</div></div>' +
          '<div class="step"><span class="no">2</span><div class="t">粘贴到 AI 对话框并发送</div></div>' +
          '<div class="step"><span class="no">3</span><div class="t">把 AI 回复粘贴回来解析</div></div>' +
        '</div>' +
        '<textarea class="prompt-box" readonly id="gm-prompt"></textarea>' +
        '<div class="row mt8">' +
          '<button class="btn primary" id="gm-copy">📋 复制判分提示词</button>' +
          '<span class="muted small">复制后打开：</span>' + aiLinksHtml() +
        '</div>' +
        '<hr class="divider">' +
        '<textarea class="textarea" id="gm-paste" rows="8" placeholder="把 AI 的完整判分回复粘贴到这里（含总分、采分点明细表、高亮标注等）…"></textarea>' +
        '<div class="row mt8">' +
          '<button class="btn primary" id="gm-parse">✅ 解析判分并保存</button>' +
          '<span class="muted small">解析失败时，手动录入总分：</span>' +
          '<input class="input" id="gm-manual" type="number" min="0" max="100" step="0.5" style="width:84px">' +
          '<button class="btn" id="gm-manual-save">手动存档</button>' +
        '</div>';
      body.querySelector('#gm-prompt').value = promptText;
      body.querySelector('#gm-copy').addEventListener('click', function () {
        UI.copyText(promptText).then(function () { UI.toast('判分提示词已复制，去粘贴给 AI 吧'); });
      });
      body.querySelector('#gm-parse').addEventListener('click', function () {
        const text = body.querySelector('#gm-paste').value.trim();
        if (!text) { UI.toast('请先粘贴 AI 的判分回复', 'warn'); return; }
        const r = Prompt.parseResult(text);
        if (r.score == null) {
          UI.toast('未能自动解析出总分，请检查粘贴内容，或使用下方手动存档', 'err');
          return;
        }
        finalize(r.score, r.summary, text);
      });
      body.querySelector('#gm-manual-save').addEventListener('click', function () {
        const v = parseFloat(body.querySelector('#gm-manual').value);
        if (isNaN(v) || v < 0 || v > 100) { UI.toast('请输入 0-100 的总分', 'warn'); return; }
        finalize(v, null, '');
      });
    }

    renderAuto();
  }

  // 判分存档：历史 + 错题本 + 复习排期
  async function finalizeGrading(question, modeName, score, summary, raw, strictness, candidateAnswer) {
    let lostPoints = [];
    if (summary) {
      if (Array.isArray(summary.lostPoints) && summary.lostPoints.length) {
        lostPoints = summary.lostPoints.filter(Boolean).map(String);
      }
    } else if (raw) {
      lostPoints = Prompt.parseResult(raw).lostPoints;
    }
    const study = Store.nextReview(question.id, score, { hintsUsed: hints.length, durationSeconds: Math.round((Date.now() - openedAt) / 1000) });
    const entry = Store.makeHistory({
      questionId: question.id, questionTitle: question.title, subject: question.subject,
      mode: modeName, score: score, strictness: strictness, lostPoints: lostPoints,
      candidateAnswer: candidateAnswer || '', standardAnswer: question.answer || '', raw: raw || '',
      gradingPoints: summary && Array.isArray(summary.points) ? summary.points : [],
      confidence: summary && summary.confidence, needsReview: !!(summary && summary.needsReview),
      rubricSnapshot: Rubric.normalize(question.rubric || Rubric.derive(question.answer)),
      model: LLM.configured() ? Store.db.settings.llm.model : '本地结构化', promptVersion: 3,
      hintsUsed: hints.length, durationSeconds: Math.round((Date.now() - openedAt) / 1000),
      intervalDays: study.intervalDays, masteryStreak: study.streak
    });
    if (summary && Array.isArray(summary.points) && summary.points.length) {
      Store.recordWrong(question.id, summary.points
        .filter(function (p) { return Number(p.score) < Number(p.full); })
        .map(function (p) { return { name: p.name, correct: p.correct }; }));
      Store.reconcileWrongPoints(question.id, summary.points);
    } else if (lostPoints.length) {
      Store.recordWrong(question.id, lostPoints.map(function (n) { return { name: n }; }));
    }
    Store.upsertReview(question.id, study.dueDate, Number(score), lostPoints);
    delete Store.db.drafts[question.id];
    await Store.save();
    return entry.id;
  }

  render();
};
