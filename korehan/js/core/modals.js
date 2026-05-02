/* ============================================================
   KoreHani — Branded modal dialogs
   Extracted from korehan-shared.js (was lines 2116-2263).
   No external dependencies; self-contained.

   Drop-in replacements for the browser's native alert / confirm /
   prompt. Each returns a Promise that resolves when the user makes
   a choice. Rationale: native dialogs are clunky on mobile (some
   browsers mute them, some show them only on the top of the page,
   iOS blocks the OK/Cancel labels from being translated), look
   unbranded, and can't be styled. For a paid product the jarring
   shift to a Chrome chrome dialog undercuts the polish we build
   everywhere else.

   Accessibility: focus moves to the primary button on open, ESC
   cancels, Enter confirms, backdrop click cancels. The modal traps
   scroll on <body> while open.

   Usage:
     await khAlert('Saved', 'Your word was saved to Word Book.');
     var ok = await khConfirm('Delete this item?', 'You can\'t undo this.');
     var name = await khPrompt('Your name', '', { placeholder: 'Jane' });
   ============================================================ */

function _khBuildModal(opts) {
  opts = opts || {};
  var wrap = document.createElement('div');
  wrap.className = 'kh-modal-backdrop';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(9,15,27,.55);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);opacity:0;transition:opacity .15s;';

  var panel = document.createElement('div');
  panel.className = 'kh-modal-panel';
  panel.style.cssText = 'background:#fff;border-radius:16px;max-width:420px;width:100%;padding:22px 22px 18px;box-shadow:0 18px 56px rgba(5,12,24,.35);transform:translateY(8px);transition:transform .18s cubic-bezier(.22,1,.36,1);font-family:inherit;';

  var title = document.createElement('div');
  title.style.cssText = 'font-size:17px;font-weight:900;color:#0f172a;margin-bottom:6px;letter-spacing:-.01em;';
  title.textContent = opts.title || '';
  panel.appendChild(title);

  if (opts.message) {
    var msg = document.createElement('div');
    msg.style.cssText = 'font-size:14px;color:#475569;line-height:1.55;margin-bottom:' + (opts.input ? '14px' : '18px') + ';';
    msg.textContent = opts.message;
    panel.appendChild(msg);
  }

  var input = null;
  if (opts.input) {
    input = document.createElement('input');
    input.type = 'text';
    input.value = opts.input.defaultValue || '';
    input.placeholder = opts.input.placeholder || '';
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;margin-bottom:18px;outline:none;color:#0f172a;';
    input.addEventListener('focus', function(){ input.style.borderColor = '#2563eb'; });
    input.addEventListener('blur',  function(){ input.style.borderColor = '#e2e8f0'; });
    panel.appendChild(input);
  }

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

  var cancelBtn = null;
  if (opts.showCancel !== false) {
    cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = opts.cancelLabel || 'Cancel';
    cancelBtn.style.cssText = 'padding:9px 18px;border:1.5px solid #e2e8f0;background:#fff;color:#475569;border-radius:999px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;';
    btnRow.appendChild(cancelBtn);
  }

  var okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.textContent = opts.okLabel || 'OK';
  okBtn.style.cssText = 'padding:9px 20px;border:0;background:' + (opts.destructive ? '#dc2626' : '#0f172a') + ';color:#fff;border-radius:999px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;';
  btnRow.appendChild(okBtn);

  panel.appendChild(btnRow);
  wrap.appendChild(panel);
  return { wrap: wrap, panel: panel, okBtn: okBtn, cancelBtn: cancelBtn, input: input };
}

function _khShowModal(opts) {
  return new Promise(function(resolve) {
    var el = _khBuildModal(opts);
    document.body.appendChild(el.wrap);
    var priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Animate in next frame so the initial opacity:0 applies.
    requestAnimationFrame(function() {
      el.wrap.style.opacity = '1';
      el.panel.style.transform = 'none';
    });
    // Focus management: input first if present, else primary button.
    setTimeout(function() { (el.input || el.okBtn).focus(); }, 40);

    function close(result) {
      el.wrap.style.opacity = '0';
      el.panel.style.transform = 'translateY(8px)';
      document.body.style.overflow = priorOverflow;
      document.removeEventListener('keydown', onKey, true);
      setTimeout(function(){ el.wrap.remove(); resolve(result); }, 150);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(opts.input ? null : false); }
      else if (e.key === 'Enter' && (!el.input || document.activeElement === el.input)) {
        e.preventDefault();
        close(opts.input ? el.input.value : true);
      }
    }
    document.addEventListener('keydown', onKey, true);
    el.wrap.addEventListener('click', function(e) {
      if (e.target === el.wrap) close(opts.input ? null : false);
    });
    if (el.cancelBtn) el.cancelBtn.addEventListener('click', function(){ close(opts.input ? null : false); });
    el.okBtn.addEventListener('click', function(){ close(opts.input ? el.input.value : true); });
  });
}

function khAlert(title, message, opts) {
  opts = opts || {};
  return _khShowModal({
    title: title,
    message: message,
    showCancel: false,
    okLabel: opts.okLabel || 'OK',
  }).then(function(){ /* void */ });
}

function khConfirm(title, message, opts) {
  opts = opts || {};
  return _khShowModal({
    title: title,
    message: message,
    okLabel: opts.okLabel || 'Confirm',
    cancelLabel: opts.cancelLabel || 'Cancel',
    destructive: !!opts.destructive,
  });
}

function khPrompt(title, message, opts) {
  opts = opts || {};
  return _khShowModal({
    title: title,
    message: message,
    input: {
      defaultValue: opts.defaultValue || '',
      placeholder: opts.placeholder || '',
    },
    okLabel: opts.okLabel || 'OK',
    cancelLabel: opts.cancelLabel || 'Cancel',
  });
}
