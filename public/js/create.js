var images = [], remove = [], rename = {};

var fileEvents = {
  button: {
    click: function (e) {
      e.preventDefault();
      let ix = images.findIndex(x => x.id == this.parentNode.dataset.id);
      if (!('add' in images[ix])) {
        remove.push(images[ix].name);
        delete rename[images[ix].id]
      }
      images.splice(ix, 1);
      if ($('#img-md')[0].dataset.id == this.parentNode.dataset.id) {
        $('#img-md')[0].classList.remove('show');
        delete $('#img-md')[0].dataset.id
      }
      $(`ul#images > [data-id="${this.parentNode.dataset.id}"]`)[0].remove();
      this.parentNode.remove()
    }
  },
  span: {
    click: function (e) {
      $('ul#images > .selected').forEach(x => x.classList.remove('selected'));
      $(`ul#images > [data-id="${this.parentNode.dataset.id}"]`)[0].classList.add('selected');
      $('#img-md span')[0].innerText = this.innerText;
      $('#img-md')[0].classList.add('show');
      $('#img-md')[0].dataset.id = this.parentNode.dataset.id;
      if (!e.ctrlKey && !e.shiftKey && this.classList.contains('selected') &&
        images.reduce((a, x) => x.selected ? a + 1 : a, 0) == 1) {
        e.preventDefault();
        this.parentNode.classList.add('edit-file-name');
        $('input', this.parentNode)[0].focus()
      }
    }
  },
  input: {
    keypress: function (e) { if (e.key == "Enter") finishFileNameEdit.bind(this)(e) },
    blur: function (e) { finishFileNameEdit.bind(this)(e) }
  }
}

function finishFileNameEdit (e) {
  this.parentNode.classList.remove('edit-file-name');
  let s = $('span', this.parentNode)[0],
      img = images.find(x => x.id == this.parentNode.dataset.id);
  if (!('add' in img)) rename[img.id] = this.value;
  else img.name = this.value;
  $('#img-md span')[0].innerText = s.innerText = this.value;
  $('ul#images > .selected').forEach(x => x.classList.remove('selected'));
  $(`ul#images > [data-id="${this.parentNode.dataset.id}"]`)[0].classList.add('selected');
  e.preventDefault()
}

$.addEvents({
  "": {
    load: function () {
      var d = new Date(parseInt($('form')[0].elements.timestamp.value) || Date.now());
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
      $('form')[0].elements.time.value = d.toISOString().slice(11, 16);
      $('form')[0].elements.date.value = d.toISOString().slice(0, 10);
      Promise.all($('#img-files > [data-id]').map((el, ix) => {
        return fetch('/images/' + $("form.rest")[0].elements.entryid.value + "/" + $('.file-name', el)[0].innerText, {credentials: 'include'})
          .then(res => res.blob())
          .then(blob => {
            let imgTitle = $('ul#img-files > [data-id]')[ix],
                imgId = imgTitle.dataset.id,
                filename = $('.file-name', imgTitle)[0].innerText;
            $.addEvents(fileEvents, imgTitle);

            $.load('image', 'ul#images');
            let img = $("ul#images > :last-child")[0];
            img.setAttribute('data-id', imgId);
            $('img', img)[0].src = URL.createObjectURL(blob);
            if (ix == 0) {
              img.classList.add('selected');
              $('#img-md span')[0].innerText = filename;
              $('#img-md')[0].classList.add('show');
              $('#img-md')[0].dataset.id = imgId
            }

            return {
              id: imgId,
              name: filename,
              ext: (/\.(.{0,16})$/.exec(filename) || [,''])[1],
              file: blob,
              titleElement: imgTitle,
              selected: ix == 0
            }
          }
        )
      })).then(val => images = val)
    },
    click: function (e) {
      var selected = e.composedPath()[1];
      if (e.target.classList.contains('file-name')) {
        if (e.shiftKey && e.ctrlKey) images.forEach(img => {
          img.selected = false;
          $('span', img.titleElement)[0].classList.remove('selected');
          $('ul#images > .selected').forEach(x => x.classList.remove('selected'));
          $('#img-md')[0].classList.remove('show');
          delete $('#img-md')[0].dataset.id
        });
        else if (e.shiftKey && !e.ctrlKey) {
          let select = [], up = true, down = true, i = images.findIndex(x => x.titleElement == document.activeElement.parentNode), di = 0;
          while (up || down && i != -1) {
            if (up) {
              if (images[i + di].selected) {
                for (let j = i; j <= i + di; j++) images[j].flag = true;
                up = false
              }
              if (i + di == images.length - 1) up = false
            }
            if (down) {
              if (images[i - di].selected) {
                for (let j = i - di; j <= i; j++) images[j].flag = true;
                down = false
              }
              if (i - di == 0) down = false
            }
            di++
          }
          images.forEach(img => {
            if ('flag' in img) {
              delete img.flag;
              img.selected = true;
              $('span', img.titleElement)[0].classList.add('selected')
            }
          })
        }
        else if (!e.shifKey && e.ctrlKey) {
          let img = images.find(x => x.titleElement == selected);
          $('span', selected)[0].classList[(img.selected = !img.selected) ? 'add' : 'remove']('selected');
          img.selected || $('ul#images > .selected')[0].classList.remove('selected')
        } else if (!e.shiftKey && !e.ctrlKey) {
          images.forEach(img => {
            let s = img.titleElement == selected;
            img.selected = s;
            $('span', img.titleElement)[0].classList[s ? 'add' : 'remove']('selected');
            $(`ul#images > [data-id="${img.id}"]`)[0].classList[s ? 'add' : 'remove']('selected')
          });
        }
      } else if (selected.dataset && !('id' in selected.dataset)) images.forEach(img => {
        img.selected = false;
        $('span', img.titleElement)[0].classList.remove('selected')
      });
      e.stopPropagation();
    }
  },
  form: {
    submit: function (e) {
      e.preventDefault();
      $('[type=submit]', this)[0].disabled = true;
      var el = $('form')[0].elements;
      this.elements.timestamp.value = new Date($('form')[0].elements.date.value + " " + el.time.value).valueOf();
      el.time.disabled = el.date.disabled = el.files.disabled = true;
      var body = new FormData(this),
          add = images.filter(x => 'add' in x),
          action;
      add.forEach(img => body.append('files', img.file, img.name));
      body.append('add', JSON.stringify(add.map(i => ({name: i.name, ext: i.ext}))));
      if (document.body.classList.contains('update')) {
        remove.length && body.append('remove', JSON.stringify(remove));
        if (Object.keys(rename).length) {
          rename = Object.entries(rename).map(i => {
            let x = images.find(j => j.id == i[0]);
            i[0] = typeof x == 'undefined' ? x : x.name;
            return i
          }).filter(x => typeof x[0] != 'undefined')
            .reduce((a, x) => Object.assign(a, {[x[0]]: x[1]}), {});
          body.append('rename', JSON.stringify(rename));
        }
        action = '/update'
      } else action = '/create';
      $('[type=submit] > .spinner')[0].classList.add('show');
      fetch(action, {method: 'POST', body, credentials: 'include'})
        .then(res => res.json()).then(data => {
          if (data.ok) {
            let p = parseInt(localStorage.getItem('perPage') || 10),
                q = new URLSearchParams(), r = new URL(window.location);
            q.set('numPage', Math.floor(data.index / p) + 1);
            q.set('perPage', p);
            r.pathname = '/';
            r.search = q;
            window.location = r
          }
          else {
            $('[type=submit]', this)[0].disabled = false;
            $('[type=submit] > spinner')[0].classList.remove('show')
          }
        })
    }
  },
  "#show-img-ui": {
    click: function (e) {
      e.preventDefault();
      this.form.classList.toggle('upload');
      this.innerText = this.form.classList.contains('upload') ? 'Add prose' : 'Add photos'
    }
  },
  "#add > button": {
    click: function (e) {
      e.preventDefault();
      $('[type=file]')[0].click()
    }
  },
  "[type=file]": {
    change: function (e) {
      var imgId = Math.max.apply(Math, images.map(x => x.id).concat([0]));
      images = images.concat(Array.slice.call(Array, e.target.files).map((file, ix) => {
        imgId++;
        $.load('image-title', 'ul#img-files');
        let imgTitle = $('ul#img-files > :last-child')[0];
        $.addEvents(fileEvents, imgTitle);
        $('span', imgTitle)[0].classList.add('selected');
        imgTitle.setAttribute('data-id', imgId);
        $('.file-name', imgTitle)[0].innerText = $('input', imgTitle)[0].value = file.name;
        $('ul#img-files')[0].insertBefore(imgTitle, $('#add')[0]);

        $.load('image', 'ul#images');
        let img = $("ul#images > :last-child")[0],
            imgFile = file.file || Blob.prototype.slice.call(file);
        img.setAttribute('data-id', imgId);
        $('img', img)[0].src = URL.createObjectURL(imgFile);
        if (ix == 0) {
          img.classList.add('selected');
          $('#img-md span')[0].innerText = file.name;
          $('#img-md')[0].classList.add('show');
          $('#img-md')[0].dataset.id = imgId
        }

        return {
          id: imgId,
          name: file.name,
          ext: (/\.(.{0,16})$/.exec(file.name) || [,''])[1],
          file: imgFile,
          titleElement: imgTitle,
          selected: ix == 0,
          add: ''
        }
      }))
    }
  }
})
