// =============================================================
// Papaz Kimde - karakter giydirme ve ayarlar
// Giydir: her karakter için şapka / gömlek / yelek rengi ve bir aksesuar seçilir (bu cihazda saklanır).
// Küçük bir 3D önizlemede karakter döner. Online oyunda seçtiğin kıyafet herkeste görünür.
// Ayarlar: özel kartlar var mı, varsa hangileri (oda sahibinin ayarı geçerli).
// =============================================================

const Giydir = (() => {
  const ANAHTAR = 'papazKimde.kiyafet.';
  let renderer = null, sahne, kamera, model = null, aktifTur = null, aci = 0;

  function kiyafet(tur) {
    try {
      const k = JSON.parse(localStorage.getItem(ANAHTAR + tur));
      if (k && typeof k === 'object') return k;
    } catch (e) { /* yok */ }
    return {};
  }
  function kaydet(tur, k) {
    try { localStorage.setItem(ANAHTAR + tur, JSON.stringify(k)); } catch (e) { /* yok */ }
  }

  // ---------- 3D önizleme ----------
  function onizlemeKur() {
    if (renderer) return;
    const kap = $('giydirOnizleme');
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(220, 250);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    kap.appendChild(renderer.domElement);
    sahne = new THREE.Scene();
    sahne.add(new THREE.HemisphereLight(0xffe8c8, 0x4a2a14, 1.6));
    const l = new THREE.DirectionalLight(0xfff0d8, 1.6);
    l.position.set(1.5, 3, 3);
    sahne.add(l);
    kamera = new THREE.PerspectiveCamera(32, 220 / 250, 0.1, 20);
    kamera.position.set(0, 1.45, 2.9);
    kamera.lookAt(0, 1.2, 0);
    // Sürükleyerek döndür
    let surukle = null;
    kap.addEventListener('pointerdown', e => (surukle = e.clientX));
    window.addEventListener('pointermove', e => {
      if (surukle === null) return;
      aci += (e.clientX - surukle) * 0.01;
      surukle = e.clientX;
    });
    window.addEventListener('pointerup', () => (surukle = null));
    let onceki = performance.now();
    const ciz = () => {
      if ($('giydirPaneli').hidden) return;
      const simdi = performance.now();
      const dt = Math.min(0.1, (simdi - onceki) / 1000);
      onceki = simdi;
      if (model) {
        Karakterler.guncelle(model, simdi / 1000, dt);
        model.kok.rotation.y = aci + Math.sin(simdi / 1500) * 0.35;
      }
      renderer.render(sahne, kamera);
      requestAnimationFrame(ciz);
    };
    onizlemeKur.ciz = ciz;
  }

  function modeliYenile() {
    if (model) sahne.remove(model.kok);
    model = Karakterler.yap(aktifTur, { kiyafet: kiyafet(aktifTur) });
    model.elKartlari.visible = false;
    sahne.add(model.kok);
  }

  function paneliCiz() {
    const k = kiyafet(aktifTur);
    const bilgi = Karakterler.BILGI[aktifTur];
    $('giydirBaslik').textContent = `🎨 ${bilgi.emoji} ${bilgi.ad}`;
    const satir = (anahtar, ad) => `<div class="giySatir"><span>${ad}</span><div>`
      + Karakterler.RENKLER[anahtar].map(r => `<button class="renk${k[anahtar] === r ? ' secili' : ''}" style="background:${r}" data-anahtar="${anahtar}" data-deger="${r}"></button>`).join('')
      + '</div></div>';
    $('giydirSecenekler').innerHTML = satir('sapka', 'Şapka') + satir('gomlek', 'Gömlek') + satir('yelek', 'Yelek')
      + `<div class="giySatir"><span>Aksesuar</span><div>${Object.entries(Karakterler.AKSESUARLAR).map(([a, ad]) =>
        `<button class="aks${(k.aksesuar || 'yok') === a ? ' secili' : ''}" data-anahtar="aksesuar" data-deger="${a}">${ad}</button>`).join('')}</div></div>`;
  }

  function ac(tur) {
    aktifTur = tur;
    $('giydirPaneli').hidden = false;
    onizlemeKur();
    modeliYenile();
    paneliCiz();
    onizlemeKur.ciz();
  }

  $('giydirSecenekler').addEventListener('click', e => {
    const b = e.target.closest('button[data-anahtar]');
    if (!b) return;
    const k = kiyafet(aktifTur);
    k[b.dataset.anahtar] = b.dataset.deger;
    kaydet(aktifTur, k);
    Ses.sec();
    modeliYenile();
    paneliCiz();
    degisti();
  });
  $('giydirSifirla').addEventListener('click', () => {
    kaydet(aktifTur, {});
    modeliYenile();
    paneliCiz();
    degisti();
  });
  $('giydirKapat').addEventListener('click', () => ($('giydirPaneli').hidden = true));
  $('giydirBtn').addEventListener('click', () => ac(ui.karakter));

  // Odadaysak yeni kıyafeti oda sahibine bildir
  function degisti() {
    if (typeof Ag !== 'undefined' && Ag.mod !== 'yerel' && aktifTur === ui.karakter) Ag.karakterSec(ui.karakter);
  }

  // ---------- Oyun ayarları: deste büyüklüğü ve el sayısı (oda sahibinin ayarı geçerli) ----------
  const AYAR_ANAHTAR = 'papazKimde.ayar';
  function ayar() {
    let a = null;
    try { a = JSON.parse(localStorage.getItem(AYAR_ANAHTAR)); } catch (e) { /* yok */ }
    return { deste: ['kisa', 'orta', 'tam'].includes(a?.deste) ? a.deste : 'kisa', el: [3, 5, 7].includes(+a?.el) ? +a.el : 5 };
  }
  const motorAyari = () => ayar();
  function ayarlariCiz(kilitli, disaridan) {
    const a = disaridan || ayar();
    document.querySelectorAll('input[name="deste"]').forEach(r => { r.checked = r.value === a.deste; r.disabled = !!kilitli; });
    document.querySelectorAll('input[name="elSayisi"]').forEach(r => { r.checked = +r.value === +a.el; r.disabled = !!kilitli; });
    $('ayarNotu').textContent = kilitli ? 'Ayarları oda sahibi seçer.' : '';
  }
  document.querySelectorAll('input[name="deste"], input[name="elSayisi"]').forEach(el => el.addEventListener('change', () => {
    const deste = document.querySelector('input[name="deste"]:checked')?.value || 'kisa';
    const el = +(document.querySelector('input[name="elSayisi"]:checked')?.value || 5);
    try { localStorage.setItem(AYAR_ANAHTAR, JSON.stringify({ deste, el })); } catch (e) { /* yok */ }
    Ses.sec();
    if (typeof Ag !== 'undefined') Ag.lobiGuncelle();
  }));
  ayarlariCiz();

  return { kiyafet, ac, motorAyari, ayarlariCiz };
})();
