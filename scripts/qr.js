let app = require('express')();
app.listen(8001, '0.0.0.0', err => app.get('/', (req, res) => res.send(`
<!doctype html>
<html>
<head>
  <title>QR gen</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="shortcut icon" href="data:image/png;base64,">
  <style>
html, body {
  margin: 0;
  height: 100% }
body {
  display: flex;
  flex-flow: column wrap;
  align-items: center;
  justify-content: center }
input { margin-bottom: 2rem }
canvas {
  width: 50vmin;
  height: 50vmin }
  </style>
</head>
<body>
  <input type="text">
  <canvas></canvas>
  <script src="https://cdn.rawgit.com/jeromeetienne/jquery-qrcode/master/src/qrcode.js"></script>
  <script>
    function $ (sel, node) { return Array.prototype.slice.call( (node || document).querySelectorAll(sel) ) }
    $.addEvents = function (obj, node) {
      for (var q in obj) for (var e in obj[q])
        for (var ns = q ? $(q, node) : [window, document], es = e.split(' '), i = 0; i < es.length; i++)
          typeof ns === 'undefined' || ns.forEach(n => n.addEventListener(es[i], obj[q][e].bind(n))) };

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

    $.addEvents({ input: { keypress: function (e) { if (e.key == "Enter") createQR(this.value) } } })
  </script>
</body>
</html>
`)))
