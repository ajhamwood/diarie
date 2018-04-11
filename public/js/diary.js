// Load dates and times
var locale = 'en-AU',
    dateFormat = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone },
    timeFormat = { hour: 'numeric', minute: 'numeric', timeZone },
    prevDate, curDate, frags= [];

$('.entry').forEach(n => {
  curDate = new Intl.DateTimeFormat(locale, dateFormat)
    .format(new Date(parseInt(n.dataset.epoch)));
  $('.entry-time', n)[0].innerText = new Intl.DateTimeFormat(locale, timeFormat)
    .format(new Date(parseInt(n.dataset.epoch)));
  if (prevDate != curDate) {
    $.load('date', '#entries');
    $('#entries')[0].insertBefore($('#entries > :last-child')[0], n).firstChild.innerText = curDate;
    n.previousSibling.id = curDate;
    frags.push(n.previousSibling)
  } else frags.push(n);
  prevDate = curDate
});

// Events
var flag = true;
$.addEvents({
  "#next": {
    click: function () {
      if (flag = !flag) return;
      setTimeout(() => flag = !flag, 50);
      if (frag = frags.find(x => x.offsetTop > scrollY)) window.location.hash = frag.id
      else scrollTo(0, scrollMaxY)
    }
  },
  "form.delete": {
    submit: function (e) {
      e.preventDefault();
      fetch('/delete', {method: 'POST', body: new FormData(this), credentials: 'include'})
        .then(res => res.json()).then(res => {
          if (res.ok) {
            let p = parseInt(localStorage.getItem('perPage') || 10), q = new URLSearchParams();
            q.set('numPage', Math.floor(res.index / p) + 1)
            q.set('perPage', p);
            location.search = q
          }
        })
    }
  },
  "#logout > a": {
    click: function () { localStorage.removeItem('auth') }
  },
  "#page-length > select": {
    change: function () {
      let p = [5, 10, 25, 50, 100][parseInt(this.selectedIndex)], q = new URLSearchParams(location.search);
      q.set('numPage', Math.ceil(((parseInt(q.get('numPage') || 1) - 1) * parseInt(q.get('perPage') || 10) + 1) / p));
      q.set('perPage', p);
      localStorage.setItem('perPage', p);
      location.search = q
    }
  }
})
