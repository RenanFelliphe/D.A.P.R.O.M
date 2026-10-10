/* D.A.P.R.O.M — protótipo navegável · lógica
   Roteamento por hash (#app-lista, #web-quadro...), escala da moldura,
   checklist com validação no fim, assinaturas, pausa, sincronização simulada, alertas e exportação. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  var screens = $$('.screen[data-kind]');
  function key(s) { return s.id.slice(2); }
  var ORDER = screens.map(key);
  var GROUPS = { app: 'App Android · técnico em campo', web: 'Painel web · gestão', doc: 'Documento gerado' };
  var KIND_LABEL = { app: 'App', web: 'Painel', doc: 'PDF' };
  var devices = { app: $('#dev-app'), web: $('#dev-web'), doc: $('#dev-doc') };
  var stage = $('#stage');
  var current = null;

  /* ---------- Toast ---------- */
  var toastEl = $('#toast'), toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3200);
  }

  /* ---------- Roteiro (menu lateral do apresentador) ---------- */
  function buildRoteiro() {
    var nav = $('#roteiro'), html = '', last = '';
    screens.forEach(function (s, i) {
      var k = s.dataset.kind;
      if (k !== last) { html += '<h2>' + GROUPS[k] + '</h2>'; last = k; }
      html += '<a href="#' + key(s) + '" data-id="' + key(s) + '"><span class="n">' + (i + 1) + '</span><span>' + s.dataset.title + '</span></a>';
    });
    nav.innerHTML = html;
  }

  /* ---------- Escala das molduras ---------- */
  function fit() {
    $$('.device.on').forEach(function (d) {
      var w = +d.dataset.w, h = +d.dataset.h;
      var availW = stage.clientWidth - 40, availH = stage.clientHeight - 56;
      var s = Math.min(1.35, availW / w, availH / h);
      d.style.transform = 'translate(-50%,-50%) scale(' + s.toFixed(4) + ')';
    });
  }
  window.addEventListener('resize', fit);

  /* ---------- Mostrar tela ---------- */
  var WEB_USERS = {
    sup: ['MT', 'Marcos Tavares', 'Supervisor · Serviços Especiais'],
    ana: ['AR', 'Ana Ribeiro', 'Analista · todas as equipes'],
    luc: ['LP', 'Luciana Prado', 'Segurança do Trabalho'],
    adm: ['RA', 'Renato Alves', 'Administrador']
  };
  var WEB_PATH = { 'web-quadro': 'os', 'web-detalhe': 'os/4031187', 'web-alertas': 'alertas', 'web-importacao': 'importacoes', 'web-indicadores': 'indicadores', 'web-modelos': 'modelos-apr', 'web-usuarios': 'usuarios' };

  function show(id) {
    var el = document.getElementById('s-' + id);
    if (!el || ORDER.indexOf(id) < 0) return;
    current = id;
    screens.forEach(function (s) { s.classList.toggle('on', s === el); });
    var kind = el.dataset.kind;
    Object.keys(devices).forEach(function (k) { devices[k].classList.toggle('on', k === kind); });
    $$('.seg button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.kind === kind ? 'true' : 'false'); });
    $$('#roteiro a').forEach(function (a) {
      if (a.dataset.id === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var idx = ORDER.indexOf(id);
    $('#pstep').innerHTML = '<b>' + (idx + 1) + '/' + ORDER.length + '</b> · ' + KIND_LABEL[kind] + ' · ' + el.dataset.title;

    if (kind === 'web') {
      var u = WEB_USERS[el.dataset.user] || WEB_USERS.sup;
      $('#u-av').textContent = u[0]; $('#u-name').textContent = u[1]; $('#u-role').textContent = u[2];
      $$('.side a').forEach(function (a) {
        if (a.getAttribute('href') === '#' + el.dataset.nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      $('#web-url').textContent = 'https://painel.daprom.exemplo/' + (WEB_PATH[id] || '');
      $('#web-vp').scrollTop = 0;
    }
    $$('.scroll', el).forEach(function (sc) { sc.scrollTop = 0; });

    $('#pdf-tabs').hidden = kind !== 'doc';
    if (kind === 'doc') pdfPage(1);

    if (id === 'app-checklist') renderChecklist();
    if (id === 'app-bloqueio') applyBlock();
    if (id === 'app-aprovada') { signReset(); applyApproved(); }
    if (id === 'app-execucao') pauseReset();
    if (id === 'app-sync') renderSync();
    if (id === 'web-alertas') renderAlerts();
    fit();
  }

  function go(id) { if (location.hash !== '#' + id) location.hash = id; else show(id); }
  window.addEventListener('hashchange', function () { show(location.hash.slice(1)); });

  /* ---------- PDF em 2 páginas ---------- */
  function pdfPage(n) {
    $$('.pdf[data-p]').forEach(function (p) { p.classList.toggle('off', +p.dataset.p !== n); });
    $$('#pdf-tabs button').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.pdfp === n ? 'true' : 'false'); });
  }

  /* ---------- Checklist: responde tudo e só valida no fim ---------- */
  // evid: 'texto' = a evidência é uma justificativa (condição pessoal, direito de recusa); foto é opcional.
  var Q = [
    { t: 'Todos os participantes estão em boas condições físicas e psicológicas?', sec: 'Verificação · Equipe', tipo: 'elim', crit: 'nao', ok: 'sim', evid: 'texto', hint: 'Considere cansaço, medicação e estado emocional. Cada pessoa tem direito de recusa.' },
    { t: 'Todos usam EPI completo e em bom estado?', sec: 'Verificação · Equipe', tipo: 'elim', crit: 'nao', ok: 'sim', hint: 'Capacete, luvas, botina, óculos e colete.' },
    { t: 'A atividade será feita em dupla, com responsável definido?', sec: 'Verificação · Equipe', tipo: 'elim', crit: 'nao', ok: 'sim', hint: 'Ninguém trabalha sozinho.' },
    { t: 'Os participantes estão sem adornos (anéis, correntes, relógio)?', sec: 'Verificação · Equipe', tipo: 'elim', crit: 'nao', ok: 'sim', hint: '' },
    { t: 'Há necessidade de iluminação auxiliar?', sec: 'Verificação · Ambiente', tipo: 'alerta', crit: 'sim', ok: 'nao', demo: 'sim', hint: 'Se sim, fica registrado como alerta e não bloqueia.' },
    { t: 'A equipe sabe onde fica o atendimento médico mais próximo?', sec: 'Verificação · Emergência', tipo: 'elim', crit: 'nao', ok: 'sim', hint: '' },
    { t: 'A equipe está apta a realizar um resgate de emergência no local?', sec: 'Verificação · Emergência', tipo: 'elim', crit: 'nao', ok: 'sim', hint: 'Considere tripé, cordas e o treinamento dos participantes presentes.' },
    { t: 'Os equipamentos elétricos são adequados para atmosfera com gás?', sec: 'Verificação · Ambiente', tipo: 'elim', crit: 'nao', ok: 'sim', hint: 'Celulares e lanternas comuns podem gerar fagulha.' },
    { t: 'Existe algum impedimento para realizar a atividade?', sec: 'Verificação · Impedimentos', tipo: 'elim', crit: 'sim', ok: 'nao', hint: 'Exemplo: caixa de válvula alagada, acesso negado, risco no local.' },
    { t: 'Sinalizar e isolar a área de trabalho', sec: 'Medida preventiva', tipo: 'alerta', crit: null, ok: 'sim', hint: '' },
    { t: 'Usar detector de gás calibrado durante toda a atividade', sec: 'Medida preventiva', tipo: 'alerta', crit: null, ok: 'sim', hint: '' },
    { t: 'Extintor disponível e dentro da validade', sec: 'Medida preventiva', tipo: 'alerta', crit: null, ok: 'sim', hint: '' },
    { t: 'Veículo posicionado fora da zona de risco', sec: 'Medida preventiva', tipo: 'alerta', crit: null, ok: 'sim', hint: '' },
    { t: 'Ferramentas antifaiscantes disponíveis', sec: 'Medida preventiva', tipo: 'alerta', crit: null, ok: 'sim', hint: '' },
    { t: 'Celulares desligados ou fora da área classificada', sec: 'Medida preventiva', tipo: 'alerta', crit: null, ok: 'sim', hint: '' },
    { t: 'Condições climáticas permitem a atividade', sec: 'Medida preventiva', tipo: 'alerta', crit: null, ok: 'sim', hint: '' },
    { t: 'Plano de emergência do cliente conhecido pela equipe', sec: 'Medida preventiva', tipo: 'alerta', crit: null, ok: 'sim', hint: '' },
    { t: 'Contatos de emergência conferidos', sec: 'Medida preventiva', tipo: 'alerta', crit: null, ok: 'sim', hint: '' }
  ];
  var ck = { idx: 0, ans: [], obs: {}, foto: {}, mode: 'q', done: false };

  function ckReset() { ck = { idx: 0, ans: [], obs: {}, foto: {}, mode: 'q', done: false }; }
  function demoAns(q) { return q.demo || q.ok; }
  function ansLabel(a) { return a === 'sim' ? 'Sim' : 'Não'; }
  function isCrit(i) { var q = Q[i]; return q.tipo === 'elim' && ck.ans[i] === q.crit; }
  function isAlertAns(i) { var q = Q[i]; return q.tipo === 'alerta' && q.crit && ck.ans[i] === q.crit; }
  function answeredCount() { var n = 0; for (var i = 0; i < Q.length; i++) if (ck.ans[i] !== undefined) n++; return n; }
  function reproved() { var r = []; for (var i = 0; i < Q.length; i++) if (isCrit(i)) r.push(i); return r; }
  function needsEvidence(i) {
    if (!isCrit(i)) return false;
    if (!(ck.obs[i] || '').trim()) return true;
    return Q[i].evid !== 'texto' && !ck.foto[i];
  }
  function nextDisabled() { return ck.ans[ck.idx] === undefined || needsEvidence(ck.idx); }

  function ckAnswer(a) {
    ck.ans[ck.idx] = a;
    if (!isCrit(ck.idx)) { delete ck.obs[ck.idx]; delete ck.foto[ck.idx]; ckNext(); return; }
    renderChecklist();
  }
  function ckNext() {
    if (ck.idx < Q.length - 1) ck.idx++; else ck.mode = 'review';
    renderChecklist();
  }
  function ckFill(upTo) {
    for (var i = 0; i < upTo; i++) if (ck.ans[i] === undefined) ck.ans[i] = demoAns(Q[i]);
    ck.idx = Math.min(upTo, Q.length - 1);
    ck.mode = 'q';
  }
  function ckValidate() {
    var rep = reproved();
    ck.done = true;
    if (!rep.length) { go('app-aprovada'); return; }
    pendingBlock = {
      kind: 'apr', head: 'APR · ERP Serra', sub: 'OS 4031187 · APR 03 v4 · agora', title: 'Atividade impedida',
      desc: rep.length + (rep.length > 1 ? ' itens eliminatórios tiveram resposta bloqueante. ' : ' item eliminatório teve resposta bloqueante. ') +
        'A OS fica pendente e a execução não pode começar. Uma nova APR, de qualquer pessoa da equipe, pode liberá-la.',
      items: rep.map(function (i) {
        return { label: 'Pergunta ' + (i + 1) + ' · Eliminatório', item: Q[i].t, ans: 'Resposta: ' + ansLabel(ck.ans[i]), obs: ck.obs[i] || '', foto: !!ck.foto[i] };
      })
    };
    go('app-bloqueio');
  }

  function reviewHtml() {
    var rep = reproved(), n = answeredCount(), missing = rep.filter(needsEvidence), alerts = 0;
    for (var i = 0; i < Q.length; i++) if (isAlertAns(i)) alerts++;
    var h = '<div class="card stack g6" style="padding:14px"><h2 style="font-size:17px;font-weight:600">Revisão da APR</h2><p class="muted">' + n + ' de ' + Q.length +
      ' perguntas respondidas. Depois de validada, a APR não pode ser alterada.</p></div>';
    if (rep.length) {
      h += '<div class="notice n-blq"><svg class="i i18"><use href="#i-octagon"/></svg><div><strong>' + rep.length + (rep.length > 1 ? ' itens eliminatórios reprovados.' : ' item eliminatório reprovado.') +
        '</strong> Ao validar, a APR será bloqueada e a OS ficará pendente.</div></div><div class="answered">' +
        rep.map(function (i) {
          return '<div class="ans-row"><span class="n">' + (i + 1) + '</span><span class="t">' + Q[i].t + '<br><span class="small">' +
            (needsEvidence(i) ? 'Falta a evidência' : '“' + esc(ck.obs[i]) + '”') + '</span></span><button class="btn btn-line btn-sm" type="button" data-q="' + i + '" style="height:36px;font-size:13px">Abrir</button></div>';
        }).join('') + '</div>';
    } else {
      h += '<div class="notice n-ok"><svg class="i i18"><use href="#i-check"/></svg><div><strong>Nenhum item eliminatório reprovado.</strong> Ao validar, a APR será aprovada e a execução liberada.</div></div>';
    }
    if (alerts) h += '<div class="notice n-al"><svg class="i i18"><use href="#i-alert"/></svg><div><strong>' + alerts + ' alerta' + (alerts > 1 ? 's' : '') + ':</strong> fica registrado no PDF e no painel, mas não bloqueia.</div></div>';
    h += '<div class="nav2"><button class="btn btn-line" type="button" data-action="ck-back">Voltar</button><button class="btn btn-p" type="button" data-action="ck-validate"' + (missing.length ? ' disabled' : '') + '>Concluir e validar</button></div>';
    if (missing.length) h += '<p class="small">Falta evidência em ' + missing.length + (missing.length > 1 ? ' itens reprovados.' : ' item reprovado.') + '</p>';
    return h;
  }

  function renderChecklist() {
    var body = $('#ck-body');
    if (!body) return;
    var n = answeredCount();
    $('#ck-bar').style.width = (n / Q.length * 100).toFixed(1) + '%';
    if (ck.mode === 'review') {
      $('#ck-pos').textContent = 'Revisão · ' + n + ' de ' + Q.length;
      $('#ck-sec').textContent = 'Antes de validar';
      body.innerHTML = reviewHtml();
      body.scrollTop = 0;
      return;
    }
    var q = Q[ck.idx], a = ck.ans[ck.idx];
    $('#ck-pos').textContent = 'Pergunta ' + (ck.idx + 1) + ' de ' + Q.length;
    $('#ck-sec').textContent = q.sec;
    var tagHtml = q.tipo === 'elim'
      ? '<span class="badge" style="border:1px solid #E8A9A2;background:#FDF0EE;color:var(--blq)"><svg class="i i13"><use href="#i-octagon"/></svg>Eliminatório</span>'
      : '<span class="badge b-al"><svg class="i i13"><use href="#i-alert"/></svg>' + (q.crit ? 'Alerta · registra, não bloqueia' : 'Medida preventiva') + '</span>';
    var html = '<section class="q-card" aria-label="Pergunta atual"><div class="row between"><span class="mono" style="font-size:13px;font-weight:600;color:var(--brand)">Pergunta ' + (ck.idx + 1) + '</span>' + tagHtml + '</div>' +
      '<p class="q">' + q.t + '</p>' + (q.hint ? '<p class="muted" style="font-size:13.5px">' + q.hint + '</p>' : '') +
      '<div class="answer"><button type="button" data-ans="sim" aria-pressed="' + (a === 'sim') + '"><svg class="i i22"><use href="#i-check"/></svg>Sim</button><button type="button" data-ans="nao" aria-pressed="' + (a === 'nao') + '"><svg class="i i22"><use href="#i-x"/></svg>Não</button></div></section>';
    if (isCrit(ck.idx)) {
      html += '<section class="evid" aria-label="Evidência do item reprovado"><div class="row g8" style="color:var(--blq)"><svg class="i i18"><use href="#i-octagon"/></svg><strong style="font-size:14px">Resposta reprovada · evidência obrigatória</strong></div>' +
        '<p class="muted">' + (q.evid === 'texto'
          ? 'Justifique em texto. A foto é opcional: condição pessoal não se comprova com foto, e cada pessoa tem direito de recusa.'
          : 'Registre o motivo e anexe ao menos 1 foto. Você segue respondendo; a APR só é validada no fim.') + '</p>' +
        '<div class="field"><label for="ev-obs">Observação <span class="req">· obrigatória</span></label><textarea class="textarea" id="ev-obs" rows="3" placeholder="Descreva o motivo">' + esc(ck.obs[ck.idx] || '') + '</textarea></div>' +
        '<button class="photo-add" type="button" data-action="ev-photo" style="height:52px;flex-direction:row">' + (ck.foto[ck.idx]
          ? '<svg class="i i18"><use href="#i-check"/></svg>1 foto adicionada · 13/10 · GPS ok'
          : '<svg class="i i18"><use href="#i-camera"/></svg>Adicionar foto' + (q.evid === 'texto' ? ' (opcional)' : '')) + '</button></section>';
    }
    html += '<div class="nav2"><button class="btn btn-line" type="button" data-action="ck-prev"' + (ck.idx === 0 ? ' disabled' : '') + '>Anterior</button>' +
      '<button class="btn btn-p" type="button" id="ck-next" data-action="ck-next"' + (nextDisabled() ? ' disabled' : '') + '>' + (ck.idx === Q.length - 1 ? 'Revisar e concluir' : 'Próxima') + '</button></div>';
    html += '<section class="stack g8" aria-label="Todas as perguntas"><span class="lbl">Perguntas · toque para voltar a uma resposta</span><div class="qgrid">';
    for (var i = 0; i < Q.length; i++) {
      html += '<button class="qchip' + (i === ck.idx ? ' cur' : (ck.ans[i] !== undefined ? ' done' : '')) + '" type="button" data-q="' + i + '" aria-label="Pergunta ' + (i + 1) + (ck.ans[i] !== undefined ? ', respondida' : '') + '">' + (i + 1) + '</button>';
    }
    html += '</div></section>';
    body.innerHTML = html;
    body.scrollTop = 0;
  }

  /* ---------- Tela de bloqueio ---------- */
  var pendingBlock = null;
  var BLOCK_DEFAULT = {
    kind: 'apr', head: 'APR · Rede Vila Velha', sub: 'OS 4030877 · APR 03 v4 · 12/10 09:14', title: 'Atividade impedida',
    desc: 'Um item eliminatório teve resposta bloqueante. A OS fica pendente e a execução não pode começar. Uma nova APR, de qualquer pessoa da equipe, pode liberá-la.',
    items: [{
      label: 'Pergunta 9 · Eliminatório', item: 'Existe algum impedimento para realizar a atividade?', ans: 'Resposta: Sim', foto: true,
      obs: 'Caixa de válvula com água até a borda. É preciso bombeamento e limpeza pela manutenção civil antes da intervenção.'
    }]
  };
  function applyBlock() {
    var b = pendingBlock || BLOCK_DEFAULT;
    $('#bl-head').textContent = b.head; $('#bl-sub').textContent = b.sub;
    $('#bl-title').textContent = b.title; $('#bl-desc').textContent = b.desc;
    var items = $('#bl-items'), extra = $('#bl-extra');
    if (b.kind === 'interrupt') {
      items.innerHTML = '';
      extra.style.display = '';
      var obs = $('#obs'); obs.value = ''; obs.placeholder = 'Descreva o motivo da interrupção';
    } else {
      extra.style.display = 'none';
      items.innerHTML = b.items.map(function (it) {
        return '<div class="card stack g6" style="padding:14px"><span class="mono small">' + it.label + '</span><p style="font-size:15px;font-weight:600;line-height:1.35">' + it.item + '</p>' +
          '<div class="row between wrap"><span class="badge b-dark" style="background:var(--blq)">' + it.ans + '</span><span class="small">' + (it.foto ? 'Evidência: observação e foto' : 'Evidência: observação') + '</span></div>' +
          '<p class="muted" style="font-size:13.5px">“' + esc(it.obs) + '”</p></div>';
      }).join('');
    }
    pendingBlock = null;
  }

  /* ---------- Tela de aprovação ---------- */
  function applyApproved() {
    var sum = $('#ap-sum'), box = $('#ap-alert');
    if (!ck.done) {
      sum.textContent = '18 de 18 itens respondidos às 09:24. Nenhum item eliminatório bloqueou.';
      box.style.display = 'flex';
      box.innerHTML = '<svg class="i i18"><use href="#i-alert"/></svg><div><strong>1 alerta registrado:</strong> iluminação auxiliar necessária. Aparece no PDF e no painel, mas não bloqueia.</div>';
      return;
    }
    var alerts = 0;
    for (var i = 0; i < Q.length; i++) if (isAlertAns(i)) alerts++;
    sum.textContent = '18 de 18 itens respondidos. Nenhum item eliminatório bloqueou.';
    if (alerts) {
      box.style.display = 'flex';
      box.innerHTML = '<svg class="i i18"><use href="#i-alert"/></svg><div><strong>' + alerts + ' alerta' + (alerts > 1 ? 's' : '') + ' registrado' + (alerts > 1 ? 's' : '') + ':</strong> iluminação auxiliar necessária. Aparece no PDF e no painel, mas não bloqueia.</div>';
    } else { box.style.display = 'none'; }
  }

  /* ---------- Assinaturas do perfil (APR aprovada) ---------- */
  var sg = [false, false];
  function signReset() { sg = [false, false]; renderSign(); }
  function renderSign() {
    [0, 1].forEach(function (i) {
      var box = $('[data-sgbox="' + i + '"]'), ok = $('[data-sgok="' + i + '"]'), btn = $('[data-sgbtn="' + i + '"]');
      if (!box) return;
      box.classList.toggle('pend', !sg[i]);
      ok.style.display = sg[i] ? '' : 'none';
      btn.style.display = sg[i] ? 'none' : '';
    });
    var st = $('#ap-start');
    if (st) {
      var on = sg[0] && sg[1];
      st.classList.toggle('is-off', !on);
      st.setAttribute('aria-disabled', on ? 'false' : 'true');
      if (on) st.removeAttribute('tabindex'); else st.setAttribute('tabindex', '-1');
    }
  }

  /* ---------- Pausa na execução ---------- */
  var paused = false;
  function pauseReset() { paused = false; renderPause(); }
  function renderPause() {
    var t = $('#ex-pause-t'); if (!t) return;
    t.textContent = paused ? 'Continuar' : 'Pausar';
    $('#ex-pause-i use').setAttribute('href', paused ? '#i-play' : '#i-pause');
    var b = $('#ex-badge'); b.textContent = paused ? 'Em pausa' : 'Em execução';
    b.className = 'badge ' + (paused ? 'b-al' : 'b-exe');
    $('#ex-pnote').style.display = paused ? 'flex' : 'none';
  }

  /* ---------- Sincronização simulada ---------- */
  var SYNC_RECS = [
    ['APR aprovada · OS 4031187', '09:24 · #A-2210'],
    ['Execução iniciada · 4031187', '09:31 · 2 pessoas'],
    ['Pausa · 4031187', '10:15 a 10:27'],
    ['OS encerrada · 4031187', '11:18 · 3 fotos · 2 assinaturas'],
    ['APR aprovada · OS 4031190', '11:22 · #A-2211'],
    ['Execução iniciada · 4031190', '11:26']
  ];
  var SYNC_FILES = 5;
  var sy = { state: 'idle', files: 0, recs: 0, timer: null };
  function syReset() { clearInterval(sy.timer); sy = { state: 'idle', files: 0, recs: 0, timer: null }; }
  function renderSync() {
    var list = $('#sy-list'); if (!list) return;
    var N = SYNC_RECS.length, html = '';
    SYNC_RECS.forEach(function (r, i) {
      var s = sy.state === 'done' || i < sy.recs ? 'ok' : (sy.state === 'running' && sy.files >= SYNC_FILES && i === sy.recs ? 'enviando' : 'fila');
      var ic = s === 'ok' ? 'i-check' : (s === 'enviando' ? 'i-cloudup' : 'i-clock');
      var txt = s === 'ok' ? 'Confirmado' : (s === 'enviando' ? 'Enviando…' : 'Na fila');
      html += '<div class="sync-row" data-s="' + s + '"><span class="sync-ic"><svg class="i i16"><use href="#' + ic + '"/></svg></span><span class="stack" style="flex:1"><span style="font-size:14px;font-weight:600">' + r[0] + '</span><span class="small">' + r[1] + '</span></span><span class="st">' + txt + '</span></div>';
    });
    list.innerHTML = html;
    var done = sy.state === 'done';
    $('#sy-files').textContent = (done ? SYNC_FILES : sy.files) + ' de ' + SYNC_FILES;
    $('#sy-recs').textContent = (done ? N : sy.recs) + ' de ' + N;
    var pct = done ? 100 : Math.round((sy.files + sy.recs) / (SYNC_FILES + N) * 100);
    $('#sy-bar').style.width = Math.min(100, pct) + '%';
    var badge = $('#sy-badge'), bt = $('#sy-badge-t');
    var icon = done ? 'i-check' : 'i-refresh';
    badge.querySelector('use').setAttribute('href', '#' + icon);
    badge.querySelector('svg').classList.toggle('spin', sy.state === 'running');
    bt.textContent = done ? 'Sincronizado 12:41' : (sy.state === 'running' ? 'Enviando' : 'Com sinal');
    $('#sy-sub').textContent = done ? 'Tudo enviado · OS 4031187 já aparece no painel' : 'Sinal recuperado às 12:38';
    var pull = $('#sy-pull');
    pull.innerHTML = done
      ? '<svg class="i i16" style="color:var(--enc)"><use href="#i-check"/></svg><span style="color:var(--enc);font-weight:600">Novidades da equipe baixadas: 2 OS novas e 1 mudança de planejamento.</span>'
      : '<svg class="i i16"><use href="#i-download"/></svg><span>Em seguida: baixar OS novas e mudanças de planejamento da equipe.</span>';
    $('#sy-foot').innerHTML = done
      ? '<a class="btn btn-p btn-block" href="#web-detalhe"><svg class="i i18"><use href="#i-grid"/></svg>Ver a OS no painel web</a><a class="btn btn-line btn-block" href="#app-lista" style="height:44px;font-size:14px">Voltar às OS</a>'
      : '<button class="btn btn-p btn-block" type="button" id="sy-btn" data-action="sync-go"' + (sy.state === 'running' ? ' disabled style="opacity:.6"' : '') + '><svg class="i i18"><use href="#i-refresh"/></svg>' + (sy.state === 'running' ? 'Sincronizando…' : 'Sincronizar agora') + '</button>';
  }
  function syncGo() {
    if (sy.state !== 'idle') return;
    sy.state = 'running'; renderSync();
    sy.timer = setInterval(function () {
      if (sy.files < SYNC_FILES) sy.files++;
      else if (sy.recs < SYNC_RECS.length) sy.recs++;
      else { clearInterval(sy.timer); sy.state = 'done'; toast('Sincronização concluída. O painel web já mostra a OS.'); }
      renderSync();
    }, 650);
  }

  /* ---------- Alertas (painel web) ---------- */
  var ALERTS = [
    { k: 'bloq', tipo: 'APR bloqueada', quando: '12/10 09:14', os: '4030877', local: 'Rede Vila Velha', resumo: 'Caixa de válvula alagada. Precisa de bombeamento antes.', unread: true,
      titulo: 'DCV Desobstrução de caixa de válvula', end: 'Rede Vila Velha · Av. Champagnat, 1100', equipe: 'Carlos Menezes (responsável) e Diego Rocha', qd: '12/10 às 09:14 no campo · recebido às 10:02',
      itemL: 'Item que bloqueou · pergunta 9 · eliminatório', item: 'Existe algum impedimento para realizar a atividade? <span style="color:var(--blq)">Sim</span>',
      obs: 'Caixa de válvula com água até a borda. É preciso bombeamento e limpeza pela manutenção civil antes da intervenção.', foto: '09:14', apoio: 'Bombear e limpar a caixa de válvula para liberar a OS 4030877.', badge: 'APR bloqueada', note: 'Atraso desta OS conta como justificado no indicador do mês.' },
    { k: 'bloq', tipo: 'Execução interrompida', quando: 'hoje 10:52', os: '4030990', local: 'Rede Serra Norte', resumo: 'Odor de gás percebido durante o reparo. Área isolada.', unread: true,
      titulo: 'Reparo em válvula de bloqueio', end: 'Rede Serra Norte · Rua das Palmeiras, 320', equipe: 'Paulo Ribeiro (responsável) e Marcelo Dias', qd: 'hoje às 10:52 no campo · recebido às 12:40',
      itemL: 'Motivo da interrupção', item: 'Condição de risco durante a execução: odor de gás percebido.',
      obs: 'Odor de gás percebido ao abrir a válvula. Área isolada e equipe afastada. Aguardando equipe de emergência.', foto: '10:52', apoio: 'Verificar vazamento e liberar a área para o reparo da OS 4030990.', badge: 'Execução interrompida', note: 'Atraso desta OS conta como justificado no indicador do mês.' },
    { k: 'info', tipo: 'Apoio encerrado', quando: 'hoje 08:15', os: '4030655', local: 'Celulose Capixaba', resumo: 'Dedetização concluída pela OS de apoio 4031301. A original já pode receber nova APR.', unread: true,
      titulo: 'Inspeção de válvula na área industrial', badge: 'Apoio encerrado', ic: 'i-refresh',
      msg: 'A OS de apoio 4031301 (dedetização, equipe externa) foi encerrada hoje às 08:15. A OS original continua pendente: a equipe já pode fazer uma nova APR, e reprogramar é opcional.', act: 'Reprogramar OS 4030655' },
    { k: 'info', tipo: 'Conflito de planejamento', quando: 'ontem 17:20', os: '4031012', local: 'Mineração Atlântica', resumo: 'Reatribuída na web enquanto o técnico estava sem sinal. Registro de campo mantido.', unread: false,
      titulo: 'Vazamento em conexão do medidor industrial', badge: 'Conflito de planejamento', ic: 'i-refresh',
      msg: 'A OS foi reatribuída na web enquanto o técnico estava sem sinal. A execução feita em campo foi aplicada mesmo assim: conflito vira alerta, nunca sobrescrita.', act: 'Abrir a OS' },
    { k: 'info', tipo: 'Execução duplicada', quando: '08/10 15:03', os: '4030802', local: 'ERS Vila Velha 02', resumo: 'Duas execuções feitas sem sinal. Vale a primeira encerrada.', unread: false,
      titulo: 'Inspeção de filtro', badge: 'Execução duplicada', ic: 'i-refresh',
      msg: 'Duas pessoas executaram a mesma OS sem sinal. As duas execuções ficam guardadas; vale a primeira encerrada.', act: 'Abrir a OS' }
  ];
  var alertSel = 0;

  function unreadCount() { return ALERTS.filter(function (a) { return a.unread; }).length; }
  function syncCounters() {
    var n = unreadCount();
    $('#bell-n').textContent = n; $('#bell-n').style.display = n ? '' : 'none';
    $$('.side .cnt').forEach(function (c) { c.textContent = n; c.style.display = n ? '' : 'none'; });
    var t = $('#al-count'); if (t) t.textContent = n + (n === 1 ? ' não lido' : ' não lidos');
  }
  function renderAlerts() {
    var list = $('#al-list'); if (!list) return;
    var html = '';
    ALERTS.forEach(function (a, i) {
      var ic = a.k === 'bloq' ? '<span class="ic red"><svg class="i i16"><use href="#i-octagon"/></svg></span>' : '<span class="ic blue"><svg class="i i16"><use href="#i-refresh"/></svg></span>';
      html += '<button class="aitem' + (a.unread ? ' unread' : '') + '" type="button" role="option" data-a="' + i + '" aria-selected="' + (i === alertSel) + '">' + ic +
        '<span class="stack" style="flex:1;min-width:0;gap:2px"><span class="tp"><b style="color:' + (a.k === 'bloq' ? 'var(--blq)' : 'var(--brand)') + '">' + a.tipo + '</b><span>' + a.quando + '</span></span>' +
        '<span class="os"><span class="mono">' + a.os + '</span> · ' + a.local + '</span><span class="rs">' + a.resumo + '</span></span></button>';
    });
    list.innerHTML = html;
    renderAlertDetail();
    syncCounters();
  }
  function renderAlertDetail() {
    var a = ALERTS[alertSel], d = $('#al-detail'), h = '';
    var badgeCls = a.k === 'bloq' ? 'b-blq' : 'b-lib';
    h += '<div class="row between wrap" style="align-items:flex-start"><div class="stack g6" style="min-width:0"><div class="row wrap g8"><span class="badge ' + badgeCls + '"><svg class="i i13"><use href="#' + (a.k === 'bloq' ? 'i-octagon' : 'i-refresh') + '"/></svg>' + a.badge + '</span><span class="badge b-neu">' + (a.unread ? 'Não lido' : 'Lido') + '</span></div>' +
      '<h2 style="font-size:21px;line-height:1.25"><span class="mono">OS ' + a.os + '</span> — ' + a.titulo + '</h2></div><a href="#web-detalhe" style="font-size:14px;font-weight:600">Abrir OS</a></div>';
    if (a.k === 'bloq') {
      h += '<dl class="dl" style="grid-template-columns:repeat(2,1fr)"><div><dt>Local</dt><dd>' + a.end + '</dd></div><div><dt>Equipe em campo</dt><dd>' + a.equipe + '</dd></div><div><dt>Quando</dt><dd>' + a.qd + '</dd></div><div><dt>Aviso</dt><dd>Painel e e-mail ao supervisor</dd></div></dl>' +
        '<div class="blockbox"><div class="stack g8" style="flex:1;min-width:0"><div><div class="small" style="color:#6B2A23">' + a.itemL + '</div><div style="font-size:14.5px;font-weight:600">' + a.item + '</div></div><div><div class="small" style="color:#6B2A23">Observação do técnico</div><div style="font-size:14.5px">“' + a.obs + '”</div></div></div>' +
        '<figure style="margin:0;flex:0 0 170px" class="stack g4"><div class="photo" role="img" aria-label="Foto do impedimento" style="height:120px;align-items:center;justify-content:center"><svg class="i i24"><use href="#i-image"/></svg></div><figcaption class="small"><span class="mono">' + a.foto + '</span> · com GPS</figcaption></figure></div>' +
        '<div class="stack g4"><h3 style="font-size:16px;font-weight:600">O que fazer com a OS</h3><p class="muted">A OS fica pendente. A equipe pode fazer uma nova APR a qualquer momento; você acompanha e pode reprogramar ou abrir uma OS de apoio. Nada feito em campo é apagado.</p></div>' +
        '<div class="decide"><div class="dcard main"><div class="hd"><span class="ic"><svg class="i i16"><use href="#i-users"/></svg></span><h4>Abrir OS de apoio</h4></div><p class="muted">Outra equipe resolve antes. A OS original continua pendente e você recebe um aviso quando o apoio terminar.</p>' +
        '<div class="field"><label for="ap-eq" style="font-size:12px">Equipe de apoio</label><select class="select" id="ap-eq"><option>Manutenção Civil</option><option>Instrumentação</option></select></div>' +
        '<div class="field"><label for="ap-dt" style="font-size:12px">Data programada</label><input class="select" id="ap-dt" value="14/10/2026"></div>' +
        '<div class="field"><label for="ap-ds" style="font-size:12px">O que a equipe de apoio deve fazer</label><textarea class="textarea" id="ap-ds" rows="2" style="font-size:14px">' + a.apoio + '</textarea></div>' +
        '<button class="btn btn-p btn-sm" type="button" data-action="apoio-go" style="height:44px">Criar OS de apoio</button></div>' +
        '<div class="dcard"><div class="hd"><span class="ic"><svg class="i i16"><use href="#i-cal"/></svg></span><h4>Reprogramar</h4></div><p class="muted">Nova data ou nova equipe, quando fizer sentido. É opcional: a equipe não precisa esperar para fazer uma nova APR.</p>' +
        '<div class="field"><label for="rp-dt" style="font-size:12px">Nova data</label><input class="select" id="rp-dt" value="16/10/2026"></div>' +
        '<div class="field"><label for="rp-eq" style="font-size:12px">Equipe</label><select class="select" id="rp-eq"><option>Serviços Especiais</option><option>Instrumentação</option></select></div>' +
        '<div class="field"><label for="rp-js" style="font-size:12px">Justificativa <span class="req">· obrigatória</span></label><textarea class="textarea" id="rp-js" rows="2" style="font-size:14px" placeholder="Ex.: aguardar a drenagem pela manutenção civil"></textarea></div>' +
        '<button class="btn btn-line btn-sm" type="button" data-action="reprog-go" style="height:44px;border-color:var(--ink)">Reprogramar OS</button></div></div>' +
        '<div class="row between wrap" style="padding-top:4px;border-top:1px solid var(--line2)"><span class="muted">' + a.note + '</span><button class="btn btn-ghost btn-sm" type="button" data-action="al-read">Marcar como lido</button></div>';
    } else {
      h += '<div class="notice n-info" style="font-size:14.5px"><svg class="i i18"><use href="#i-info"/></svg><div>' + a.msg + '</div></div>' +
        '<div class="row g8"><a class="btn btn-p btn-sm" href="#web-detalhe">' + a.act + '</a><button class="btn btn-ghost btn-sm" type="button" data-action="al-read">Marcar como lido</button></div>';
    }
    d.innerHTML = h;
  }

  /* ---------- Exportação SAP ---------- */
  var exported = false;
  function exportGo() {
    if (exported) { toast('Nenhuma OS nova para exportar.'); return; }
    exported = true;
    $('#ex-count').textContent = '0';
    $('#ex-btn-t').textContent = 'Nenhuma OS nova para exportar';
    $('#ex-btn').style.opacity = '.6';
    $('#ex-body').innerHTML = '<tr><td colspan="5" class="muted" style="padding:18px 12px">Nenhuma OS encerrada pendente de exportação.</td></tr>';
    toast('Planilha gerada: 12 OS marcadas como exportadas para baixa no SAP.');
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;

    var start = t.closest('#ap-start');
    if (start && start.getAttribute('aria-disabled') === 'true') {
      e.preventDefault(); toast('Confirme as assinaturas dos dois participantes para iniciar.'); return;
    }

    var ans = t.closest('[data-ans]');
    if (ans) { ckAnswer(ans.dataset.ans); return; }

    var qc = t.closest('[data-q]');
    if (qc) { ck.idx = +qc.dataset.q; ck.mode = 'q'; renderChecklist(); return; }

    var pp = t.closest('[data-pdfp]');
    if (pp) { pdfPage(+pp.dataset.pdfp); fit(); return; }

    var chip = t.closest('#lista-chips [data-f]');
    if (chip) {
      $$('#lista-chips button').forEach(function (b) { b.setAttribute('aria-pressed', b === chip ? 'true' : 'false'); });
      var f = chip.dataset.f;
      $$('#s-app-lista .os-card[data-st]').forEach(function (c) { c.style.display = (f === 'todas' || c.dataset.st === f) ? '' : 'none'; });
      $$('#s-app-lista [data-grp]').forEach(function (g) {
        var vis = $$('.os-card', g).some(function (c) { return c.style.display !== 'none'; });
        g.style.display = vis ? '' : 'none';
      });
      return;
    }

    var ai = t.closest('.aitem');
    if (ai) { alertSel = +ai.dataset.a; ALERTS[alertSel].unread = false; renderAlerts(); return; }

    var ml = t.closest('#ml-list a');
    if (ml) {
      e.preventDefault();
      if (ml.dataset.m !== '03') toast('Esta demonstração detalha apenas a APR 03.');
      return;
    }

    var act = t.closest('[data-action]');
    if (act) {
      switch (act.dataset.action) {
        case 'ck-reset': ckReset(); break;
        case 'ck-skip9': ckReset(); ckFill(8); renderChecklist(); return;
        case 'ck-rest': ckFill(Q.length); ck.mode = 'review'; renderChecklist(); return;
        case 'ck-prev': if (ck.idx > 0) { ck.idx--; renderChecklist(); } return;
        case 'ck-next': if (!nextDisabled()) ckNext(); return;
        case 'ck-back': ck.mode = 'q'; ck.idx = Q.length - 1; renderChecklist(); return;
        case 'ck-validate': ckValidate(); return;
        case 'ev-photo': ck.foto[ck.idx] = true; renderChecklist(); return;
        case 'sign': sg[+act.dataset.i] = true; renderSign(); return;
        case 'pause-toggle':
          paused = !paused; renderPause();
          toast(paused ? 'Pausa registrada às 10:15. Conta à parte do tempo líquido.' : 'Execução retomada às 10:27. Pausa de 12 min registrada.');
          return;
        case 'bl-interrupt':
          pendingBlock = { kind: 'interrupt', head: 'OS 4031187 · ERP Serra', sub: 'APR 03 v4 · execução em andamento', title: 'Execução interrompida',
            desc: 'A execução para por risco. A OS fica pendente e o supervisor é avisado; para retomar, é preciso uma APR nova.' };
          break;
        case 'sync-go': syncGo(); return;
        case 'export-go': exportGo(); return;
        case 'al-read': ALERTS[alertSel].unread = false; renderAlerts(); toast('Alerta marcado como lido.'); return;
        case 'apoio-go': toast('OS de apoio criada para ' + $('#ap-eq').value + '. A original continua pendente.'); return;
        case 'reprog-go':
          if (!$('#rp-js').value.trim()) { toast('Justificativa obrigatória para reprogramar.'); $('#rp-js').focus(); return; }
          toast('OS reprogramada para ' + $('#rp-dt').value + '. A equipe segue podendo fazer uma APR nova.'); return;
      }
    }

    var ts = t.closest('[data-toast]');
    if (ts) {
      if (ts.getAttribute('href') === '#') e.preventDefault();
      if (ts.dataset.action === 'sync-reset' || ts.getAttribute('href') === '#app-sync') syReset();
      toast(ts.dataset.toast);
    }

    var jump = t.closest('[data-jump]');
    if (jump) { go(jump.dataset.jump); }
  });

  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'ev-obs') {
      ck.obs[ck.idx] = e.target.value;
      var nb = $('#ck-next'); if (nb) nb.disabled = nextDisabled();
    }
  });

  $('#btn-prev').addEventListener('click', function () { step(-1); });
  $('#btn-next').addEventListener('click', function () { step(1); });
  $('#btn-roteiro').addEventListener('click', function () { $('#roteiro').classList.toggle('hide'); setTimeout(fit, 30); });
  $('#btn-fs').addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen();
  });
  document.addEventListener('fullscreenchange', function () { setTimeout(fit, 60); });

  function step(d) {
    var i = ORDER.indexOf(current) + d;
    if (i >= 0 && i < ORDER.length) go(ORDER[i]);
  }
  document.addEventListener('keydown', function (e) {
    var tg = e.target && e.target.tagName;
    if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'm' || e.key === 'M') $('#btn-roteiro').click();
    else if (e.key === 'f' || e.key === 'F') $('#btn-fs').click();
  });

  /* ---------- Início ---------- */
  buildRoteiro();
  renderSync();
  syncCounters();
  show(ORDER.indexOf(location.hash.slice(1)) >= 0 ? location.hash.slice(1) : 'app-entrar');
})();
