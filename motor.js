// =============================================================
// Papaz Kimde - oyun motoru: deste, çiftler, kart çekme, ceza puanı, istatistikler, botlar
// Ekrandan bağımsızdır (online oyunda oda sahibinin cihazında çalışır).
//
// Kurallar:
//   - Destede tek bir Papaz var (eşi yok). Bütün kartlar dağıtılır.
//   - Herkes aynı sayıdaki çiftlerini masaya atar (renk fark etmez).
//   - Sırası gelen, yanındakinin (kartı olan bir sonraki oyuncunun) elinden arkası dönük bir kart çeker.
//     Çift olursa çifti masaya atar. Sıra kart çektiği oyuncuya geçer.
//   - Kartları biten kurtulur. Sonunda Papaz elinde kalana 1 ceza puanı yazılır.
//   - Seçilen sayıda el oynanır; en az ceza puanı alan kazanır.
//   - Kartını çekilecek olan, elini karıştırabilir ve bir kartı yukarı çıkarıp "yem" yapabilir.
// =============================================================

const Motor = (() => {
  const RENKLER = ['♠', '♥', '♦', '♣'];
  const DESTELER = {
    kisa: { ad: 'Kısa', sayilar: ['A', '10', 'J', 'Q'] },
    orta: { ad: 'Orta', sayilar: ['7', '8', '9', '10', 'J', 'Q', 'A'] },
    tam: { ad: 'Tam', sayilar: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'A'] },
  };
  const AD = { A: 'As', J: 'Vale', Q: 'Kız', K: 'Papaz' };
  const SURE = 30;
  const BEKLE = { dagit: 1600, cift: 1400, sonraki: 900, elSonu: 3800 };

  let o = null;
  let dinleyici = () => {};
  let zamanlayici = null, sayacZamani = null;
  const botZamanlari = [];

  const rastgele = n => Math.floor(Math.random() * n);
  const karistir = d => {
    for (let i = d.length - 1; i > 0; i--) {
      const j = rastgele(i + 1);
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  };
  const olay = (tip, veri = {}) => {
    try {
      dinleyici(tip, veri);
    } catch (e) {
      console.error('Olay işlenirken hata:', tip, e);   // ekran hatası oyunu durdurmasın
    }
  };
  const oyundakiler = () => o.oyuncular.filter(p => p.el.length > 0);
  const papazMi = k => k.r === 'K';

  // ---------- Kurulum ----------
  // ayar: { deste: 'kisa'|'orta'|'tam', el: 3|5|7 }
  function yeni(oyuncular, dinle, ayar = {}) {
    temizle();
    dinleyici = dinle || (() => {});
    o = {
      oyuncular: oyuncular.map((p, no) => ({
        no, ad: p.ad, karakter: p.karakter, kiyafet: p.kiyafet || null, bot: !!p.bot,
        el: [], ceza: 0, yem: null, bitirdi: 0,
        istat: { ceza: 0, papazCekti: 0, papazKacti: 0, ilkBitiren: 0, cift: 0, cekim: 0 },
      })),
      ayar: { deste: DESTELER[ayar.deste] ? ayar.deste : 'kisa', el: [3, 5, 7].includes(+ayar.el) ? +ayar.el : 5 },
      elNo: 0, sira: 0, hedef: null, asama: 'dagit', bitis: 0, kaybeden: null, bitirenSirasi: 0, sonuc: null,
      masadakiCiftler: 0,
    };
    setTimeout(() => elDagit(rastgele(oyuncular.length)), 400);
    return o;
  }

  function temizle() {
    clearTimeout(zamanlayici);
    clearInterval(sayacZamani);
    botZamanlari.splice(0).forEach(clearTimeout);
    zamanlayici = sayacZamani = null;
  }

  function elDagit(baslayan) {
    o.elNo++;
    o.asama = 'dagit';
    o.kaybeden = null;
    o.bitirenSirasi = 0;
    o.masadakiCiftler = 0;
    let id = 0;
    const deste = [];
    DESTELER[o.ayar.deste].sayilar.forEach(r => RENKLER.forEach(s => deste.push({ id: id++, r, s })));
    deste.push({ id: id++, r: 'K', s: RENKLER[rastgele(4)] });   // tek papaz
    karistir(deste);
    o.oyuncular.forEach(p => { p.el = []; p.yem = null; p.bitirdi = 0; });
    deste.forEach((k, i) => o.oyuncular[(baslayan + i) % o.oyuncular.length].el.push(k));
    o.sira = baslayan;
    olay('el', { elNo: o.elNo, sayilar: o.oyuncular.map(p => p.el.length) });
    // Herkes çiftlerini atar
    zamanlayici = setTimeout(() => {
      o.oyuncular.forEach(p => ciftleriAt(p));
      zamanlayici = setTimeout(() => {
        o.asama = 'oyun';
        bitenleriKontrolEt();
        if (o.asama === 'oyun') siraBaslat(o.oyuncular[o.sira].el.length ? o.sira : sonrakiOyuncu(o.sira));
      }, BEKLE.cift);
    }, BEKLE.dagit);
  }

  // Elinde aynı sayıdan iki kart varsa ikisini de masaya atar
  function ciftleriAt(p) {
    const atilan = [];
    const gruplar = {};
    p.el.forEach(k => (gruplar[k.r] = gruplar[k.r] || []).push(k));
    Object.values(gruplar).forEach(g => {
      while (g.length >= 2) atilan.push([g.shift(), g.shift()]);
    });
    if (!atilan.length) return;
    const ids = atilan.flat().map(k => k.id);
    p.el = p.el.filter(k => !ids.includes(k.id));
    p.istat.cift += atilan.length;
    o.masadakiCiftler += atilan.length;
    if (p.yem !== null && p.yem >= p.el.length) p.yem = null;
    olay('ciftAtti', { no: p.no, ciftler: atilan, kalan: p.el.length });
  }

  // Kartı olan bir sonraki oyuncu
  function sonrakiOyuncu(no) {
    const n = o.oyuncular.length;
    for (let k = 1; k <= n; k++) {
      const p = o.oyuncular[(no + k) % n];
      if (p.el.length) return p.no;
    }
    return -1;
  }

  function siraBaslat(no) {
    clearInterval(sayacZamani);
    o.sira = no;
    o.hedef = sonrakiOyuncu(no);
    o.bitis = Date.now() + SURE * 1000;
    olay('sira', { no, hedef: o.hedef, bitis: o.bitis });
    const p = o.oyuncular[no], h = o.oyuncular[o.hedef];
    if (p.bot) botZamanlari.push(setTimeout(() => botCek(p), 1000 + Math.random() * 1000));
    else {
      sayacZamani = setInterval(() => {
        if (o.asama !== 'oyun' || o.sira !== no || Date.now() < o.bitis) return;
        clearInterval(sayacZamani);
        cek(no, rastgele(o.oyuncular[o.hedef].el.length));
      }, 250);
    }
    // Kartı çekilecek bot ara sıra elini karıştırır / yem yapar
    if (h.bot) botZamanlari.push(setTimeout(() => botYemYap(h), 500 + Math.random() * 900));
  }

  // ---------- Hamleler ----------
  // no, hedefin elinden i. sıradaki kartı çeker
  function cek(no, i) {
    if (!o || o.asama !== 'oyun' || o.sira !== no) return false;
    const p = o.oyuncular[no], h = o.oyuncular[o.hedef];
    if (!h || !Number.isInteger(i) || i < 0 || i >= h.el.length) return false;
    clearInterval(sayacZamani);
    const [kart] = h.el.splice(i, 1);
    h.yem = null;
    p.el.push(kart);
    p.istat.cekim++;
    if (papazMi(kart)) {
      p.istat.papazCekti++;
      h.istat.papazKacti++;
    }
    o.asama = 'cekildi';
    olay('cekti', { no, hedef: h.no, i, kart, papaz: papazMi(kart), r: Math.random() });
    zamanlayici = setTimeout(() => {
      ciftleriAt(p);
      bitenleriKontrolEt();
      if (o.asama === 'cekildi') {
        o.asama = 'oyun';
        siraBaslat(h.el.length ? h.no : sonrakiOyuncu(h.no));
      }
    }, BEKLE.sonraki + 500);
    return true;
  }

  function karistirEl(no) {
    const p = o?.oyuncular[no];
    if (!p || p.el.length < 2 || !['oyun', 'cekildi'].includes(o.asama)) return false;
    karistir(p.el);
    p.yem = null;
    olay('karistirdi', { no });
    return true;
  }
  function yemYap(no, i) {
    const p = o?.oyuncular[no];
    if (!p || !['oyun', 'cekildi'].includes(o.asama) || !(i === null || (Number.isInteger(i) && i >= 0 && i < p.el.length))) return false;
    p.yem = p.yem === i ? null : i;
    olay('yem', { no, i: p.yem });
    return true;
  }

  // Kartı bitenler kurtulur; tek kişi kaldıysa (elinde papaz) el biter
  function bitenleriKontrolEt() {
    o.oyuncular.forEach(p => {
      if (!p.el.length && !p.bitirdi) {
        p.bitirdi = ++o.bitirenSirasi;
        if (p.bitirdi === 1) p.istat.ilkBitiren++;
        olay('kurtuldu', { no: p.no, sira: p.bitirdi });
      }
    });
    const kalan = oyundakiler();
    if (kalan.length <= 1) elSonu(kalan[0]);
  }

  function elSonu(kaybeden) {
    clearInterval(sayacZamani);
    o.asama = 'elSonu';
    if (kaybeden) {
      kaybeden.ceza++;
      kaybeden.istat.ceza++;
      o.kaybeden = kaybeden.no;
    }
    olay('elSonu', { kaybeden: o.kaybeden, cezalar: o.oyuncular.map(p => p.ceza), elNo: o.elNo, sonEl: o.elNo >= o.ayar.el, r: Math.random() });
    zamanlayici = setTimeout(() => {
      if (o.elNo >= o.ayar.el) {
        o.asama = 'bitti';
        const enAz = Math.min(...o.oyuncular.map(p => p.ceza));
        o.sonuc = { kazananlar: o.oyuncular.filter(p => p.ceza === enAz).map(p => p.no) };
        olay('bitti', { kazananlar: o.sonuc.kazananlar, cezalar: o.oyuncular.map(p => p.ceza), istat: o.oyuncular.map(x => ({ no: x.no, ad: x.ad, karakter: x.karakter, ...x.istat })) });
        return;
      }
      elDagit(o.kaybeden ?? rastgele(o.oyuncular.length));
    }, BEKLE.elSonu);
  }

  // ---------- Botlar ----------
  function botCek(p) {
    if (o.asama !== 'oyun' || o.sira !== p.no) return;
    const h = o.oyuncular[o.hedef];
    const n = h.el.length;
    let i = rastgele(n);
    // Yem kart: biraz şüphelenir (yarı yarıya ondan kaçar ya da onu alır)
    if (h.yem !== null && n > 1) i = Math.random() < 0.45 ? h.yem : (h.yem + 1 + rastgele(n - 1)) % n;
    // Önce birkaç kartın üstünde gezinir (ekranda görünsün)
    const gezinti = [...Array(1 + rastgele(2))].map(() => rastgele(n));
    gezinti.push(i);
    gezinti.forEach((g, j) => botZamanlari.push(setTimeout(() => o.asama === 'oyun' && o.sira === p.no && olay('gezindi', { no: p.no, hedef: h.no, i: g }), j * 450)));
    botZamanlari.push(setTimeout(() => cek(p.no, i), gezinti.length * 450 + 250));
  }
  function botYemYap(p) {
    if (!['oyun', 'cekildi'].includes(o.asama) || p.el.length < 2) return;
    const papazYeri = p.el.findIndex(papazMi);
    if (Math.random() < 0.35) karistirEl(p.no);
    else if (papazYeri >= 0 && Math.random() < 0.4) yemYap(p.no, papazYeri);              // papazı yem yap
    else if (Math.random() < 0.25) yemYap(p.no, rastgele(p.el.length));                      // blöf yem
  }

  // ---------- Dışarıya gösterilen hâl ----------
  // no numaralı oyuncu ne görür: kendi kartları; başkalarının sadece kart sayısı
  function gorunum(no) {
    if (!o) return null;
    return {
      elNo: o.elNo, asama: o.asama, sira: o.sira, hedef: o.hedef, bitis: o.bitis, ayar: o.ayar,
      kaybeden: o.kaybeden, sonuc: o.sonuc, masadakiCiftler: o.masadakiCiftler,
      oyuncular: o.oyuncular.map(p => ({
        no: p.no, ad: p.ad, karakter: p.karakter, kiyafet: p.kiyafet, bot: p.bot, yedekBot: !!p.yedekBot,
        canli: true, kartSayisi: p.el.length, ceza: p.ceza, yem: p.yem, bitirdi: p.bitirdi,
        el: p.no === no ? p.el : null,
      })),
    };
  }

  function botYap(no, evet) {
    const p = o?.oyuncular[no];
    if (!p || p.bot === evet) return;
    p.bot = evet;
    p.yedekBot = evet;
    if (evet && o.asama === 'oyun' && o.sira === no) {
      clearInterval(sayacZamani);
      botZamanlari.push(setTimeout(() => botCek(p), 1200));
    } else if (!evet && o.asama === 'oyun' && o.sira === no) siraBaslat(no);
  }

  // Bot, elindeki i. kartın üstünde gezinilince ne yapar: papazsa çoğu zaman terler (bazen blöf yapıp sırıtır)
  function botTepki(hedef, i) {
    const h = o?.oyuncular[hedef];
    if (!h?.bot || !h.el[i]) return null;
    if (papazMi(h.el[i])) return Math.random() < 0.65 ? 'ter' : 'mutlu';
    const r = Math.random();
    return r < 0.12 ? 'ter' : r < 0.3 ? 'supheli' : null;   // ara sıra boşuna terler (kafa karıştırır)
  }

  return {
    botTepki,
    yeni, temizle, cek, karistirEl, yemYap, gorunum, botYap, AD, DESTELER, SURE,
    get aktif() { return !!o && o.asama !== 'bitti'; },
  };
})();
