// ==UserScript==
// @name         Google AI Mode Chat → Markdown Export
// @namespace    https://tampermonkey.net/
// @version      2.8
// @description  Export Google AI chats to Markdown (Turndown + GFM)
// @match        https://www.google.com/search*
// @require      https://unpkg.com/turndown/dist/turndown.js
// @require      https://unpkg.com/turndown-plugin-gfm/dist/turndown-plugin-gfm.js
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const querySelector     = 'span.VndcI.veK2kb';
  const responseSelector  = 'div.mZJni';

  // ── Turndown 初始化 ────────────────────────────────────────────────────────
  const td = new TurndownService({
    headingStyle:   'atx',       // # ## ###
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',    // ```
    fence:          '```',
    hr:             '---',
    strongDelimiter: '**',
    emDelimiter:    '*',
  });

  // GFM plugin：table、strikethrough、task list
  td.use(turndownPluginGfm.gfm);

  // 移除不需要輸出的元素（直接在 turndown rule 裡忽略）
  td.addRule('removeNoise', {
    filter: (node) =>
      (node.nodeName === 'SPAN' &&
       node.classList.contains('uJ19be') &&
       node.classList.contains('notranslate')) ||
      (node.nodeName === 'DIV' &&
       node.dataset.xid === 'Gd7Hsc'),
    replacement: () => '',
  });

  // ── 清理 UI 垃圾文字 ──────────────────────────────────────────────────────
  const UI_NOISE = [
    /Good response[\s\S]*?legal removal request[\s\S]*$/i,
    /Bad response[\s\S]*?Submit[\s\S]*?Google may use account[\s\S]*$/i,
    /A copy of this chat will be included[\s\S]*?legal removal request[\s\S]*$/i,
    /Saved time|Clear|Helpful|Comprehensive|Other|Incorrect|Inappropriate|Not working|Unhelpful|Submit|Thanks for letting us know/g,
  ];

  const extractResponseText = (responseEl) => {
    const clone = responseEl.cloneNode(true);

    // 先移除已知 noise 元素，避免 Turndown 處理到
    clone.querySelectorAll('span.uJ19be.notranslate').forEach(n => n.remove());
    clone.querySelectorAll('div[data-xid="Gd7Hsc"]').forEach(n => n.remove());

    let text = td.turndown(clone);

    UI_NOISE.forEach(pattern => { text = text.replace(pattern, ''); });

    return text.replace(/\n{3,}/g, '\n\n').trim();
  };

  // ── 檔名 ──────────────────────────────────────────────────────────────────
  const getFilename = () => {
    let title = document.title || '';
    title = title.replace(/ - Google.*$/, '').trim();

    if (!title || title.length < 5 || title.length > 70 || title.includes('Google AI')) {
      const firstQuery = document.querySelector(querySelector);
      if (firstQuery) title = firstQuery.innerText.trim().slice(0, 65);
    }

    return (title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'google_ai_chat') + '.md';
  };

  // ── 匯出 ──────────────────────────────────────────────────────────────────
  const exportMarkdown = () => {
    const nodes = [...document.querySelectorAll(`${querySelector}, ${responseSelector}`)];

    if (!nodes.length) {
      alert('未找到對話');
      return;
    }

    const chats = [];
    let currentChat = null;

    for (const node of nodes) {
      if (node.matches(querySelector)) {
        const text = node.innerText.trim();
        if (!text) continue;
        currentChat = { id: chats.length + 1, query: text, responses: [] };
        chats.push(currentChat);
      } else if (node.matches(responseSelector)) {
        if (!currentChat) continue;
        const text = extractResponseText(node);
        if (!text) continue;
        currentChat.responses.push(text);
      }
    }

    const md = chats.map(c => {
      const response = c.responses.length
        ? c.responses.join('\n\n---\n\n')
        : '(無回應內容)';
      return `# Chat ${c.id}\n\n## Question\n${c.query}\n\n## Answer\n${response}\n`;
    }).join('\n\n---\n\n');

    const blob = new Blob([md], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: getFilename() }).click();
    URL.revokeObjectURL(url);
  };

  // ── 按鈕 ──────────────────────────────────────────────────────────────────
  const addButton = () => {
    if (document.getElementById('ai-export-md-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'ai-export-md-btn';
    btn.textContent = '⬇ Export AI Chat (MD)';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;padding:12px 16px;background:#1a73e8;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    btn.onclick = exportMarkdown;
    document.body.appendChild(btn);
  };

  window.addEventListener('load', addButton);
})();
