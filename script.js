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
              <span class="blog-tag">${p.tagLabel || ''}</span>
              <span class="blog-date">${p.date || ''}</span>
            </div>
            <div class="blog-title">${p.title}</div>
            <div class="blog-excerpt">${p.excerpt || ''}</div>
          </div>
          <button class="blog-read-btn" aria-label="${p.title} を読む">
            読む
            <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function getBlogBodyHtml(post) {
  if (post.contentHtml) return post.contentHtml;
  return (post.content || []).map(line => {
    const isFootnote = /"^[¹²³⁴⁵⁶⁷⁸⁹*†‡§]"/.test(line);
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
  if (excerpt) excerpt.textContent = post.excerpt || '';
  if (body)   body.innerHTML     = getBlogBodyHtml(post);
 
  // 戻るボタンにアイコンを追加（初回のみ）
  if (closeBtn && !closeBtn.querySelector('svg')) {
    closeBtn.innerHTML =
      `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
       </svg>一覧へ戻る`;
  }
 
  if (post.title) document.title = `${post.title} — Blog — ツミキapp`;
 
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  modal.scrollTop = 0;
 
  if (updateUrl) {
    const postParam = post.id ? String(post.id) : String(index + 1);
    updateBlogQueryParam(postParam);
  }
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
    blogPosts = Array.isArray(data) ? data : (data.posts || []);
    blogLoadError = '';
  } catch (err) {
    blogPosts = [];
    blogLoadError = 'posts.json の読み込みに失敗しました。URLを確認してください。';
  }
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
      if (closer) closeBlogModal(true);
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

function renderChangelog() {
  const tl = document.getElementById('timeline');
  if (!tl) return;
  tl.innerHTML = CHANGELOG_VERSIONS.map((v, i) => `
    <div class="cl-entry${v.open ? ' open' : ''}" id="entry-${i}">
      <div class="cl-header" data-index="${i}">
        <span class="cl-version">${v.version}</span>
        <span class="cl-badge ${changelogBadgeClass(v.type)}">${changelogBadgeLabel(v.type)}</span>
        <span class="cl-date">${v.date}</span>
        <svg class="cl-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="cl-body">
        <p class="cl-summary">${v.summary}</p>
        <div class="cl-items">
          ${v.items.map(item => `
            <div class="cl-item">
              <span class="cl-tag ${changelogTagClass(item.tag)}">${changelogTagLabel(item.tag)}</span>
              <span class="cl-item-text">${item.text}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

function bindChangelogEvents() {
  const timeline = document.getElementById('timeline');
  if (!timeline) return;
  timeline.addEventListener('click', (e) => {
    const header = e.target.closest('.cl-header');
    if (!header) return;
    const index = header.getAttribute('data-index');
    const entry = document.getElementById(`entry-${index}`);
    if (entry) entry.classList.toggle('open');
  });
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
  fetch('changelog.json')
    .then(r => r.json())
    .then(data => {
      CHANGELOG_VERSIONS = data;
      renderChangelog();
    })
    .catch(() => renderChangelog());
});

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
  {cat:'音楽', q:'<a href="https://youtube.com" class="text-link">YouTube</a>の音楽は追加できる?', a:'各サービスの利用規約への対応のため、追加する予定はありません。ローカルに保存された音楽ファイルのみ追加できます。'},
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
