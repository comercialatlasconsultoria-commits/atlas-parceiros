/* FV · camada de comentários do protótipo
   Comentários fixados na tela, sem login: o revisor informa só o nome.
   Gravação: Google Apps Script (planilha). Endereço em window.FV_COMENTARIOS_URL (assets/fv-config.js). */
(function () {
  'use strict';
  var API = window.FV_COMENTARIOS_URL || '';
  var PROJETO = 'fv-prototipo';
  var inFrame = window.parent !== window;
  var PAGE = (document.body.getAttribute('data-pagina') || location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');
  var TITULO = document.body.getAttribute('data-titulo') || document.title;
  var comentarios = [];
  var modo = false;
  var pins = [];

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function quando(iso) { try { var d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }

  /* ---------- estilos ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '.fvc-bar{position:fixed;left:16px;bottom:16px;height:52px;max-width:calc(100vw - 32px);box-sizing:border-box;z-index:2147483000;display:flex;align-items:center;gap:10px;padding:0 8px 0 18px;border-radius:999px;background:#14212b;color:#f2f4f6;font:500 14px/1.2 Sora,system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35)}',
    '.fvc-bar b{font-weight:700}',
    '.fvc-bar select{height:34px;border-radius:8px;border:1px solid #3a4c5a;background:#1d2d39;color:#f2f4f6;font:inherit;padding:0 8px;max-width:280px}',
    '.fvc-sp{width:2px}',
    '.fvc-btn{height:36px;padding:0 14px;border-radius:999px;border:1px solid #3a4c5a;background:#1d2d39;color:#f2f4f6;font:inherit;cursor:pointer;white-space:nowrap}',
    '.fvc-btn.on{background:#74b3d9;border-color:#74b3d9;color:#0d1a22;font-weight:700}',
    
    'body.fvc-modo, body.fvc-modo *{cursor:crosshair !important}',
    '.fvc-hint{position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:2147483001;background:#14212b;color:#fff;font:500 14px Sora,system-ui,sans-serif;padding:10px 16px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.3);pointer-events:none}',
    '.fvc-pin{position:fixed;z-index:2147482999;width:28px;height:28px;margin:-28px 0 0 0;border-radius:14px 14px 14px 2px;background:#e8590c;color:#fff;font:700 12px/28px Sora,system-ui,sans-serif;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:pointer;border:2px solid #fff}',
    '.fvc-pin.novo{background:#74b3d9;color:#0d1a22}',
    '.fvc-pop{position:fixed;z-index:2147483002;width:300px;max-width:calc(100vw - 24px);background:#fff;color:#243b49;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.28);font:400 14px/1.45 Sora,system-ui,sans-serif;padding:14px}',
    '.fvc-pop textarea,.fvc-pop input{width:100%;box-sizing:border-box;border:1.5px solid #c7b9b0;border-radius:8px;padding:8px 10px;font:inherit;color:#243b49;margin:6px 0}',
    '.fvc-pop textarea{min-height:90px;resize:vertical}',
    '.fvc-pop .fvc-row{display:flex;gap:8px;justify-content:flex-end;margin-top:6px}',
    '.fvc-pop .fvc-ok{background:#243b49;color:#fff;border:0;border-radius:8px;height:36px;padding:0 14px;font:600 14px Sora,system-ui,sans-serif;cursor:pointer}',
    '.fvc-pop .fvc-cancel{background:transparent;color:#243b49;border:1px solid #c7b9b0;border-radius:8px;height:36px;padding:0 12px;font:inherit;cursor:pointer}',
    '.fvc-pop small{color:#6b7c88}',
    '.fvc-panel{position:fixed;right:0;top:0;bottom:0;width:340px;max-width:100vw;z-index:2147483000;background:#fff;color:#243b49;box-shadow:-8px 0 30px rgba(0,0,0,.18);font:400 14px/1.45 Sora,system-ui,sans-serif;overflow:auto;padding:16px;box-sizing:border-box}',
    '.fvc-panel h3{margin:0 0 4px;font-size:16px}',
    '.fvc-item{border-top:1px solid #eee;padding:12px 0;cursor:pointer}',
    '.fvc-item .n{display:inline-block;min-width:22px;height:22px;border-radius:11px;background:#e8590c;color:#fff;font-weight:700;font-size:12px;text-align:center;line-height:22px;margin-right:6px}',
    '.fvc-item small{color:#6b7c88}',
    '.fvc-empty{color:#6b7c88;padding:12px 0}',
    '@media (max-width:700px){.fvc-bar .fvc-title{display:none}.fvc-bar select{max-width:150px}}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---------- âncora: caminho do elemento + posição relativa ---------- */
  function caminho(el) {
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      if (el.id === 'fv-root') { parts.unshift('#fv-root'); break; }
      var tag = el.tagName.toLowerCase(), i = 1, s = el;
      while ((s = s.previousElementSibling)) if (s.tagName === el.tagName) i++;
      parts.unshift(tag + ':nth-of-type(' + i + ')');
      el = el.parentElement;
    }
    return parts.join(' > ');
  }
  function posicao(c) {
    var el = null;
    try { el = c.ancora ? document.querySelector(c.ancora) : null; } catch (e) { el = null; }
    if (el) {
      var r = el.getBoundingClientRect();
      if (r.width || r.height) return { x: r.left + r.width * (+c.rx || 0), y: r.top + r.height * (+c.ry || 0) };
    }
    var w = document.documentElement.scrollWidth;
    return { x: (+c.px || 0) * w - window.scrollX, y: (+c.py || 0) - window.scrollY };
  }

  /* ---------- pins ---------- */
  function desenharPins() {
    pins.forEach(function (p) { p.remove(); });
    pins = [];
    var meus = comentarios.filter(function (c) { return c.pagina === PAGE; });
    meus.forEach(function (c, i) {
      var b = document.createElement('div');
      b.className = 'fvc-pin';
      b.textContent = String(i + 1);
      b.title = (c.nome || '') + ': ' + (c.texto || '');
      b.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); verComentario(c, i + 1); });
      b.__c = c;
      document.body.appendChild(b);
      pins.push(b);
    });
    posicionar();
  }
  function posicionar() {
    pins.forEach(function (b) {
      var p = posicao(b.__c);
      var vis = p.x > -10 && p.y > -10 && p.x < window.innerWidth + 10 && p.y < window.innerHeight + 30;
      b.style.display = vis ? 'block' : 'none';
      b.style.left = p.x + 'px';
      b.style.top = p.y + 'px';
    });
  }
  var raf = 0;
  function agendar() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; posicionar(); }); }
  window.addEventListener('scroll', agendar, true);
  window.addEventListener('resize', agendar);
  setInterval(posicionar, 800);

  /* ---------- popups ---------- */
  var pop = null;
  function fecharPop() { if (pop) { pop.remove(); pop = null; } }
  function abrirPop(x, y, html) {
    fecharPop();
    pop = document.createElement('div');
    pop.className = 'fvc-pop';
    pop.innerHTML = html;
    document.body.appendChild(pop);
    var w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(12, Math.min(x + 12, window.innerWidth - w - 12)) + 'px';
    pop.style.top = Math.max(12, Math.min(y + 12, window.innerHeight - h - 12)) + 'px';
    pop.addEventListener('click', function (e) { e.stopPropagation(); });
    return pop;
  }
  function verComentario(c, n) {
    var p = posicao(c);
    abrirPop(p.x, p.y, '<b>' + n + ' · ' + esc(c.nome) + '</b><br><small>' + esc(quando(c.data)) + '</small><p style="margin:8px 0 0;white-space:pre-wrap">' + esc(c.texto) + '</p><div class="fvc-row"><button class="fvc-cancel">Fechar</button></div>');
    pop.querySelector('.fvc-cancel').onclick = fecharPop;
  }
  function novoComentario(e) {
    var alvo = e.target;
    var r = alvo.getBoundingClientRect();
    var c = {
      projeto: PROJETO, pagina: PAGE, titulo: TITULO,
      ancora: caminho(alvo),
      rx: r.width ? ((e.clientX - r.left) / r.width).toFixed(4) : 0,
      ry: r.height ? ((e.clientY - r.top) / r.height).toFixed(4) : 0,
      px: ((e.clientX + window.scrollX) / document.documentElement.scrollWidth).toFixed(4),
      py: Math.round(e.clientY + window.scrollY)
    };
    var nome = ls('fvc-nome') || '';
    var marca = document.createElement('div');
    marca.className = 'fvc-pin novo'; marca.textContent = '+';
    marca.style.left = e.clientX + 'px'; marca.style.top = e.clientY + 'px';
    document.body.appendChild(marca);
    abrirPop(e.clientX, e.clientY,
      '<b>Novo comentário</b>' +
      '<input class="fvc-nome" placeholder="Seu nome" value="' + esc(nome) + '">' +
      '<textarea class="fvc-texto" placeholder="O que você achou deste ponto?"></textarea>' +
      '<small>Foque na estrutura e na experiência. Textos, fotos e preços são ilustrativos.</small>' +
      '<div class="fvc-row"><button class="fvc-cancel">Cancelar</button><button class="fvc-ok">Comentar</button></div>');
    var tx = pop.querySelector('.fvc-texto'), nm = pop.querySelector('.fvc-nome');
    (nome ? tx : nm).focus();
    pop.querySelector('.fvc-cancel').onclick = function () { marca.remove(); fecharPop(); };
    pop.querySelector('.fvc-ok').onclick = function () {
      var texto = tx.value.trim(), n = nm.value.trim();
      if (!n) { nm.focus(); nm.style.borderColor = '#a3362e'; return; }
      if (!texto) { tx.focus(); tx.style.borderColor = '#a3362e'; return; }
      ls('fvc-nome', n);
      c.nome = n; c.texto = texto; c.data = new Date().toISOString();
      var btn = this; btn.disabled = true; btn.textContent = 'Enviando…';
      enviar(c).then(function () {
        marca.remove(); fecharPop();
        comentarios.push(c); desenharPins(); avisarTopo();
      }).catch(function () {
        btn.disabled = false; btn.textContent = 'Tentar de novo';
        alertaPop('Não foi possível enviar agora. Verifique a conexão e tente de novo.');
      });
    };
  }
  function alertaPop(msg) { if (pop) { var s = pop.querySelector('.fvc-erro') || document.createElement('p'); s.className = 'fvc-erro'; s.style.cssText = 'color:#a3362e;margin:6px 0 0'; s.textContent = msg; pop.appendChild(s); } }

  /* ---------- API ---------- */
  function carregar() {
    if (!API) return Promise.resolve();
    return fetch(API + (API.indexOf('?') < 0 ? '?' : '&') + 'acao=listar&projeto=' + PROJETO + '&t=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (d) { comentarios = (d && d.comentarios) || []; desenharPins(); avisarTopo(); })
      .catch(function () {});
  }
  function enviar(c) {
    if (!API) return Promise.reject(new Error('sem endpoint'));
    var body = JSON.stringify(Object.assign({ acao: 'criar' }, c));
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (!d || !d.ok) throw new Error('falhou'); c.id = d.id; });
  }

  /* ---------- modo comentário ---------- */
  var dica = null;
  function setModo(on) {
    modo = !!on;
    document.body.classList.toggle('fvc-modo', modo);
    if (modo && !dica) { dica = document.createElement('div'); dica.className = 'fvc-hint'; dica.textContent = API ? 'Clique em qualquer ponto da tela para comentar' : 'Comentários ainda não configurados'; document.body.appendChild(dica); }
    if (!modo && dica) { dica.remove(); dica = null; }
    if (!modo) fecharPop();
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest && (e.target.closest('.fvc-pop') || e.target.closest('.fvc-bar') || e.target.closest('.fvc-panel') || e.target.closest('.fvc-pin'))) return;
    if (!modo) { if (pop) fecharPop(); return; }
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (!API) return;
    novoComentario(e);
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (pop) fecharPop(); else if (modo) { setModo(false); avisarTopo(); } } });

  /* ---------- comunicação entre a moldura do celular e a tela dentro dela ---------- */
  function avisarTopo() { if (inFrame) window.parent.postMessage({ fvc: 'estado', pagina: PAGE, titulo: TITULO, modo: modo, comentarios: comentarios.filter(function (c) { return c.pagina === PAGE; }) }, '*'); else atualizarPainel(); }
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (inFrame && d.fvc === 'modo') { setModo(d.on); avisarTopo(); }
    if (inFrame && d.fvc === 'focar') { var c = comentarios.filter(function (x) { return x.pagina === PAGE; })[d.i]; if (c) focar(c, d.i + 1); }
    if (inFrame && d.fvc === 'recarregar') carregar();
    if (!inFrame && d.fvc === 'estado') { frameEstado = d; atualizarPainel(); }
  });
  function focar(c, n) {
    var el = null; try { el = c.ancora ? document.querySelector(c.ancora) : null; } catch (e) {}
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' }); else window.scrollTo(0, Math.max(0, (+c.py || 0) - 200));
    setTimeout(function () { posicionar(); verComentario(c, n); }, 350);
  }

  /* ---------- barra de revisão (só no documento de cima) ---------- */
  var frameEstado = null, painel = null, btnModo = null, btnLista = null;
  function telaAtual() {
    if (frameEstado) return { titulo: frameEstado.titulo, lista: frameEstado.comentarios || [], frame: true };
    return { titulo: TITULO, lista: comentarios.filter(function (c) { return c.pagina === PAGE; }), frame: false };
  }
  function atualizarPainel() {
    if (inFrame || !btnLista) return;
    var t = telaAtual();
    btnLista.textContent = 'Comentários (' + t.lista.length + ')';
    var m = frameEstado ? frameEstado.modo : modo;
    btnModo.classList.toggle('on', !!m);
    btnModo.textContent = m ? 'Comentando… (Esc para sair)' : '+ Comentar';
    if (!painel) return;
    var h = '<h3>Comentários desta tela</h3><small>' + esc(t.titulo) + '</small>';
    if (!t.lista.length) h += '<div class="fvc-empty">Nenhum comentário ainda. Clique em “+ Comentar” e depois no ponto da tela.</div>';
    t.lista.forEach(function (c, i) { h += '<div class="fvc-item" data-i="' + i + '"><span class="n">' + (i + 1) + '</span><b>' + esc(c.nome) + '</b> <small>' + esc(quando(c.data)) + '</small><div style="white-space:pre-wrap;margin-top:4px">' + esc(c.texto) + '</div></div>'; });
    painel.innerHTML = h;
    Array.prototype.forEach.call(painel.querySelectorAll('.fvc-item'), function (it) {
      it.onclick = function () {
        var i = +it.getAttribute('data-i');
        if (t.frame) { var f = document.getElementById('fv-phone'); f && f.contentWindow.postMessage({ fvc: 'focar', i: i }, '*'); }
        else focar(t.lista[i], i + 1);
      };
    });
  }
  function montarBarra() {
    var telas = window.FV_TELAS || [];
    var bar = document.createElement('div');
    bar.className = 'fvc-bar';
    var opts = telas.map(function (t) { return '<option value="' + esc(t.arquivo) + '"' + (t.pagina === PAGE ? ' selected' : '') + '>' + esc(t.nome) + '</option>'; }).join('');
    bar.innerHTML = '<span class="fvc-title"><b>FV Enxovais</b> · Protótipo do site para revisão</span>' +
      '<select aria-label="Tela">' + opts + '</select><span class="fvc-sp"></span>' +
      '<button class="fvc-btn fvc-lista">Comentários (0)</button><button class="fvc-btn fvc-modo">+ Comentar</button>';
    document.body.appendChild(bar);
    bar.querySelector('select').onchange = function () { location.href = this.value; };
    btnModo = bar.querySelector('.fvc-modo');
    btnLista = bar.querySelector('.fvc-lista');
    btnModo.onclick = function () {
      var f = document.getElementById('fv-phone');
      if (f) { var on = !(frameEstado && frameEstado.modo); f.contentWindow.postMessage({ fvc: 'modo', on: on }, '*'); }
      else { setModo(!modo); atualizarPainel(); }
    };
    btnLista.onclick = function () {
      if (painel) { painel.remove(); painel = null; return; }
      painel = document.createElement('div'); painel.className = 'fvc-panel';
      document.body.appendChild(painel); atualizarPainel();
    };
    atualizarPainel();
  }

  if (!inFrame) montarBarra();
  if (!document.body.hasAttribute('data-moldura')) carregar(); else atualizarPainel();
  setInterval(function () { if (!document.body.hasAttribute('data-moldura')) carregar(); }, 60000);
})();
