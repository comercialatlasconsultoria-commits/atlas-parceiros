/* FV · runtime do protótipo (Atlas Consultoria Digital)
   Renderiza os templates das telas (holes {{x}}, sc-if, sc-for, dc-import) com estado e eventos. */
(function () {
  'use strict';
  var BOOL_ATTRS = { disabled: 1, checked: 1, selected: 1, hidden: 1, open: 1, readonly: 1, required: 1 };
  var EVENT_MAP = { change: 'input' };
  var registry = {};
  var helmetDone = {};
  var root = null;
  var pending = false;

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (patch) {
    var p = typeof patch === 'function' ? patch(this.state, this.props) : patch;
    this.state = Object.assign({}, this.state, p);
    schedule();
  };
  window.DCLogic = DCLogic;

  function schedule() {
    if (pending) return;
    pending = true;
    (window.queueMicrotask || setTimeout)(function () { pending = false; renderRoot(); });
  }

  function loadComponent(name) {
    if (registry[name]) return registry[name];
    var tpl = document.getElementById('fv-tpl-' + name);
    var code = document.getElementById('fv-js-' + name);
    if (!tpl) throw new Error('Template não encontrado: ' + name);
    var Cls = code ? new Function('DCLogic', code.textContent + '\n;return Component;')(DCLogic) : DCLogic;
    registry[name] = { tpl: tpl, Cls: Cls };
    var helmet = tpl.content.querySelector('helmet');
    if (helmet && !helmetDone[name]) {
      helmetDone[name] = true;
      Array.prototype.forEach.call(helmet.children, function (n) { document.head.appendChild(n.cloneNode(true)); });
    }
    return registry[name];
  }

  function lookup(path, scopes) {
    var parts = path.split('.');
    for (var i = scopes.length - 1; i >= 0; i--) {
      var s = scopes[i];
      if (s && Object.prototype.hasOwnProperty.call(s, parts[0])) {
        var v = s[parts[0]];
        for (var j = 1; j < parts.length; j++) { if (v == null) return undefined; v = v[parts[j]]; }
        return v;
      }
    }
    return undefined;
  }
  var HOLE = /\{\{\s*([A-Za-z_$][\w$.]*)\s*\}\}/g;
  var SINGLE = /^\{\{\s*([A-Za-z_$][\w$.]*)\s*\}\}$/;
  function raw(str, scopes) {
    var m = SINGLE.exec(str.trim());
    return m ? lookup(m[1], scopes) : str;
  }
  function interp(str, scopes) {
    return str.replace(HOLE, function (_, p) { var v = lookup(p, scopes); return v == null || v === false ? '' : String(v); });
  }
  function truthy(v) { return !(v == null || v === false || v === 0 || v === '' || (Array.isArray(v) && v.length === 0)); }

  /* ---- render: template DOM -> DOM real ---- */
  function renderChildren(srcParent, out, scopes, inst) {
    Array.prototype.forEach.call(srcParent.childNodes, function (n) { renderNode(n, out, scopes, inst); });
  }
  function renderNode(n, out, scopes, inst) {
    if (n.nodeType === 3) { out.appendChild(document.createTextNode(n.nodeValue.indexOf('{{') < 0 ? n.nodeValue : interp(n.nodeValue, scopes))); return; }
    if (n.nodeType !== 1) return;
    var tag = n.tagName.toLowerCase();
    if (tag === 'helmet') return;
    if (tag === 'sc-if') { if (truthy(raw(n.getAttribute('value') || '', scopes))) renderChildren(n, out, scopes, inst); return; }
    if (tag === 'sc-for') {
      var list = raw(n.getAttribute('list') || '', scopes) || [];
      var as = n.getAttribute('as') || 'item';
      for (var i = 0; i < list.length; i++) { var sc = {}; sc[as] = list[i]; renderChildren(n, out, scopes.concat([sc]), inst); }
      return;
    }
    if (tag === 'dc-import') {
      var name = n.getAttribute('name');
      var props = {};
      Array.prototype.forEach.call(n.attributes, function (a) {
        if (a.name === 'name' || a.name.indexOf('hint-') === 0) return;
        props[a.name] = raw(a.value, scopes);
      });
      var key = name + '#' + (inst._childIdx++);
      var child = inst._children[key];
      var def = loadComponent(name);
      if (!child) { child = new def.Cls(props); child.props = props; child._children = {}; inst._children[key] = child; }
      else child.props = props;
      var wrap = document.createElement('div');
      wrap.setAttribute('style', 'display: contents;');
      renderInstance(child, def, wrap);
      out.appendChild(wrap);
      return;
    }
    var el = n.namespaceURI === 'http://www.w3.org/2000/svg' ? document.createElementNS(n.namespaceURI, n.tagName) : document.createElement(tag);
    Array.prototype.forEach.call(n.attributes, function (a) {
      var name = a.name, val = a.value;
      if (name.indexOf('hint-') === 0) return;
      var lname = name.toLowerCase();
      if (lname.length > 2 && lname.indexOf('on') === 0 && SINGLE.test(val.trim())) {
        var fn = raw(val, scopes);
        if (typeof fn === 'function') { var type = lname.slice(2); type = EVENT_MAP[type] || type; (el.__on || (el.__on = {}))[type] = fn; }
        return;
      }
      if (val.indexOf('{{') < 0) { el.setAttribute(name, val); return; }
      if (BOOL_ATTRS[lname] && SINGLE.test(val.trim())) { if (truthy(raw(val, scopes))) el.setAttribute(name, ''); return; }
      if (lname === 'value') { el.__value = interp(val, scopes); el.setAttribute(name, el.__value); return; }
      el.setAttribute(name, interp(val, scopes));
    });
    var src = tag === 'template' ? n.content : n;
    renderChildren(src, el, scopes, inst);
    out.appendChild(el);
  }
  function renderInstance(inst, def, out) {
    inst._childIdx = 0;
    var vals = inst.renderVals ? inst.renderVals() : {};
    var scopes = [inst.props || {}, vals];
    renderChildren(def.tpl.content, out, scopes, inst);
  }

  /* ---- patch: preserva foco, rolagem e animações entre renders ---- */
  function bindEvents(el) {
    if (!el.__on) return;
    el.__bound = el.__bound || {};
    Object.keys(el.__on).forEach(function (t) {
      if (el.__bound[t]) return;
      el.__bound[t] = true;
      el.addEventListener(t, function (e) { var f = el.__on && el.__on[t]; if (f) f(e); });
    });
  }
  function bindTree(node) {
    if (node.nodeType !== 1) return;
    bindEvents(node);
    if (node.__value != null) node.value = node.__value;
    for (var c = node.firstChild; c; c = c.nextSibling) bindTree(c);
  }
  function sameKind(a, b) { return a.nodeType === b.nodeType && (a.nodeType !== 1 || a.tagName === b.tagName); }
  function patch(oldN, newN) {
    if (oldN.nodeType === 3) { if (oldN.nodeValue !== newN.nodeValue) oldN.nodeValue = newN.nodeValue; return; }
    var oa = oldN.attributes, na = newN.attributes, i;
    for (i = oa.length - 1; i >= 0; i--) if (!newN.hasAttribute(oa[i].name)) oldN.removeAttribute(oa[i].name);
    for (i = 0; i < na.length; i++) if (oldN.getAttribute(na[i].name) !== na[i].value) oldN.setAttribute(na[i].name, na[i].value);
    oldN.__on = newN.__on; bindEvents(oldN);
    if (newN.__value != null && oldN.value !== newN.__value) oldN.value = newN.__value;
    if ('checked' in oldN) oldN.checked = newN.hasAttribute('checked');
    patchChildren(oldN, newN);
  }
  function patchChildren(oldP, newP) {
    var o = oldP.firstChild, n = newP.firstChild;
    while (n) {
      var nextN = n.nextSibling;
      if (!o) { oldP.appendChild(n); bindTree(n); }
      else if (sameKind(o, n)) { patch(o, n); o = o.nextSibling; }
      else { var nextO = o.nextSibling; oldP.replaceChild(n, o); bindTree(n); o = nextO; }
      n = nextN;
    }
    while (o) { var x = o.nextSibling; oldP.removeChild(o); o = x; }
  }

  function renderRoot() {
    var frag = document.createElement('div');
    renderInstance(root.inst, root.def, frag);
    if (!root.mounted) { while (frag.firstChild) { var c = frag.firstChild; root.el.appendChild(c); bindTree(c); } root.mounted = true; }
    else patchChildren(root.el, frag);
  }

  window.FVProto = {
    mount: function (name, el, props) {
      var def = loadComponent(name);
      var inst = new def.Cls(props || {});
      inst.props = props || {};
      inst._children = {};
      root = { inst: inst, def: def, el: el, mounted: false };
      renderRoot();
    }
  };
})();
