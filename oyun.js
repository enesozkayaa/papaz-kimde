// =============================================================
// Papaz Kimde - ekran: menü, elim (yem / karıştır), yanımdakinin kapalı kartları (çekme),
// ceza tablosu, mesajlar, tepkiler. Motor'dan (ya da online'da oda sahibinden) gelen olaylara göre
// sahneyi oynatır.
// =============================================================

const $ = id => document.getElementById(id);
const ANAHTAR_AD = 'papazKimde.ad';
const ANAHTAR_KARAKTER = 'papazKimde.karakter';
const kayitOku = (a, v) => { try { return localStorage.getItem(a) ?? v; } catch (e) { return v; } };
const kayitYaz = (a, v) => { try { localStorage.setItem(a, v); } catch (e) { /* yok */ } };
const guvenli = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let Masa = Motor;
const ui = {
  benimNo: 0,
  durum: null,
  karakter: kayitOku(ANAHTAR_KARAKTER, 'horoz'),
  etiketler: {},
  bakisSayac: { no: -1, sure: 0 },
  ozelBakis: {},
  gecmis: [],          // her elin papazı kimde kaldı
  gezinilen: null,     // bot benim elimde hangi kartın üstünde geziniyor
  sonGezin: null,
};
const online = () => typeof Ag !== 'undefined' && Ag.mod !== 'yerel';
const kartAdi = k => `${Motor.AD[k.r] || k.r} ${k.s}`;
const kartImg = (k, sinif = '') => `<img class="kartResim ${sinif}" src="${Sahne.kartResmi(k ? k.r + k.s : 'sirt')}" alt="">`;

// ---------- Botların lafları ----------
const SOZLER = {
  cekti: ['Hmm… bu olsun.', 'Şansıma güveniyorum!', 'Gözlerin seni ele veriyor…', 'Bunu alıyorum!'],
  papazAldi: ['Ah hayır… 😱', 'Olamaz!', 'Neyse… kimse görmedi.', 'Hiç bir şey olmadı… 😅'],
  papazVerdi: ['Hehe… 😏', 'Güle güle!', 'Yolun açık olsun.'],
  kurtuldu: ['Kurtuldum! 🎉', 'Bana bu kadar!', 'Hadi kolay gelsin 😎'],
  kaybetti: ['Yine mi ben!', 'Bu papaz beni seviyor…', 'Hile var bu işte!'],
};
const sec = (liste, r) => liste[Math.floor((r ?? Math.random()) * liste.length) % liste.length];

// ---------- Menü ----------
function menuKur() {
  $('adim').value = kayitOku(ANAHTAR_AD, '');
  const kap = $('karakterler');
  Karakterler.TURLER.forEach(t => {
    const b = document.createElement('button');
    b.className = 'karakterBtn';
    b.dataset.tur = t;
    const bilgi = Karakterler.BILGI[t];
    b.innerHTML = `<span class="emoji">${bilgi.emoji}</span>${bilgi.ad}`;
    b.addEventListener('click', () => {
      if (b.classList.contains('alindi')) return;
      ui.karakter = t;
      kayitYaz(ANAHTAR_KARAKTER, t);
      karakterGoster();
      Ses.sec();
      if (online()) Ag.karakterSec(t);
    });
    kap.appendChild(b);
  });
  if (!Karakterler.BILGI[ui.karakter]) ui.karakter = 'horoz';
  karakterGoster();
  $('botlaBtn').addEventListener('click', botlaBasla);
}
function karakterGoster() {
  document.querySelectorAll('.karakterBtn').forEach(b => b.classList.toggle('secili', b.dataset.tur === ui.karakter));
  $('karakterAciklama').textContent = Karakterler.BILGI[ui.karakter].aciklama;
}

function botlaBasla() {
  Ses.hazirla();
  const ad = $('adim').value.trim() || 'Sen';
  kayitYaz(ANAHTAR_AD, $('adim').value.trim());
  const kalan = Karakterler.TURLER.filter(t => t !== ui.karakter).sort(() => Math.random() - 0.5);
  const oyuncular = [{ ad, karakter: ui.karakter, bot: false, kiyafet: Giydir.kiyafet(ui.karakter) }];
  for (let i = 0; i < 3; i++) oyuncular.push({ ad: Karakterler.BILGI[kalan[i]].ad, karakter: kalan[i], bot: true });
  ui.son = oyuncular;
  ui.sonAyar = Giydir.motorAyari();
  Masa = Motor;
  Motor.yeni(oyuncular, olayGeldi, ui.sonAyar);
  oyunEkraniniKur(Motor.gorunum(0), 0);
}

function oyunEkraniniKur(d, benimNo) {
  ui.benimNo = benimNo;
  ui.durum = d;
  ui.gecmis = [];
  Masa = online() && Ag.mod === 'misafir' ? Uzak : Motor;
  $('menu').hidden = true;
  $('oyun').hidden = false;
  $('sonEkran').hidden = true;
  $('acilan').hidden = true;
  $('olumPerdesi').hidden = true;
  $('sahne').classList.remove('olu');
  Sahne.kur(d.oyuncular, benimNo);
  etiketleriKur();
  ciz();
  Ses.muzikBaslat();
  const des = Motor.DESTELER[d.ayar.deste];
  mesaj(`🃏 ${des.ad} deste · ${d.ayar.el} el · Papaz elinde kalana 1 ceza · En az cezalı kazanır`, 'orta', 4200);
}

function menuyeDon() {
  if (online()) {
    Ag.ayril();
    return;
  }
  Motor.temizle();
  Ses.gerilimDurdur(true);
  $('oyun').hidden = true;
  $('menu').hidden = false;
}

// ---------- Olaylar ----------
const adi = no => ui.durum.oyuncular[no]?.ad ?? '';

function olayGeldi(tip, v, d) {
  ui.durum = d || Motor.gorunum(ui.benimNo);
  d = ui.durum;
  const p = no => d.oyuncular[no];
  if (tip === 'el') {
    Sahne.yiginiTemizle();
    $('acilan').hidden = true;
    ui.gezinilen = null;
    Ses.dagit();
    mesaj(`🃏 ${v.elNo}. EL`, 'iri orta', 1600);
  } else if (tip === 'ciftAtti') {
    Sahne.ciftAt(v.no, v.ciftler);
    Ses.kartAt(Math.min(4, v.ciftler.length * 2));
    if (v.no === ui.benimNo) mesaj(`✨ ${v.ciftler.length} çift attın: ${v.ciftler.map(c => Motor.AD[c[0].r] || c[0].r).join(', ')}`, '', 1800);
  } else if (tip === 'sira') {
    ui.gezinilen = null;
    if (v.no === ui.benimNo) {
      Ses.siraSende();
      mesaj(`🃏 Sıra sende: ${adi(v.hedef)} elinden bir kart çek`, '', 2200);
      Sahne.oyuncuyaBak && Sahne.oyuncuyaBak(v.hedef);
    }
    bakislar();
  } else if (tip === 'gezindi') {
    // Bot bir kartın üstünde geziniyor
    if (v.hedef === ui.benimNo) ui.gezinilen = v.i;
    else Sahne.elKartiIsaretle(v.hedef, p(v.hedef).yem, v.i);
    Ses.sec();
  } else if (tip === 'cekti') {
    ui.gezinilen = null;
    Sahne.kartCekAnim(v.no, v.hedef);
    Ses.kartAt(1);
    Sahne.elKartiIsaretle(v.hedef, null, null);
    // Kartı sadece çeken ve çekilen görür
    if (v.no === ui.benimNo && v.kart) {
      if (v.papaz) {
        Ses.yalanci();
        mesaj('😱 PAPAZI ÇEKTİN!', 'iri kirmizi', 2400);
        kartGoster(v.kart, 'Papazı çektin! Şimdi onu başkasına kaptırmalısın…');
      } else {
        mesaj(`🃏 ${kartAdi(v.kart)} çektin`, '', 1600);
        kartGoster(v.kart);
      }
    } else if (v.hedef === ui.benimNo && v.kart) {
      if (v.papaz) {
        Ses.dogruCikti();
        mesaj(`😎 ${adi(v.no)} papazı senden aldı!`, 'iri', 2400);
      } else mesaj(`${adi(v.no)} senden ${kartAdi(v.kart)} aldı`, '', 1600);
    }
    if (p(v.no).bot && v.r < 0.45) balon(v.no, sec(SOZLER.cekti, v.r * 2));
    // Botun tepkisi: papaz aldıysa (çoğu zaman) belli eder
    if (Masa === Motor && p(v.no).bot) {
      setTimeout(() => {
        if (v.papaz && Math.random() < 0.65) Ag.ifadeDagit(v.no, 'ter');
        else if (Math.random() < 0.25) Ag.ifadeDagit(v.no, 'mutlu');
      }, 700);
    }
  } else if (tip === 'karistirdi') {
    Ses.kartAc(3);
    if (v.no !== ui.benimNo) balon(v.no, '🔀 Karıştırıyorum…');
    Sahne.elKartiIsaretle(v.no, null, null);
  } else if (tip === 'yem') {
    Sahne.elKartiIsaretle(v.no, v.i, null);
    if (v.no !== ui.benimNo && v.i !== null) balon(v.no, '👀 Hadi, şunu al…');
  } else if (tip === 'kurtuldu') {
    Sahne.tepki(v.no, 'gul', 1.6);
    Ses.dogruCikti();
    if (v.no === ui.benimNo) mesaj(`🎉 Kartların bitti, bu eli kurtardın! (${v.sira}. bitiren)`, 'iri', 2400);
    else balon(v.no, sec(SOZLER.kurtuldu, Math.random()));
  } else if (tip === 'elSonu') {
    ui.gecmis.push(v.kaybeden);
    Ses.yalanCikti();
    const kim = v.kaybeden === ui.benimNo ? 'SENDE' : `${adi(v.kaybeden)} elinde`;
    $('acilan').innerHTML = `<div class="papazGoster">${kartImg({ r: 'K', s: '♠' }, 'buyuk')}<div><h3>Papaz ${guvenli(kim)} kaldı!</h3><p>+1 ceza puanı</p>`
      + `<div class="cezalar">${d.oyuncular.map(x => `<span>${Karakterler.BILGI[x.karakter].emoji} ${guvenli(x.no === ui.benimNo ? 'Sen' : x.ad)}: <b>${x.ceza}</b></span>`).join('')}</div>`
      + `<p class="not">${v.sonEl ? 'Son eldi!' : `${v.elNo + 1}. el birazdan başlıyor…`}</p></div></div>`;
    $('acilan').hidden = false;
    Sahne.tepki(v.kaybeden, 'bagir', 1.6);
    Sahne.ifade(v.kaybeden, 'kizgin', 3);
    if (p(v.kaybeden).bot) setTimeout(() => balon(v.kaybeden, sec(SOZLER.kaybetti, v.r)), 600);
    d.oyuncular.forEach(x => x.bot && x.no !== v.kaybeden && Math.random() < 0.6 && Sahne.tepki(x.no, 'gul', 1.4));
  } else if (tip === 'bitti') {
    setTimeout(() => sonuGoster(v.kazananlar, v.istat), 1000);
  }
  ciz();
}

// Çektiğim kartı ekranda bir an büyük göster
let kartGosterZamani = null;
function kartGoster(k, yazi = '') {
  $('cekilenKart').innerHTML = `${kartImg(k, 'buyuk')}${yazi ? `<p>${yazi}</p>` : ''}`;
  $('cekilenKart').hidden = false;
  $('cekilenKart').classList.toggle('papaz', k.r === 'K');
  clearTimeout(kartGosterZamani);
  kartGosterZamani = setTimeout(() => ($('cekilenKart').hidden = true), k.r === 'K' ? 2600 : 1400);
}

// Botların bakışları: sıradakine bakarlar, sıradaki bot kartlarına bakar.
// Ben bir bota bir süre bakarsam o da bana bakar. (İnsan oyuncuların kafası kendi ekranlarından gelir.)
function bakislar() {
  const d = ui.durum;
  if (!d || d.asama !== 'oyun') return;
  const simdi = performance.now();
  d.oyuncular.forEach(p => {
    if (!p.bot || !p.kartSayisi) return;
    if (ui.ozelBakis[p.no] > simdi) Sahne.bak(p.no, ui.benimNo);
    else if (p.no === d.sira) Sahne.bak(p.no, d.hedef);
    else if (p.no === d.hedef) Sahne.bak(p.no, Math.random() < 0.5 ? 'kart' : d.sira);
    else Sahne.bak(p.no, d.sira);
  });
}
setInterval(() => {
  if ($('oyun').hidden || !ui.durum) return;
  const no = Sahne.baktigim();
  const p = ui.durum.oyuncular[no];
  if (no === ui.bakisSayac.no && no >= 0 && p?.bot) {
    ui.bakisSayac.sure += 0.3;
    if (ui.bakisSayac.sure > 1 && !(ui.ozelBakis[no] > performance.now())) {
      ui.ozelBakis[no] = performance.now() + 2000;
      Sahne.bak(no, ui.benimNo);
      Sahne.ifade(no, Math.random() < 0.5 ? 'supheli' : 'kizgin', 2);
      if (Math.random() < 0.35) Sahne.tepki(no, Math.random() < 0.5 ? 'dusun' : 'gul', 1.2);
    }
  } else ui.bakisSayac = { no, sure: 0 };
  bakislar();
}, 300);
// Kendi bakışımı (kafamın yönünü) odadakilere yolla
setInterval(() => {
  if (online() && !$('oyun').hidden) Ag.bakisGonder(Sahne.bakis.yaw, Sahne.bakis.pitch);
}, 150);


// ---------- Çizim ----------
function ciz() {
  const d = ui.durum;
  if (!d) return;
  const des = Motor.DESTELER[d.ayar.deste];
  const ben = d.oyuncular[ui.benimNo];
  $('masaKarti').innerHTML = `<div><b>${d.elNo}. El / ${d.ayar.el}</b><small>${des.ad} deste · Cezan: ${ben.ceza}</small></div>`;
  Sahne.kartSayilari(d.oyuncular);
  d.oyuncular.forEach(p => {
    const e = ui.etiketler[p.no];
    if (e) {
      e.el.classList.toggle('sirada', d.asama === 'oyun' && d.sira === p.no);
      e.el.classList.toggle('hedefte', d.asama === 'oyun' && d.hedef === p.no);
      const ses = online() && Ag.sesteMi(p.no) ? ' 🎙️' : '';
      const bot = p.yedekBot ? ' · 🤖' : '';
      e.bilgi.textContent = p.bitirdi ? `✅ kurtuldu · ⚠️ ${p.ceza}${ses}` : `🃏 ${p.kartSayisi} · ⚠️ ${p.ceza} ceza${bot}${ses}`;
    }
    if (p.no !== ui.benimNo) Sahne.elKartiIsaretle(p.no, p.yem, null);
  });
  const gecerli = no => Number.isInteger(no) && no >= 0 && d.oyuncular[no];
  const sirada = d.asama === 'oyun' && d.sira === ui.benimNo && gecerli(d.hedef);
  const hedefim = d.asama === 'oyun' && d.hedef === ui.benimNo && gecerli(d.sira);
  $('benimBilgi').classList.toggle('sirada', sirada);
  $('benimBilgi').innerHTML = `${Karakterler.BILGI[ben.karakter].emoji} <b>${guvenli(ben.ad)}</b> · ⚠️ ${ben.ceza} ceza`
    + (ben.bitirdi ? ' · ✅ Bu eli kurtardın' : sirada ? ` · <b>Sıra sende: ${guvenli(adi(d.hedef))} elinden çek!</b>` : hedefim ? ` · 😬 ${guvenli(adi(d.sira))} senden çekecek` : '');
  elimCiz(hedefim);
  cekmePaneliCiz(sirada);
}

// Benim elim: kartlarım açık. Sıra bende değilken bir karta dokununca yem olur (yukarı kalkar).
function elimCiz(hedefim) {
  const d = ui.durum, ben = d.oyuncular[ui.benimNo];
  const kap = $('el');
  if (!ben.el?.length) {
    kap.innerHTML = ben.bitirdi ? '<div class="bitti">🎉 Kartların bitti</div>' : '';
    $('karistirBtn').hidden = true;
    return;
  }
  kap.innerHTML = ben.el.map((k, i) => `<button class="elKart${ben.yem === i ? ' yem' : ''}${ui.gezinilen === i ? ' gezinilen' : ''}${k.r === 'K' ? ' papazKart' : ''}" data-i="${i}">${kartImg(k)}</button>`).join('');
  $('karistirBtn').hidden = ben.el.length < 2;
  eliSigdir();
  $('elIpucu').textContent = hedefim ? 'Bir karta dokun: yem olarak yukarı kalkar (karşındaki görür). 🔀 ile karıştır.' : '';
}
// Kartlar ekrana sığmazsa iç içe dizilir: her kartın sol üst köşesi (sayı + simge) görünür kalır
function eliSigdir() {
  const kap = $('el');
  const kartlar = [...kap.querySelectorAll('.elKart')];
  if (!kartlar.length) return;
  kartlar.forEach(k => (k.style.marginLeft = ''));
  const w = kartlar[0].getBoundingClientRect().width;
  const bosluk = 6, n = kartlar.length;
  const alan = Math.min(window.innerWidth, document.documentElement.clientWidth) - 20;
  if (n < 2 || n * w + (n - 1) * bosluk <= alan) return;
  const adim = Math.max(14, (alan - w) / (n - 1));    // kartlar arası görünen genişlik
  kartlar.forEach((k, i) => { if (i) k.style.marginLeft = `${adim - w - bosluk}px`; });
}
window.addEventListener('resize', () => requestAnimationFrame(eliSigdir));
$('el').addEventListener('click', e => {
  const b = e.target.closest('button[data-i]');
  if (!b) return;
  Ses.sec();
  Masa.yemYap(ui.benimNo, +b.dataset.i);
});
$('karistirBtn').addEventListener('click', () => Masa.karistirEl(ui.benimNo));

// Sıra bende: yanımdakinin kapalı kartları; üstünde gezinince o görür, dokununca çekerim
function cekmePaneliCiz(sirada) {
  const d = ui.durum;
  const pan = $('cekmePaneli');
  if (!sirada) {
    pan.hidden = true;
    return;
  }
  const h = d.oyuncular[d.hedef];
  pan.hidden = false;
  pan.innerHTML = `<p>${Karakterler.BILGI[h.karakter].emoji} <b>${guvenli(h.ad)}</b> elinden bir kart seç <small>(yüzüne dikkat et 👀)</small></p>`
    + `<div class="kapaliKartlar">${[...Array(h.kartSayisi)].map((_, i) => `<button class="kapali${h.yem === i ? ' yem' : ''}" data-i="${i}">${kartImg(null)}</button>`).join('')}</div>`;
}
$('cekmePaneli').addEventListener('click', e => {
  const b = e.target.closest('button[data-i]');
  if (!b) return;
  Masa.cek(ui.benimNo, +b.dataset.i);
});
// Gezinme: hangi kartın üstündeysem karşıdaki (ve herkes) görür; bot ise yüzüyle belli eder
$('cekmePaneli').addEventListener('pointerover', e => {
  const b = e.target.closest('button[data-i]');
  if (!b) return;
  const i = +b.dataset.i;
  if (ui.sonGezin === i) return;
  ui.sonGezin = i;
  Ag.gezinGonder(i);
});
$('cekmePaneli').addEventListener('pointerleave', () => (ui.sonGezin = null));

// Birisi bir kartın üstünde geziniyor (online ya da bot)
function gezinGoster(no, hedef, i) {
  if (!ui.durum) return;
  if (hedef === ui.benimNo) {
    ui.gezinilen = i;
    elimCiz(true);
  } else if (no !== ui.benimNo) Sahne.elKartiIsaretle(hedef, ui.durum.oyuncular[hedef].yem, i);
}

// Ceza tablosu
function tabloCiz() {
  const d = ui.durum;
  if (!d) return;
  $('tabloIcerik').innerHTML = `<table><tr><th>El</th>${d.oyuncular.map(p => `<th>${Karakterler.BILGI[p.karakter].emoji}<br><small>${guvenli(p.no === ui.benimNo ? 'Sen' : p.ad)}</small></th>`).join('')}</tr>`
    + ui.gecmis.map((k, i) => `<tr><td>${i + 1}</td>${d.oyuncular.map(p => `<td>${p.no === k ? '🃏 +1' : '–'}</td>`).join('')}</tr>`).join('')
    + `<tr class="toplam"><td>Ceza</td>${d.oyuncular.map(p => `<td>${p.ceza}</td>`).join('')}</tr></table>`;
}
$('puanBtn').addEventListener('click', () => {
  tabloCiz();
  $('tabloPaneli').hidden = false;
});
$('tabloKapat').addEventListener('click', () => ($('tabloPaneli').hidden = true));

function etiketleriKur() {
  const kap = $('etiketler');
  kap.innerHTML = '';
  ui.etiketler = {};
  ui.durum.oyuncular.forEach(p => {
    if (p.no === ui.benimNo) return;
    const el = document.createElement('div');
    el.className = 'etiket';
    el.innerHTML = `<div class="balon"></div><div class="kutu"><div class="ad">${Karakterler.BILGI[p.karakter].emoji} ${guvenli(p.ad)}</div><div class="bilgi"></div></div>`;
    kap.appendChild(el);
    ui.etiketler[p.no] = { el, bilgi: el.querySelector('.bilgi'), balon: el.querySelector('.balon') };
  });
  Sahne.etiketGuncelle = () => {
    for (const no in ui.etiketler) {
      const e = ui.etiketler[no];
      const k = Sahne.ekranKonumu(+no);
      e.el.style.display = k ? '' : 'none';
      if (k) e.el.style.transform = `translate(${k.x}px, ${Math.max(k.y, 118)}px) translate(-50%, -100%)`;
    }
  };
}

function balon(no, yazi, kirmizi, sohbet) {
  if (no === ui.benimNo) {
    mesaj(`Sen: “${yazi}”`, kirmizi ? 'kirmizi' : '', sohbet ? 2500 : 1400);
    return;
  }
  const e = ui.etiketler[no];
  if (!e) return;
  e.balon.textContent = yazi;
  e.balon.className = 'balon goster' + (kirmizi ? ' kirmizi' : '');
  if (ui.durum?.oyuncular[no]?.bot) Sahne.konus(no, Math.min(2, 0.4 + yazi.length * 0.05));
  clearTimeout(e.zaman);
  e.zaman = setTimeout(() => (e.balon.className = 'balon'), sohbet ? 3500 : 2200);
}

const TEPKI_HAREKET = { '😂': 'gul', '😡': 'bagir', '😱': 'zipla', '🤠': 'salla', '👍': 'salla', '🤥': 'dusun' };
function tepkiGoster(no, e) {
  if (!ui.durum || !Object.keys(TEPKI_HAREKET).includes(e)) return;
  if (no === ui.benimNo) {
    mesaj(`Sen: ${e}`, 'iri', 1200);
    return;
  }
  balon(no, e);
  Sahne.tepki(no, TEPKI_HAREKET[e], 1.4);
}
// Botun yüz ifadesi (gezinmeye tepki): oda sahibinden gelir
function ifadeGoster(no, tur) {
  if (tur === 'ter') {
    Sahne.terle(no, 1.2);
    Sahne.ifade(no, 'korkmus', 1.6);
  } else Sahne.ifade(no, tur, 1.6);
}

let mesajZamani = null;
function mesaj(yazi, sinif = '', sure = 2000) {
  const m = $('mesaj');
  m.textContent = yazi;
  m.className = 'goster ' + sinif;
  clearTimeout(mesajZamani);
  mesajZamani = setTimeout(() => (m.className = sinif), sure);
}

function sonuGoster(kazananlar, istat) {
  const d = ui.durum;
  $('acilan').hidden = true;
  $('sonEkran').hidden = false;
  if (istat) {
    const oduller = Istatistik.oduller(istat);
    $('oduller').innerHTML = oduller.map(o => `<div class="odul"><span>${o.emoji}</span><div><b>${o.ad}: ${guvenli(o.kim)}</b><small>${o.aciklama}</small></div></div>`).join('');
    const yeni = Istatistik.oyunBitti(istat.find(p => p.no === ui.benimNo), kazananlar.includes(ui.benimNo));
    $('yeniRozet').innerHTML = yeni.map(r => `<div class="rozet var"><span>${r.emoji}</span><b>Yeni rozet: ${r.ad}</b><small>${r.aciklama}</small></div>`).join('');
  }
  const misafir = online() && Ag.mod === 'misafir';
  $('tekrarBtn').hidden = misafir;
  $('sonBekle').hidden = !misafir;
  const sirali = [...d.oyuncular].sort((a, b) => a.ceza - b.ceza);
  $('sonYazi').innerHTML = sirali.map((p, i) => `${i + 1}. ${Karakterler.BILGI[p.karakter].emoji} ${guvenli(p.no === ui.benimNo ? 'Sen' : p.ad)}: ${p.ceza} ceza`).join('<br>');
  if (kazananlar.includes(ui.benimNo)) {
    Ses.kazandin();
    $('sonBaslik').textContent = kazananlar.length > 1 ? '🏆 Berabere kazandın!' : '🏆 Kazandın!';
  } else {
    $('sonBaslik').textContent = `🏆 Kazanan: ${kazananlar.map(no => `${Karakterler.BILGI[d.oyuncular[no].karakter].emoji} ${d.oyuncular[no].ad}`).join(', ')}`;
  }
}

// Süre çubuğu (sıra bende iken)
setInterval(() => {
  const d = ui.durum;
  const c = $('sureCubugu').firstElementChild;
  if (!d || d.asama !== 'oyun' || d.sira !== ui.benimNo) { c.style.width = '0'; return; }
  const kalan = Math.max(0, (d.bitis - Date.now()) / (Motor.SURE * 1000));
  c.style.width = `${kalan * 100}%`;
  if (kalan < 0.2 && Math.round(Date.now() / 250) % 4 === 0) Ses.tikTak();
}, 250);

// ---------- Düğmeler ----------
$('menuBtn').addEventListener('click', () => {
  const soru = online() ? (Ag.mod === 'ev' ? 'Odayı kapatıp ana menüye dönülsün mü? (Arkadaşlarının oyunu da biter)' : 'Odadan çıkılsın mı? (Yerine bot oynar, aynı adla geri girebilirsin)') : 'Oyundan çıkıp ana menüye dönülsün mü?';
  if ((!Motor.aktif && !online()) || confirm(soru)) menuyeDon();
});
$('sonMenuBtn').addEventListener('click', menuyeDon);
$('tekrarBtn').addEventListener('click', () => {
  if (online()) Ag.oyunuBaslat();
  else {
    Motor.yeni(ui.son, olayGeldi, ui.sonAyar);
    oyunEkraniniKur(Motor.gorunum(0), 0);
  }
});
document.querySelectorAll('#tepkiler button').forEach(b => b.addEventListener('click', () => {
  Ses.sec();
  Ag.tepkiGonder(b.textContent);
}));
function sesDugmesi() {
  $('sesBtn').textContent = Ses.acik ? '🔊' : '🔇';
  $('muzikBtn').classList.toggle('kapali', !Ses.muzikAcik);
}
$('sesBtn').addEventListener('click', () => { Ses.ac(!Ses.acik); sesDugmesi(); });
$('muzikBtn').addEventListener('click', () => { Ses.muzikAc(!Ses.muzikAcik); sesDugmesi(); });
sesDugmesi();

Sahne.baslat($('sahne'));
menuKur();
