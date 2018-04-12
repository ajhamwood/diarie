var zonedata, zonelist;
fetch('/js/timezones.json').then(res => res.json()).then(json => {
  zonedata = json;
  zonelist = json.map(x => x.zones).reduce((acc, val) => acc.concat(val), []);
  let s = $('#timezone-search')[0].value;
  popZones(s.length < 2 ? zonedata : zonelist.filter(x => ~x.name.toLowerCase().indexOf(s.toLowerCase())))
});
function popZones(json) {
  if (json.length == 0) return;
  else if ('group' in json[0]) {
    for (let i = 0, opt; i < json.length; i++) {
      $.load('option', '[name=timezone]');
      opt = $('[name=timezone] > :last-child')[0];
      opt.innerText = json[i].group;
      opt.setAttribute('disabled', '');
      for (let j = 0; j < json[i].zones.length; j++) {
        $.load('option', '[name=timezone]');
        opt = $('[name=timezone] > :last-child')[0];
        opt.setAttribute('value', json[i].zones[j].value);
        if (json[i].zones[j].value == timeZone) opt.setAttribute('selected', '');
        opt.innerText = json[i].zones[j].name
      }
      if (i == json.length - 1) break;
      $.load('option', '[name=timezone]')
      $('[name=timezone] > :last-child')[0].setAttribute('disabled', '');
    }
  } else if ("name" in json[0]) {
    for (let i = 0, opt; i < json.length; i++) {
      $.load('option', '[name=timezone]');
      opt = $('[name=timezone] > :last-child')[0];
      opt.setAttribute('value', json[i].value);
      if (json[i].value == timeZone) opt.setAttribute('selected', '');
      opt.innerText = json[i].name
    }
  }
}

function auth () {
  return crypto.getRandomValues(new Uint8Array(9)).reduce((a, x, i) => {
    a[0] = (a[0] << 2) + (x >> 6);
    a[1].push(x & 63);
    if (!(++i % 3)) { a[1].push(a[0]); a[0] = 0 }
    return a
  }, [0, []])[1].map(x => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[x]).join('')
}
function createQR (text) {
  var qrcode = new QRCode(-1, QRErrorCorrectLevel.M); //15% error correct
  qrcode.addData(text);
  qrcode.make();
  var len = qrcode.getModuleCount(), canvas = $('canvas')[0], ctx = canvas.getContext('2d'),
      tileW = canvas.width / len, tileH = canvas.height / len;
  for(var row = 0; row < len; row++){
    for(var col = 0; col < len; col++){
      ctx.fillStyle = qrcode.isDark(row, col) ? '#000' : '#fff';
      var w = (Math.ceil((col + 1) * tileW) - Math.floor(col * tileW));
      var h = (Math.ceil((row + 1) * tileH) - Math.floor(row * tileH));
      ctx.fillRect(Math.round(col * tileW),Math.round(row * tileH), w, h);
    }
  }
}

var confirmState = false, mousedown, ix;
$.addEvents({
  "": {
    load: function () {
      var canvas = $("canvas")[0], auth = localStorage.getItem('auth');
      canvas.width = 640;
      canvas.height = 640;
      if (auth) {
        if (initial) {
          localStorage.removeItem('auth');
          $('#qr-info')[0].classList.add('no-code')
        } else {
          createQR(auth);
          $('#qr-info > code')[0].innerText = auth;
        }
      } else $('#qr-info')[0].classList.add('no-code')
    }
  },
  "#timezone-search": {
    keyup: function (e) {
      var cur, s = e.target.value;
      if (s.length == 1) return;
      while (cur = $('[name=timezone] > *')[0]) cur.remove();
      popZones(s.length < 2 ? zonedata : zonelist.filter(x => ~x.name.toLowerCase().indexOf(s.toLowerCase())))
    }
  },
  "form#purge": {
    submit: function (e) {
      e.preventDefault();
      if (confirmState) return (confirmState = false);
      $('form#purge')[0].classList.add('confirm');
      $('#confirm-purge > input')[0].focus();
      confirmState = true
    }
  },
  "#confirm-purge > input": {
    keypress: function (e) {
      if (e.key != 'Enter') return;
      if (e.target.value != 'Man Shan Kan') {
        $('form#purge')[0].classList.remove('confirm');
        this.value = ''
      } else {
        $('button', this.form)[0].disabled = true;
        this.form.elements.auth.value = localStorage.getItem('auth');
        this.form.submit()
      }
    }
  },
  "form#gen-qr": {
    submit: function (e) {
      e.preventDefault();
      this.classList.add('warn')
    }
  },
  "#gen-cancel": { mousedown: function () { $('form#gen-qr')[0].classList.remove('warn') } },
  "#gen-ok": {
    click: function () {
      this.disabled = true;
      $('#gen-ok > .spinner')[0].classList.add('show');
      var form = $('form#gen-qr')[0];
      form.elements.auth.value = auth();
      fetch('/issue-qr', {method: 'POST', body: new FormData(form), credentials: 'include'})
        .then(res => res.json()).then(res => {
          if (res.ok) {
            localStorage.setItem('auth', res.auth);
            createQR(res.auth);
            $('#qr-info')[0].classList.remove('no-code');
            $('#qr-info > code')[0].innerText = res.auth;
            $('form#gen-qr')[0].classList.remove('warn')
          }
          $('#gen-ok > .spinner')[0].classList.remove('show');
          this.disabled = false
        })
    }
  },
  "#qr-info > svg": {
    "mousedown touchstart": function (e) {
      mousedown = true;
      var c = $("circle", this)[0], delay = 2000, x, y;
      c.setAttribute("cx", x = e.layerX);
      c.setAttribute("cy", y = e.layerY);
      c.setAttribute("r", 0);
      ix = setTimeout(() => {
        if (mousedown) {
          mousedown = false;
          let link = document.createElement('a');
          link.download = 'Diary QR.png';
          link.href = $("#qr-info > canvas")[0].toDataURL('image/png').replace('image/png', 'image/octet-stream');
          link.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
        }
      }, delay);
      var start = performance.now(), w = $("canvas")[0].clientWidth,
          d = Math.max.apply(Math, [0, w].map(x1 => [0, w].map(y1 => Math.sqrt((x1 - x) ** 2 + (y1 - y) ** 2))).reduce((a, v) => a.concat(v), []));
      (function loop () {
        let r = d * (performance.now() - start) / delay;
        if (mousedown) {
          c.setAttribute("r", r);
          requestAnimationFrame(loop)
        } else c.setAttribute("r", 0)
      })()
    },
    "mouseup touchend": function () {
      clearTimeout(ix);
      mousedown = false;
      $("#qr-info")[0].setAttribute("r", 0)
    }
  }
})
