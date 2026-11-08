const THEME_KEY = 'tsumiki_theme';
const DEFAULT_DOC_TITLE = document.title;

let blogPosts = [];
let blogCurrentTag = 'all';
let blogLoadError = '';
let helpCurrentCat = 'すべて';

function applyTheme(isDark) {
  document.body.classList.toggle('dark', isDark);
  document.body.classList.toggle('light', !isDark);
  const moonIcon = document.getElementById('moonIcon');
  const sunIcon = document.getElementById('sunIcon');
  if (moonIcon) moonIcon.style.display = isDark ? 'none' : '';
  if (sunIcon) sunIcon.style.display = isDark ? '' : 'none';
  const heroLogo = document.getElementById('heroLogo');
  if (heroLogo) {
    heroLogo.src = isDark
      ? 'https://tsumiki.app/tsumiki_logo_akarui.svg'
      : 'https://tsumiki.app/tsumiki_logo.svg';
  }
  const siteLogo = document.getElementById('siteLogo');
  if (siteLogo) {
    siteLogo.src = isDark
      ? 'https://tsumiki.app/tsumiki_logo_akarui.svg'
      : 'https://tsumiki.app/tsumiki_logo.svg';
  }
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark') {
    applyTheme(true);
  } else if (saved === 'light') {
    applyTheme(false);
  } else {
    applyTheme(false);
  }
}

function toggleTheme() {
  const isDark = !document.body.classList.contains('dark');
  applyTheme(isDark);
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
}

// タグの名前(posts.json で tagLabel を省略したときに使う)
const BLOG_TAG_LABELS = { update: 'アップデート', tips: '使い方', dev: '開発日誌' };
const BLOG_NEW_DAYS = 14;

function parseBlogDate(str) {
  const m = /^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/.exec(String(str || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

function isBlogPostNew(post) {
  const d = parseBlogDate(post.date);
  if (!d) return false;
  const age = Date.now() - d.getTime();
  return age >= 0 && age < BLOG_NEW_DAYS * 86400000;
}

function stripTags(html) {
  return String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// posts.json の1記事を、表示に使う形にそろえる(省略できる項目をここで埋める)
function normalizeBlogPost(p) {
  const post = Object.assign({}, p);
  post.tagLabel = post.tagLabel || BLOG_TAG_LABELS[post.tag] || 'お知らせ';
  if (!post.excerpt) {
    // 本文の最初の段落から作る(記事の中では本文と重なるので出さない)
    const html = getBlogBodyHtml(post);
    const firstP = /<p[^>]*>([\s\S]*?)<\/p>/.exec(html);
    const text = stripTags(firstP ? firstP[1] : html);
    post.autoExcerpt = true;
    post.excerpt = text.length > 80 ? text.slice(0, 80) + '…' : text;
  }
  return post;
}

function renderBlogPosts(tag) {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;
  if (blogLoadError) {
    grid.innerHTML = `<div class="empty-state">${blogLoadError}</div>`;
    return;
  }
  const filtered = tag === 'all' ? blogPosts : blogPosts.filter(p => p.tag === tag);
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state">記事がまだありません。<br>近日公開予定です。</div>';
    return;
  }
  grid.innerHTML = filtered.map((p, i) => {
    const postIndex = blogPosts.indexOf(p);
    return `
      <div class="blog-entry" id="post-${i}">
        <div class="blog-header" data-post-index="${postIndex}">
          <div class="blog-head-main">
            <div class="blog-meta">
              ${isBlogPostNew(p) ? '<span class="blog-new">NEW</span>' : ''}
              <span class="blog-tag">${p.tagLabel}</span>
              <span class="blog-date">${p.date || ''}</span>
            </div>
            <div class="blog-title">${p.title}</div>
            <div class="blog-excerpt">${p.excerpt || ''}</div>
          </div>
          <button class="blog-read-btn" aria-label="${stripTags(p.title)} を読む">
            読む
            <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// 記事のないタグは隠し、あるタグには件数を出す
function updateBlogTagFilter() {
  const tagFilter = document.getElementById('tagFilter');
  if (!tagFilter) return;
  tagFilter.querySelectorAll('.nav-pill[data-tag]').forEach(btn => {
    const tag = btn.getAttribute('data-tag');
    const n = tag === 'all' ? blogPosts.length : blogPosts.filter(p => p.tag === tag).length;
    if (tag !== 'all') btn.hidden = n === 0;
    let count = btn.querySelector('.tag-count');
    if (!count) {
      count = document.createElement('span');
      count.className = 'tag-count';
      btn.appendChild(count);
    }
    count.textContent = n;
  });
}

// 本文の行の中: **太字** / [文字](URL) / `コード`
function blogInline(text) {
  return String(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
      const external = /^https?:\/\//.test(url) && !/^https?:\/\/(about\.)?tsumiki\.app/.test(url);
      return `<a href="${url}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
    });
}

// "body" を HTML にする。空行で段落を分ける
//   ## 見出し / ### 小見出し / - 箇条書き / 1. 番号 / > 引用 / ![説明](画像のURL)
function blogMarkdownToHtml(src) {
  const blocks = String(src || '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  return blocks.map(block => {
    const lines = block.split('\n').filter(l => l.trim() !== '');
    if (!lines.length) return '';
    const first = lines[0].trim();
    if (/^###\s+/.test(first)) return `<h4>${blogInline(first.replace(/^###\s+/, ''))}</h4>`;
    if (/^##\s+/.test(first)) return `<h3>${blogInline(first.replace(/^##\s+/, ''))}</h3>`;
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(first);
    if (img && lines.length === 1) {
      return `<figure><img src="${img[2]}" alt="${img[1]}" loading="lazy">${img[1] ? `<figcaption>${img[1]}</figcaption>` : ''}</figure>`;
    }
    if (lines.every(l => /^\s*[-・]\s+/.test(l))) {
      return '<ul>' + lines.map(l => `<li>${blogInline(l.replace(/^\s*[-・]\s+/, ''))}</li>`).join('') + '</ul>';
    }
    if (lines.every(l => /^\s*\d+[.)]\s+/.test(l))) {
      return '<ol>' + lines.map(l => `<li>${blogInline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('') + '</ol>';
    }
    if (lines.every(l => /^\s*>\s?/.test(l))) {
      return `<blockquote>${lines.map(l => blogInline(l.replace(/^\s*>\s?/, ''))).join('<br>')}</blockquote>`;
    }
    const isFootnote = /^([¹²³⁴⁵⁶⁷⁸⁹†‡§]|\*\s)/.test(first);
    return `<p${isFootnote ? ' class="footnote"' : ''}>${lines.map(blogInline).join('<br>')}</p>`;
  }).join('');
}

function getBlogBodyHtml(post) {
  if (post.contentHtml) return post.contentHtml;
  if (typeof post.body === 'string') return blogMarkdownToHtml(post.body);
  if (Array.isArray(post.body)) return blogMarkdownToHtml(post.body.join('\n'));
  return (post.content || []).map(line => {
    const isFootnote = /^([¹²³⁴⁵⁶⁷⁸⁹†‡§]|\*\s)/.test(line);
    return `<p${isFootnote ? ' class="footnote"' : ''}>${line}</p>`;
  }).join('');
}

function resolveBlogPostByParam(param) {
  const normalized = (param || '').trim();
  if (!normalized) return null;
  const byId = blogPosts.find(p => {
    if (!p.id) return false;
    const idStr = String(p.id);
    return idStr === normalized || idStr.replace(/^0+/, '') === normalized;
  });
  if (byId) return { post: byId, index: blogPosts.indexOf(byId) };
  if (/^\d+$/.test(normalized)) {
    const index = Number(normalized) - 1;
    if (index >= 0 && index < blogPosts.length) {
      return { post: blogPosts[index], index };
    }
  }
  return null;
}

function updateBlogQueryParam(value) {
  const url = new URL(location.href);
  if (value) {
    url.searchParams.set('post', value);
  } else {
    url.searchParams.delete('post');
  }
  history.replaceState(null, '', url.toString());
}

const _origOpenBlogModal = typeof openBlogModal === 'function' ? openBlogModal : null;
function openBlogModal(post, index, updateUrl) {
  const modal = document.getElementById('blogModal');
  if (!modal) return;
 
  const tag    = document.getElementById('blogModalTag');
  const date   = document.getElementById('blogModalDate');
  const title  = document.getElementById('blogModalTitle');
  const excerpt = document.getElementById('blogModalExcerpt');
  const body   = document.getElementById('blogModalBody');
  const closeBtn = modal.querySelector('.blog-modal-close');
 
  if (tag)    tag.textContent    = post.tagLabel || '';
  if (date)   date.textContent   = post.date || '';
  if (title)  title.textContent  = post.title || '';
  if (excerpt) {
    excerpt.textContent = post.autoExcerpt ? '' : (post.excerpt || '');
    excerpt.hidden = !excerpt.textContent;
  }
  if (body)   body.innerHTML     = getBlogBodyHtml(post);
 
  // 戻るボタンにアイコンを追加（初回のみ）
  if (closeBtn && !closeBtn.querySelector('svg')) {
    modal.querySelectorAll('.blog-modal-close').forEach(btn => { btn.innerHTML =
      `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
       </svg>一覧へ戻る`; });
  }
 
  renderBlogModalNav(index);
  if (post.title) document.title = `${stripTags(post.title)} — Blog — ツミキapp`;
 
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  modal.scrollTop = 0;
 
  if (updateUrl) {
    const postParam = post.id ? String(post.id) : String(index + 1);
    updateBlogQueryParam(postParam);
  }
}


// 記事の下の「前の記事 / 次の記事」(一覧と同じ、新しい順)
function renderBlogModalNav(index) {
  const nav = document.getElementById('blogModalNav');
  if (!nav) return;
  const newer = blogPosts[index - 1];
  const older = blogPosts[index + 1];
  const btn = (post, i, cls, label) => post
    ? `<button type="button" class="blog-nav-btn ${cls}" data-post-index="${i}"><span class="blog-nav-label">${label}</span><span class="blog-nav-title">${post.title}</span></button>`
    : '';
  nav.innerHTML = btn(older, index + 1, 'prev', '← 前の記事') + btn(newer, index - 1, 'next', '次の記事 →');
  nav.hidden = !newer && !older;
}

function closeBlogModal(updateUrl) {
  const modal = document.getElementById('blogModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  document.title = DEFAULT_DOC_TITLE;
  if (updateUrl) updateBlogQueryParam('');
}

function openBlogModalFromQuery() {
  const param = new URLSearchParams(location.search).get('post');
  if (!param) return;
  const result = resolveBlogPostByParam(param);
  if (result) openBlogModal(result.post, result.index, false);
}

function toggleBlogPost(i) {
  const entry = document.getElementById(`post-${i}`);
  if (entry) entry.classList.toggle('open');
}

function filterBlogTag(tag, btn) {
  blogCurrentTag = tag;
  document.querySelectorAll('#tagFilter .nav-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBlogPosts(tag);
}

async function initBlog() {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="empty-state">読み込み中...</div>';
  try {
    const postsUrl = new URL('posts.json', location.href).toString();
    const res = await fetch(postsUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // 日付の新しい順に並べ、省略された項目を埋める
    blogPosts = (Array.isArray(data) ? data : (data.posts || []))
      .filter(p => p && p.title && !p.draft)
      .map(normalizeBlogPost)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    blogLoadError = '';
  } catch (err) {
    blogPosts = [];
    blogLoadError = 'posts.json の読み込みに失敗しました。URLを確認してください。';
  }
  updateBlogTagFilter();
  renderBlogPosts(blogCurrentTag);
  openBlogModalFromQuery();
}

function bindBlogEvents() {
  const tagFilter = document.getElementById('tagFilter');
  if (tagFilter) {
    tagFilter.addEventListener('click', (e) => {
      const btn = e.target.closest('.nav-pill[data-tag]');
      if (!btn) return;
      filterBlogTag(btn.getAttribute('data-tag'), btn);
    });
  }

  const grid = document.getElementById('blogGrid');
  if (grid) {
    grid.addEventListener('click', (e) => {
      const header = e.target.closest('.blog-header');
      if (!header) return;
      const postIndex = Number(header.getAttribute('data-post-index'));
      if (!Number.isNaN(postIndex) && blogPosts[postIndex]) {
        openBlogModal(blogPosts[postIndex], postIndex, true);
      }
    });
  }

  const modal = document.getElementById('blogModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      const closer = e.target.closest('[data-modal-close="true"]');
      if (closer) { closeBlogModal(true); return; }
      const navBtn = e.target.closest('.blog-nav-btn');
      if (navBtn) {
        const i = Number(navBtn.getAttribute('data-post-index'));
        if (blogPosts[i]) openBlogModal(blogPosts[i], i, true);
        return;
      }
      const copyBtn = e.target.closest('#blogCopyLink');
      if (copyBtn && navigator.clipboard) {
        navigator.clipboard.writeText(location.href).then(() => {
          const label = copyBtn.querySelector('span');
          if (!label) return;
          label.textContent = 'コピーしました';
          clearTimeout(copyBtn._t);
          copyBtn._t = setTimeout(() => { label.textContent = 'リンクをコピー'; }, 1800);
        });
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeBlogModal(true);
    });
  }
}

let CHANGELOG_VERSIONS = [];

function changelogBadgeClass(type) {
  return type === 'major' ? 'badge-major' : type === 'minor' ? 'badge-minor' : 'badge-patch';
}
function changelogBadgeLabel(type) {
  return type === 'major' ? 'Major' : type === 'minor' ? 'Minor' : 'Patch';
}
function changelogTagClass(tag) {
  return 'tag-' + tag;
}
function changelogTagLabel(tag) {
  return { add:'追加', fix:'修正', change:'変更', remove:'削除' }[tag] || tag;
}

// v1.21.0A のように末尾に英字が付いた版は、元の版(v1.21.0)と1枚のカードにまとめる
function changelogBaseVersion(version) {
  const m = /^(v\d+(?:\.\d+)+)[A-Z]+$/.exec(version);
  return m ? m[1] : version;
}

function changelogGroups() {
  const groups = [];
  const byBase = {};
  CHANGELOG_VERSIONS.forEach(v => {
    const base = changelogBaseVersion(v.version);
    if (!byBase[base]) {
      byBase[base] = { base, versions: [] };
      groups.push(byBase[base]);
    }
    byBase[base].versions.push(v);
  });
  // カードの中は古い順(元の版 → A → B …)に並べる
  groups.forEach(g => g.versions.reverse());
  return groups;
}

function changelogItemsHtml(v) {
  return `
    <p class="cl-summary">${v.summary}</p>
    <div class="cl-items">
      ${v.items.map(item => `
        <div class="cl-item">
          <span class="cl-tag ${changelogTagClass(item.tag)}">${changelogTagLabel(item.tag)}</span>
          <span class="cl-item-text">${item.text}</span>
        </div>
      `).join('')}
    </div>`;
}

function renderChangelog() {
  const tl = document.getElementById('timeline');
  if (!tl) return;
  tl.innerHTML = changelogGroups().map((g, i) => {
    const list = g.versions;
    const latest = list[list.length - 1];
    const main = list.find(v => v.version === g.base) || list[0];
    const open = list.some(v => v.open);
    if (list.length === 1) {
      return `
    <div class="cl-entry${open ? ' open' : ''}" id="entry-${i}">
      <div class="cl-header" data-index="${i}">
        <span class="cl-version">${main.version}</span>
        <span class="cl-badge ${changelogBadgeClass(main.type)}">${changelogBadgeLabel(main.type)}</span>
        <span class="cl-date">${main.date}</span>
        <svg class="cl-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="cl-body">${changelogItemsHtml(main)}
      </div>
    </div>`;
    }
    const subLabel = v => v.version === g.base ? g.base.replace(/^v/, '') : v.version.slice(g.base.length);
    const last = list.length - 1;
    return `
    <div class="cl-entry cl-group${open ? ' open' : ''}" id="entry-${i}">
      <div class="cl-header" data-index="${i}">
        <span class="cl-version">${g.base}<span class="cl-version-sub">〜${subLabel(latest)}</span></span>
        <span class="cl-badge ${changelogBadgeClass(main.type)}">${changelogBadgeLabel(main.type)}</span>
        <span class="cl-date">${latest.date}</span>
        <svg class="cl-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="cl-body">
        <div class="cl-subtabs" role="tablist">
          ${list.map((v, j) => `<button type="button" class="cl-subtab${j === last ? ' active' : ''}" role="tab" aria-selected="${j === last}" data-index="${i}" data-sub="${j}">${subLabel(v)}</button>`).join('')}
        </div>
        ${list.map((v, j) => `
        <div class="cl-subpanel" data-sub="${j}"${j === last ? '' : ' hidden'}>
          <div class="cl-subhead"><span>${v.version}</span><span class="cl-subhead-date">${v.date}</span></div>
          ${changelogItemsHtml(v)}
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function bindChangelogEvents() {
  const timeline = document.getElementById('timeline');
  if (!timeline) return;
  timeline.addEventListener('click', (e) => {
    const tab = e.target.closest('.cl-subtab');
    if (tab) {
      const entry = document.getElementById(`entry-${tab.getAttribute('data-index')}`);
      if (!entry) return;
      const sub = tab.getAttribute('data-sub');
      entry.querySelectorAll('.cl-subtab').forEach(t => {
        const on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on);
      });
      entry.querySelectorAll('.cl-subpanel').forEach(p => { p.hidden = p.getAttribute('data-sub') !== sub; });
      return;
    }
    const header = e.target.closest('.cl-header');
    if (!header) return;
    const index = header.getAttribute('data-index');
    const entry = document.getElementById(`entry-${index}`);
    if (entry) toggleChangelogEntry(entry);
  });
}

// カードの中身を、高さを伸び縮みさせて開け閉めする
function toggleChangelogEntry(entry) {
  const body = entry.querySelector('.cl-body');
  const opening = !entry.classList.contains('open');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!body || typeof body.animate !== 'function' || reduce) {
    entry.classList.toggle('open', opening);
    return;
  }
  // 途中で押し直しても、今見えている高さから続ける
  const cs = getComputedStyle(body);
  const from = { height: cs.display === 'none' ? '0px' : body.getBoundingClientRect().height + 'px', paddingBottom: cs.display === 'none' ? '0px' : cs.paddingBottom, opacity: cs.display === 'none' ? 0 : cs.opacity };
  if (body._anim) body._anim.cancel();
  entry.classList.toggle('open', opening);
  entry.classList.toggle('closing', !opening);
  const full = getComputedStyle(body).paddingBottom;
  const to = opening
    ? { height: body.getBoundingClientRect().height + 'px', paddingBottom: full, opacity: 1 }
    : { height: '0px', paddingBottom: '0px', opacity: 0 };
  body.style.overflow = 'hidden';
  const anim = body.animate([from, to], { duration: 280, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  body._anim = anim;
  anim.onfinish = () => {
    if (body._anim !== anim) return;
    body._anim = null;
    entry.classList.remove('closing');
    body.style.overflow = '';
  };
}

function bindThemeButton() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;
  toggle.addEventListener('click', toggleTheme);
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  bindThemeButton();
  bindBlogEvents();
  bindChangelogEvents();
  initBlog();
  initHelp();
  var scriptTag = document.querySelector('script[src*="script.js"]');
  var changelogUrl = scriptTag
    ? scriptTag.src.replace(/\/script\.js(\?.*)?$/, '/changelog.json')
    : '/changelog.json';
  fetch(changelogUrl)
    .then(r => r.json())
    .then(data => {
      CHANGELOG_VERSIONS = data;
      renderChangelog();
      renderHomeNewsUpdate();
    })
    .catch(() => renderChangelog());
  initHomeNewsBlog(scriptTag ? scriptTag.src.replace(/\/script\.js(\?.*)?$/, '/blog/posts.json') : '/blog/posts.json');
});

// ── トップの「お知らせ」: 最新のアップデートとブログを自動で出す ──
function setHomeNews(el, title, date, href) {
  if (!el) return;
  const t = el.querySelector('.news-title');
  if (t) t.innerHTML = title;
  if (date) {
    let d = el.querySelector('.news-date');
    if (!d) {
      d = document.createElement('span');
      d.className = 'news-date';
      el.insertBefore(d, el.querySelector('.news-arrow'));
    }
    d.textContent = date;
  }
  if (href) el.href = href;
}

function renderHomeNewsUpdate() {
  const el = document.getElementById('homeNewsUpdate');
  const v = CHANGELOG_VERSIONS[0];
  if (!el || !v) return;
  setHomeNews(el, `${v.version} — ${String(v.summary || '').replace(/^概要[:：]\s*/, '')}`, v.date);
}

async function initHomeNewsBlog(url) {
  const el = document.getElementById('homeNewsBlog');
  if (!el) return;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    const post = (Array.isArray(data) ? data : (data.posts || []))
      .filter(p => p && p.title && !p.draft)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
    if (!post) return;
    const param = post.id ? String(post.id) : '';
    setHomeNews(el, post.title, post.date, param ? `https://about.tsumiki.app/blog/?post=${encodeURIComponent(param)}` : null);
  } catch (e) { /* 読み込めなければ「ブログを見る」のまま */ }
}

const HELP_QA = [
  {cat:'タイマー', q:'大前提、どうやって使うの?', a:'まず最初にアクセスしたときに大きい00:00:00と色々なnavや入力欄、フォーカスモードのON/OFF、一時停止、テーマカラー色のタイマースタートボタンが目立つでしょう。タイマースタートボタンを押しスタートすると中央で目立っている00:00:00がストップウォッチとして動き始めます。タイマースタートボタンの上にある一時停止ボタンから一時停止したり、テキスト入力欄でグループ名を記入して後の教科のメモにしたりできます。フォーカスモードをONにすると、集中時間と休憩時間を自動で切り替えることができます。テーマカラーは設定から変えられます。'},
  {cat:'タイマー', q:'大前提、どうやって使うの? Part2', a:'統計ボタンを開くと総勉強時間、連続日数、総セッション数、グループごとの総勉強時間などが見れます。名前の通りですね!!!!!!リストを開くと今までの記録がずらっと見れます。グループ名で絞り込んだり、記録を削除したりもできます。グループ名ミスったぁ...バナナにしちまったぁ☆....ってときもご安心ください。記録カードを選択して移動からグループを移動させることができます(記録時間の変更有無にグループを変更できますね)。ほかにもリストでは絞り込み以外にも並び替えなどまあまああります。'},
  {cat:'タイマー', q:'タイマーを閉じてしまっても大丈夫?', a:'大丈夫です。開始時刻をブラウザに保存しているため、再度開くと経過時間が自動で復元されます。'},
  {cat:'タイマー', q:'フォーカスモードって何?', a:'ポモドーロテクニックをベースにした機能です。集中時間が終わると自動で休憩に切り替わり、<span class="text-link tuuti">通知音</span>でお知らせします。設定画面で時間を変更できます。'},
  {cat:'タイマー', q:'グループ名を入れるとどうなる?', a:'統計画面やリスト画面でグループ別に記録を絞り込んだり集計できます。入力しなくても記録は保存されます。'},
  {cat:'データ', q:'データはどこに保存される?', a:'ブラウザのローカルストレージに保存されます。サーバーへの送信は一切ありません。ブラウザのデータ消去で消えるため、定期的なエクスポートをおすすめします。'},
  {cat:'データ', q:'別のデバイスにデータを移したい', a:'設定の「エクスポート」でJSONファイルを保存し、移行先で「インポート」を選んで読み込むとデータを引き継げます。'},
  {cat:'データ', q:'誤って履歴を削除してしまった', a:'削除した履歴を元に戻す機能はありません。定期的にエクスポートしてバックアップを取っておくことをおすすめします。'},
  {cat:'データ', q:'あとからグループ名を変更したい', a:'設定の下らへんにグループの管理があります。グループ名を一括で変えたり、削除したりできます。グループを削除しても記録自体は消えず、グループなしの状態になります。'},
  {cat:'音楽', q:'音楽ってなに?', a:'その名の通り音楽を再生できるの...ですが。ローカルに保存されたファイルしか流せません。ゆーちゅーぶのこれをこのツールで聞きたいなあ...なんてできません。フリー素材のものぶち込むかサウンドトラック買ってください。'},
  {cat:'音楽', q:'<a href="https://youtube.com" class="text-link">YouTube</a>の音楽は追加できる?', a:'なんと!!対応しました!!! デフォルトだとOFFなので設定でONにしてくださいね。'},
  {cat:'音楽', q:'音楽が再生できない/途中で止まる', a:'対応フォーマットはmp3 / wav / flac / m4a / aac / ogg / webm です。設定の「更新後にタップで音楽を自動再開」をONにすると復帰しやすくなります。私の経験ではどこかの誰かさんがCDからPCに取り込んだものをmp4にしている人を見たことがあります^^ 誰でしょうね?'},
  {cat:'音楽', q:'更新したら曲がなくなった', a:'IndexedDBに自動保存されますが、ブラウザのデータ消去やプライベートモードでは消えます。一部のブラウザ設定によっても保存できない場合があります。'},
  {cat:'ToDo', q:'ToDoってなに?', a:'簡単に言うとやることリストです。チェックマークを付けて完了したなどを手軽にできるリストですね。勉強のタスク管理に使ったり、今日やることを書いておいたり、何かのリストを作るのに使えます。'},
  {cat:'ToDo', q:'ToDoはリロードしても消えない?', a:'ローカルストレージに保存されるため、リロード後も残ります。ただしブラウザのデータ消去で消えます。'},
  {cat:'ToDo', q:'ToDo Ver.2とは?', a:'設定からON/OFF設定できる拡張機能です(標準ではONです)。段階的完了/期間設定/カレンダービューなどが追加されます。邪魔なら消せます。'},
  {cat:'ToDo', q:'毎日リセットされるタスクを作りたい', a:'タスク追加時に「繰り返し」を「毎日」に設定すると、翌日の0時以降に自動で未完了に戻ります。週/月単位も選べます。'},
  {cat:'カスタマイズ', q:'テーマカラーを変えたい', a:'設定画面の「テーマカラー」から7色を選べます。ダークモードと組み合わせると最大14パターン。'},
  {cat:'カスタマイズ', q:'フォントを変えたい', a:'設定の「フォント設定」から日本語用/英数字用を個別に設定できます。17種類以上から選択可能です。'},
  {cat:'カスタマイズ', q:'音楽やToDoを非表示にしたい', a:'設定の「表示設定」から音楽プレイヤーとToDoリストをそれぞれON/OFFできます。OFFにするとメニューから消えます。'},
  {cat:'カスタマイズ', q:'設定項目でいろいろ非表示に出来るけど...なんで?', a:'やっぱりカスタマイズ性が豊富ってかなり大事だと思います。そこから邪魔なものは非表示、でもこれは欲しいから表示...みたいなのをやっていくわくわくかんだってありますし。自分の至高の環境でする勉強以上に楽しいものはないです!!!!'},
  {cat:'その他', q:'何でツミキapp?', a:'勉強を積んでいく...「ツミキ」、じゃないですか...? まあ響きが好きだったのもありますね。ハッシュタグは「#積むツミキ」です。あと普通に「ツミキ」ではなく「ツミキapp」にしたかといいますと商標権が怖いというのと.appドメイン折角とってやったんだし使ってやろうという魂胆です。'},
  {cat:'その他', q:'ロゴを使いたい', a:'こちらです!<br><a href="https://about.tsumiki.app/brand/" class="text-link">BRAND</a><br>ライセンスはcc byです。詳しくはBRANDページをご覧ください'},
  {cat:'その他', q:'変更履歴が見たい', a:'変更履歴なら<a href="https://about.tsumiki.app/changelog" class="text-link">このサイトのCHANGELOG</a>にほぼ記載しています。'},
  {cat:'その他', q:'広告導入の予定は?', a:'広告とかは絶対にないです。このツールの所持者が私である限りないです。ですが寄付サイトだけ立ち上げてそこらへんに目立たない位置にポツンと寄付してほしいみたいなことは書くかもですね...。'},
  {cat:'その他', q:'誰が作ったの?', a:'この僕、「Super Hiko14」が作りました。誇りに思ってます...!'},
  {cat:'その他', q:'何で作ったの?', a:'何で作ったんでしょうね? 友達に頼まれたから? 自分のため? ですが僕やみんなの役に立っているので結果オーライです!!!!!!'},
  {cat:'その他', q:'何で勉強時間管理サイトであるツミキappなのにゲーム特化discordや多様なSNS、YoutubeやXなどもやっているの?', a:'...。......。<br>...勉強には...息抜きは...必須です...。'},
  {cat:'その他', q:'何で最初青い画面が出てくるの?', a:'読み込みです。サイトアクセス時に一瞬初期値の青色が表示されたのち、いろいろ読み込まれテーマカラーが適用されローディングアニメーションが流れます。'},
  {cat:'その他', q:'お問い合わせはどこに?', a:'<a href="mailto:info@tsumiki.app" class="text-link">info@tsumiki.app</a>です。分からない細かい点や、バグなどを発見した場合はここにぜひ気軽にご連絡ください。'},
  {cat:'その他', q:'にゃにゃにゃあにゃにゃにゃあ?あにゃにゃにゃにゃにゃあああ????<br>(追加予定はある?あとなんで最後毎回猫なの????)', a:'にゃああああああああああ!にゃああああああああああああああああ!!!!!<br>(あるううううううう!猫好きだからだよおおおおおおおおおおおお!!!!!'},
];

function helpHighlight(text, q) {
  if (!q) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
  return text.replace(re, '<mark>$1</mark>');
}

function renderHelp() {
  const searchBox = document.getElementById('searchBox');
  const list = document.getElementById('qaList');
  if (!searchBox || !list) return;
  const q = searchBox.value.trim().toLowerCase();
  const filtered = HELP_QA.filter(item => {
    const catOk = helpCurrentCat === 'すべて' || item.cat === helpCurrentCat;
    const qOk = !q || item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q);
    return catOk && qOk;
  });

  if (!filtered.length) {
    list.innerHTML = '<div class="empty">該当する質問が見つかりませんでした。<br>別のキーワードで試してみてください。</div>';
    return;
  }

  list.innerHTML = filtered.map(item => `
    <div class="qa-card">
      <span class="qa-cat">${item.cat}</span>
      <div class="qa-q">${helpHighlight(item.q, q)}</div>
      <hr class="qa-divider">
      <div class="qa-a">${helpHighlight(item.a, q)}</div>
    </div>
  `).join('');
}

function buildHelpTabs() {
  const tabs = document.getElementById('catTabs');
  if (!tabs) return;
  const cats = ['すべて', ...new Set(HELP_QA.map(q => q.cat))];
  tabs.innerHTML = cats.map(c =>
    `<button class="cat-tab${c==='すべて'?' active':''}" data-cat="${c}">${c}</button>`
  ).join('');
}

function bindHelpEvents() {
  const tabs = document.getElementById('catTabs');
  if (tabs) {
    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.cat-tab');
      if (!btn) return;
      helpCurrentCat = btn.getAttribute('data-cat');
      tabs.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderHelp();
    });
  }

  const searchBox = document.getElementById('searchBox');
  if (searchBox) {
    searchBox.addEventListener('input', renderHelp);
  }
}

function initHelp() {
  const list = document.getElementById('qaList');
  if (!list) return;
  buildHelpTabs();
  bindHelpEvents();
  renderHelp();
}

document.addEventListener('DOMContentLoaded', () => {
  const elements = document.querySelectorAll('.tuuti');
  if (!elements.length) return; // 通知音はヘルプページにだけある
  const audio = new Audio('tuuti.wav');

  elements.forEach(element => {
    element.addEventListener('click', () => {
      audio.currentTime = 0; 
      audio.play().catch(error => {
        console.error("音声の再生に失敗しました:", error);
      });
    });
  });
});
