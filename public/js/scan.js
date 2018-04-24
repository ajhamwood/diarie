var video = $('video')[0], canvas = document.createElement('canvas'),
    context = canvas.getContext('2d'), vidw = video.clientWidth, vidh = video.clientHeight,
    cameras = [], stream, ix;

function startQRScan() {
  function scan () {
    ix = setTimeout(scan, 500);
    if (stream) {
      let gap = (vidw - vidh) / 2, min = Math.min(vidw, vidh);
      context.drawImage(video, Math.max(0, gap), Math.max(0, -gap), min, min, 0, 0, canvas.width, canvas.height);

      new Promise(r => {
        qrcode.width = canvas.width;
        qrcode.height = canvas.height;
        qrcode.imagedata = context.getImageData(0, 0, qrcode.width, qrcode.height);
        qrcode.result = qrcode.process(context);
        qrcode.callback(qrcode.result);
        r(qrcode.result)
      }).catch(console.log)
    }
  }

  qrcode.callback = function (result) {
    stream.getVideoTracks()[0].stop();
    clearInterval(ix);
    localStorage.setItem('auth', result);
    let body = new FormData();
    body.append('auth', result);
    fetch('/', {method: 'POST', body, credentials: 'include'}).then(res => res.json()).then(json => {
      if (json.ok) location.reload()
      else {
        startQRScan();
        $('#login-fail')[0].classList.remove('hide');
        setTimeout(() => $('#login-fail')[0].classList.add('hide'), 1000)
      }
    })
  }

  if (navigator.mediaDevices.getUserMedia) {
    return navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, deviceId: { exact: cameras[0].deviceId } }
    }).then((s) => {
      video.srcObject = stream = s;
      video.onloadedmetadata = () => {
        video.play();
        vidw = video.videoWidth;
        vidh = video.videoHeight;
        canvas.width = canvas.height = Math.min(vidw, vidh);
        ix = setTimeout(scan, 500)
      }
    });
  } else console.log("Can't connect camera")
}

function swapCamera () {
  stream.getVideoTracks()[0].stop();
  cameras.unshift(cameras.pop());
  startQRScan()
}

function getCameras () {
  return new Promise((resolve, reject) => {
    if ('mediaDevices' in navigator) navigator.mediaDevices.enumerateDevices()
      .then(is => cameras = is.filter(i => i.kind == 'videoinput')).then(resolve);
    else reject(console.log('Can\'t find a camera'))
  }).then(c => {
    switch (c.length) {
      case 0: throw 'Can\'t find a camera';
      case 1: break;
      default: swap = true
    }
  })
}

var swap, initial = true;
$.addEvents({
  "": {
    load: function () {
      let use = $('svg')[0].removeChild($('svg > use')[0]);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        let op = .875 - .25 * Math.random();
        use.setAttribute('fill', (i + j) % 2 ? '#' + [255, 20, 147].map(x => Math.floor(x + op * (256 - x)).toString(16)).join('') : 'url(#hatch)');
        use.setAttribute('x', 32 * i + .2 * ((i + j) % 2));
        use.setAttribute('y', 32 * j + .5 * ((i + j) % 2));
        $('svg')[0].appendChild(use.cloneNode())
      }
    }
  },
  "#create-account": {
    click: function () {
      this.disabled = true;
      let body = new FormData();
      body.append('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
      fetch('/create-account', {method: 'POST', body, credentials: 'include'}).then(res => res.json()).then(data => {
        if (data.ok) {
          localStorage.setItem('auth', data.auth);
          location.reload()
        } else this.disabled = false;
      })
    }
  },
  "#video-wrapper > svg": {
    click: function () {
      new Promise(resolve => {
        if (initial) {
          resolve(getCameras());
          initial = false
        } else resolve()
      }).then(startQRScan)
        .then(() => {
          swap && $('#swap')[0].classList.remove('hide');
          $('#click-me')[0].classList.add('hide')
        })
    }
  },
  video: {
    click: function () {
      $('#click-me')[0].classList.remove('hide')
      stream.getVideoTracks()[0].stop();
      video.srcObject = null;
      clearInterval(ix);
      if (cameras.length > 1) $("#swap")[0].classList.toggle("hide")
    }
  },
  "#swap": { click: swapCamera }
})
