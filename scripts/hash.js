#!/usr/bin/env node

const
  https = require('https'),
  crypto = require('crypto'),
  fs = require('fs');

let file = __dirname + '/lightqr', lines = [];
if (fs.existsSync(file)) lines = fs.readFileSync(file, 'utf8').split('\n');
else fs.closeSync(fs.openSync(file, 'w'));
let count = Number(lines[0] || 0), minAcc = Number(lines[1] || Infinity),
    acc, minText;

https.get('https://cdn.rawgit.com/jeromeetienne/jquery-qrcode/master/src/qrcode.js', res => {
  res.setEncoding("utf8");
  let body = "";
  res.on("data", data => body += data);
  res.on("end", () => {
    eval(body); // XXX: Don't forget this is here
    let sumQR = t => {
      let qrcode = new QRCode(-1, QRErrorCorrectLevel.M);
      qrcode.addData(t);
      qrcode.make();
      let len = qrcode.getModuleCount(), acc = 0;
      for(let row = 0; row < len; row++){
        for(let col = 0; col < len; col++){
          acc += qrcode.isDark(row, col)
        }
      }
      return acc
    }
    while (++count) {
      let text = crypto.randomBytes(18).reduce((a, x, i) => {
        a[0] = (a[0] << 2) + (x >> 6);
        a[1].push(x & 63);
        if (!(++i % 3)) { a[1].push(a[0]); a[0] = 0 }
        return a
      }, [0, []])[1]
        .map((x, i) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[x] + (i == 11 ? '-' : ''))
        .join('');
      acc = sumQR(text);
      if (!(count % 1000000)) process.stdout.write("*");
      else if (!(count % 100000)) process.stdout.write(":");
      else if (!(count % 10000)) process.stdout.write(".")
      if (acc < minAcc) {
        process.stdout.write('\n' + (minAcc = acc) + ' ' + (minText = text) + ' ');
        fs.writeFileSync(file, count + '\n' + acc + '\n' + text)
      }
    }
  })
})
