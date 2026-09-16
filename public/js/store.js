// 数据层：与本地服务器 API 交互 + 数据操作
(function () {
  const Store = {
    db: null,
    localMode: false, // true：无服务器，数据存浏览器 localStorage
    _saveTimer: null,

    async init() {
      try {
        const r = await fetch('/api/db');
        if (!r.ok) {
          let detail = '';
          try { detail = (await r.json()).error || ''; } catch (err) { /* 使用状态码 */ }
          throw new Error(detail || '无法读取数据（' + r.status + '）');
        }
        this.db = await r.json();
        this.localMode = false;
      } catch (e) {
        if (location.protocol !== 'file:') throw e;
        // 无本地服务器（如直接双击打开 index.html）→ 浏览器存储模式
        this.localMode = true;
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem('fkms-db')); } catch (err) { saved = null; }
        this.db = (saved && Array.isArray(saved.questions)) ? saved : freshSeedDb();
      }
      if (!this.db.drafts) this.db.drafts = {};
      if (!this.db.examSessions) this.db.examSessions = [];
      const savedLlm = this.db.settings && this.db.settings.llm;
      if (savedLlm && /api\.deepseek\.com/i.test(savedLlm.baseUrl || '') && /^(?:deepseek-chat|deepseek-reasoner)$/i.test(savedLlm.model || '')) {
        savedLlm.model = 'deepseek-flash';
      }
      // 向后兼容旧题库：只在内存中补齐新字段，下一次保存时持久化。
      this.db.questions.forEach(function (q) {
        if (!Array.isArray(q.rubric) || !q.rubric.length || !q.rubricVersion) q.rubric = Rubric.derive(q.answer);
        if (!q.rubricVersion) q.rubricVersion = 2;
        if (!Array.isArray(q.tags)) q.tags = [];
        if (q.starred == null) q.starred = false;
      });
    },

    async save() {
      if (this.localMode) {
        try {
          localStorage.setItem('fkms-db', JSON.stringify(this.db));
        } catch (e) {
          throw new Error('浏览器存储已满，请导出备份后清理历史记录');
        }
        return;
      }
      const r = await fetch('/api/db', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.db)
      });
      if (!r.ok) throw new Error('保存失败');
    },

    saveSoon() {
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(function () {
        Store.save().catch(function (e) { UI.toast('自动保存失败：' + e.message, 'err'); });
      }, 700);
    },

    // ===== 题库 =====
    getQuestion(id) { return this.db.questions.find(function (q) { return q.id === id; }); },

    async addQuestion(q) {
      if (!Array.isArray(q.rubric) || !q.rubric.length) q.rubric = Rubric.derive(q.answer);
      q.rubricVersion = 2;
      if (!Array.isArray(q.tags)) q.tags = [];
      q.starred = !!q.starred;
      q.id = UI.uid();
      q.createdAt = new Date().toISOString();
      if (!q.source) q.source = '手动';
      this.db.questions.unshift(q);
      await this.save();
      return q;
    },

    async addQuestions(items) {
      const now = new Date().toISOString();
      items.forEach(function (q) {
        if (!Array.isArray(q.rubric) || !q.rubric.length) q.rubric = Rubric.derive(q.answer);
        q.rubricVersion = 2;
        if (!Array.isArray(q.tags)) q.tags = [];
        q.starred = !!q.starred;
        q.id = UI.uid();
        q.createdAt = now;
        if (!q.source) q.source = '导入';
      });
      this.db.questions.unshift.apply(this.db.questions, items);
      await this.save();
      return items;
    },

    questionKey(q) {
      return String(q && q.subject || '').trim() + '|' + String(q && q.title || '').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
    },

    async importQuestions(items, mode) {
      const existing = new Map(this.db.questions.map(function (q) { return [Store.questionKey(q), q]; }));
      const add = []; let updated = 0; let skipped = 0;
      (items || []).forEach(function (item) {
        const old = existing.get(Store.questionKey(item));
        if (old && mode === 'skip') { skipped++; return; }
        if (old && mode === 'overwrite') {
          const keep = { id: old.id, createdAt: old.createdAt, starred: old.starred };
          Object.assign(old, item, keep, { rubric: Rubric.normalize(item.rubric || Rubric.derive(item.answer)), rubricVersion: 2 });
          updated++; return;
        }
        add.push(item);
      });
      if (add.length) {
        const now = new Date().toISOString();
        add.forEach(function (q) { q.id = UI.uid(); q.createdAt = now; q.rubric = Rubric.normalize(q.rubric || Rubric.derive(q.answer)); q.rubricVersion = 2; q.tags = Array.isArray(q.tags) ? q.tags : []; q.starred = !!q.starred; if (!q.source) q.source = '导入'; });
        this.db.questions.unshift.apply(this.db.questions, add);
      }
      await this.save();
      return { added: add.length, updated: updated, skipped: skipped };
    },

    async updateQuestion(id, patch) {
      const q = this.getQuestion(id);
      if (q) {
        Object.assign(q, patch);
        if (patch.answer && !Object.prototype.hasOwnProperty.call(patch, 'rubric')) q.rubric = Rubric.derive(patch.answer);
        if (patch.answer || patch.rubric) q.rubricVersion = 2;
      }
      await this.save();
      return q;
    },

    async deleteQuestion(id) {
      this.db.questions = this.db.questions.filter(function (x) { return x.id !== id; });
      this.db.reviewQueue = this.db.reviewQueue.filter(function (x) { return x.questionId !== id; });
      this.db.wrongbook = this.db.wrongbook.filter(function (x) { return x.questionId !== id; });
      delete this.db.drafts[id];
      await this.save();
    },

    // ===== 判分历史 =====
    makeHistory(entry) {
      entry.id = UI.uid();
      entry.date = new Date().toISOString();
      this.db.history.unshift(entry);
      return entry;
    },

    deleteHistory(id) {
      this.db.history = this.db.history.filter(function (h) { return h.id !== id; });
      return this.save();
    },

    // ===== 错题本 =====
    recordWrong(questionId, points) {
      const now = new Date().toISOString();
      (points || []).forEach(function (p) {
        if (!p || !p.name) return;
        let e = Store.db.wrongbook.find(function (w) { return w.questionId === questionId && w.point === p.name; });
        if (e) {
          e.count = (e.count || 1) + 1;
          e.lastDate = now;
          if (p.correct) e.correct = p.correct;
        } else {
          Store.db.wrongbook.push({
            id: UI.uid(), questionId: questionId, point: p.name,
            correct: p.correct || '', count: 1, lastDate: now, mastered: false
          });
        }
      });
    },

    // ===== 复习队列 =====
    upsertReview(questionId, dueDate, score, lostPoints) {
      let it = this.db.reviewQueue.find(function (i) { return i.questionId === questionId; });
      if (it) {
        it.dueDate = dueDate; it.fromScore = score; it.lostPoints = lostPoints || [];
      } else {
        this.db.reviewQueue.push({
          id: UI.uid(), questionId: questionId, dueDate: dueDate,
          fromScore: score, lostPoints: lostPoints || [], createdAt: new Date().toISOString()
        });
      }
    },

    removeReview(questionId) {
      this.db.reviewQueue = this.db.reviewQueue.filter(function (i) { return i.questionId !== questionId; });
    },

    dueItems() {
      const t = UI.todayStr();
      return this.db.reviewQueue.filter(function (i) { return i.dueDate <= t; })
        .sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; });
    },

    // ===== 统计 =====
    latestScoreByQuestion() {
      const map = {};
      this.db.history.forEach(function (h) {
        if (h.score == null) return;
        if (!map[h.questionId] || map[h.questionId].date < h.date) map[h.questionId] = h;
      });
      return map;
    },

    masteredIds() {
      const m = this.latestScoreByQuestion();
      return Object.keys(m).filter(function (k) { return m[k].score >= 90; });
    },

    questionHistory(questionId) {
      return this.db.history.filter(function (h) { return h.questionId === questionId; });
    },

    // 根据近期表现、连续掌握次数、提示和耗时动态计算下次复习日期。
    nextReview(questionId, score, detail) {
      const s = Number(score);
      const previous = this.questionHistory(questionId).filter(function (h) { return h.score != null; }).slice(0, 6);
      const scores = [s].concat(previous.map(function (h) { return Number(h.score); }));
      let streak = 0;
      for (let i = 0; i < scores.length; i++) {
        if (scores[i] >= 90) streak++; else break;
      }
      let days = s < 60 ? 0 : s < 70 ? 1 : s < 80 ? 2 : s < 90 ? 4 : 7;
      if (streak >= 3) days = 30;
      else if (streak >= 2) days = 14;
      const hints = Number(detail && detail.hintsUsed || 0);
      if (hints >= 2) days = Math.min(days, 2);
      else if (hints === 1) days = Math.min(days, 4);
      return { dueDate: UI.addDaysStr(UI.todayStr(), days), intervalDays: days, streak: streak };
    },

    // 某采分点本次完全命中后解除旧的“未掌握”状态；失分时继续累计。
    reconcileWrongPoints(questionId, points) {
      (points || []).forEach(function (p) {
        if (!p || !p.name) return;
        const full = Number(p.full);
        const score = Number(p.score);
        const old = Store.db.wrongbook.find(function (w) { return w.questionId === questionId && w.point === p.name; });
        if (old && full > 0 && score >= full) old.mastered = true;
      });
    },

    // ===== 草稿 =====
    saveDraft(qid, text) {
      if (text && text.trim()) this.db.drafts[qid] = { text: text, savedAt: new Date().toISOString() };
      else delete this.db.drafts[qid];
      this.saveSoon();
    }
  };

  window.Store = Store;
})();
