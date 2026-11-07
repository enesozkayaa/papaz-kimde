// =============================================================
// Papaz Kimde - istatistikler ve rozetler
// Oyun sonunda masadakilere ödüller dağıtılır (En şanslı, Yalan makinesi, Keskin göz...).
// Bu cihazdaki oyuncunun toplam istatistikleri saklanır; belli hedeflere ulaşınca rozet kazanılır.
// =============================================================

const Istatistik = (() => {
  const ANAHTAR = 'papazKimde.istatistik';
  const ROZETLER = [
    { id: 'ilkZafer', emoji: '🏆', ad: 'İlk Zafer', aciklama: 'Bir oyun kazan', sart: (t) => t.galibiyet >= 1 },
    { id: 'kral', emoji: '👑', ad: 'Saloon Kralı', aciklama: '10 oyun kazan', sart: (t) => t.galibiyet >= 10 },
    { id: 'emektar', emoji: '🤠', ad: 'Emektar Kovboy', aciklama: '25 oyun oyna', sart: (t) => t.oyun >= 25 },
    { id: 'temiz', emoji: '😇', ad: 'Tertemiz', aciklama: 'Hiç ceza almadan bir oyun bitir', sart: (t, o) => o && o.ceza === 0 },
    { id: 'kacak', emoji: '🏃', ad: 'Kaçak', aciklama: 'Papazı toplam 10 kez başkasına kaptır', sart: (t) => t.papazKacti >= 10 },
    { id: 'miknatis', emoji: '🧲', ad: 'Papaz Mıknatısı', aciklama: 'Papazı toplam 10 kez çek', sart: (t) => t.papazCekti >= 10 },
    { id: 'hizli', emoji: '⚡', ad: 'Şimşek', aciklama: '5 kez eli ilk bitiren ol', sart: (t) => t.ilkBitiren >= 5 },
    { id: 'ciftci', emoji: '🃏', ad: 'Çift Avcısı', aciklama: 'Toplam 100 çift at', sart: (t) => t.cift >= 100 },
    { id: 'papazKrali', emoji: '🤴', ad: 'Papazın Sevgilisi', aciklama: 'Bir oyunda 3 ceza al', sart: (t, o) => o && o.ceza >= 3 },
    { id: 'sabir', emoji: '🕰️', ad: 'Sabırlı', aciklama: '500 kart çek', sart: (t) => t.cekim >= 500 },
  ];

  const ALANLAR = ['oyun', 'galibiyet', 'ceza', 'papazCekti', 'papazKacti', 'ilkBitiren', 'cift', 'cekim'];

  function oku() {
    let t = null;
    try { t = JSON.parse(localStorage.getItem(ANAHTAR)); } catch (e) { /* yok */ }
    t = t && typeof t === 'object' ? t : {};
    ALANLAR.forEach(a => (t[a] = +t[a] || 0));
    t.rozetler = Array.isArray(t.rozetler) ? t.rozetler : [];
    return t;
  }
  function yaz(t) {
    try { localStorage.setItem(ANAHTAR, JSON.stringify(t)); } catch (e) { /* yok */ }
  }

  // Oyun bitti: benim istatistiklerimi topla, yeni kazanılan rozetleri döndür
  function oyunBitti(benim, kazandi) {
    const t = oku();
    t.oyun++;
    if (kazandi) t.galibiyet++;
    ['ceza', 'papazCekti', 'papazKacti', 'ilkBitiren', 'cift', 'cekim'].forEach(a => (t[a] += +benim?.[a] || 0));
    const yeni = ROZETLER.filter(r => !t.rozetler.includes(r.id) && r.sart(t, benim, kazandi));
    yeni.forEach(r => t.rozetler.push(r.id));
    yaz(t);
    return yeni;
  }
  function domatesAtildi() {
    const t = oku();
    t.domates++;
    const yeni = ROZETLER.filter(r => !t.rozetler.includes(r.id) && r.sart(t));
    yeni.forEach(r => t.rozetler.push(r.id));
    yaz(t);
    return yeni;
  }

  // Oyun sonu ödülleri: masadaki herkes arasından
  function oduller(istat) {
    const liste = [];
    const enCok = (alan, emoji, ad, aciklama, enAz) => {
      const degerler = istat.map(p => p[alan] || 0);
      const hedef = enAz ? Math.min(...degerler) : Math.max(...degerler);
      if (!enAz && hedef <= 0) return;
      const kim = istat.filter(p => (p[alan] || 0) === hedef);
      if (kim.length === istat.length) return;
      liste.push({ emoji, ad, kim: kim.map(p => p.ad).join(', '), aciklama: aciklama(hedef) });
    };
    enCok('ceza', '🍀', 'En şanslı', n => `Sadece ${n} ceza aldı`, true);
    enCok('ceza', '🤴', 'Papazın sevgilisi', n => `${n} kez papaz elinde kaldı`);
    enCok('papazCekti', '🧲', 'Papaz mıknatısı', n => `Papazı ${n} kez çekti`);
    enCok('papazKacti', '🏃', 'Kaçak', n => `Papazı ${n} kez başkasına kaptırdı`);
    enCok('ilkBitiren', '⚡', 'Şimşek', n => `${n} kez eli ilk bitirdi`);
    enCok('cift', '🃏', 'Çift avcısı', n => `${n} çift attı`);
    return liste;
  }

  function paneliCiz() {
    const t = oku();
    const oran = t.oyun ? Math.round((t.galibiyet / t.oyun) * 100) : 0;
    const kutu = (deger, ad) => `<div class="istKutu"><b>${deger}</b><small>${ad}</small></div>`;
    $('istatistikIcerik').innerHTML = `<div class="istIzgara">${kutu(t.oyun, 'Oyun')}${kutu(t.galibiyet, 'Galibiyet')}${kutu('%' + oran, 'Kazanma')}`
      + `${kutu(t.ceza, 'Ceza')}${kutu(t.papazCekti, 'Papaz çektin')}${kutu(t.papazKacti, 'Papaz kaptırdın')}`
      + `${kutu(t.ilkBitiren, 'İlk bitirdin')}${kutu(t.cift, 'Çift')}${kutu(t.cekim, 'Kart çektin')}</div>`
      + `<h3>Rozetler (${t.rozetler.length}/${ROZETLER.length})</h3><div class="rozetler">`
      + ROZETLER.map(r => `<div class="rozet${t.rozetler.includes(r.id) ? ' var' : ''}"><span>${r.emoji}</span><b>${r.ad}</b><small>${r.aciklama}</small></div>`).join('')
      + '</div>';
  }
  $('istatistikBtn').addEventListener('click', () => {
    paneliCiz();
    $('istatistikPaneli').hidden = false;
  });
  $('istatistikKapat').addEventListener('click', () => ($('istatistikPaneli').hidden = true));

  return { oyunBitti, domatesAtildi, oduller };
})();
