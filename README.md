# TUNGI TOSHKENT — 3D avtomobil o'yini

Brauzerda ishlaydigan 3D ochiq dunyo o'yini. Toshkent ko'chalarida haydash, poyga, drift, taksi va yetkazib berish.
Server kerak emas: o'yin to'liq statik, progress brauzerning `localStorage` xotirasida saqlanadi.

## Kompyuterda ishga tushirish

Fayllar ES modul sifatida yuklanadi, shuning uchun `index.html` ni ikki marta bosib ochib bo'lmaydi. Kichik lokal server kerak:

```bash
cd tungi-toshkent-3d
npm start
```

Keyin brauzerda http://localhost:5173 manzilini oching. Buning uchun Node.js o'rnatilgan bo'lishi kerak. VS Code'dagi "Live Server" kengaytmasi ham ishlaydi.

Three.js kutubxonasi CDN (jsdelivr) orqali yuklanadi, shuning uchun internet kerak.

## Netlify'ga joylash

1. https://app.netlify.com saytiga kiring.
2. **Add new site → Deploy manually** ni tanlang.
3. `tungi-toshkent-3d` papkasini sahifaga sudrab tashlang.
4. Bir necha soniyadan keyin `https://<nom>.netlify.app` manzili beriladi.

Build buyrug'i kerak emas. `netlify.toml` fayli papkaning o'zini nashr qiladi.

## Boshqaruv

| Tugma | Vazifa |
|---|---|
| W / S | Oldinga / tormoz va orqaga |
| A / D | Chapga / o'ngga |
| Shift | Nitro |
| Space | Qo'l tormozi, drift |
| E | Xizmat paneli (zapravka yonida benzin quyish) |
| F | Garaj va avtosalon |
| M | Katta xarita, bosib GPS nuqtasi qo'yiladi |
| R | Poygalar: ko'cha poygasi, 1v1 tungi poyga, drift |
| T | Yetkazib berish, taksi, ijara |
| L / H / C | Faralar / signal / kamera turi |
| ESC | Pauza |
| Sichqoncha | Bosib sudrash — kamerani 360° aylantirish, g'ildirak — masofa |

Telefonda ekrandagi tugmalar chiqadi.

## Imkoniyatlar

- Shahar: 12×12 kvartal, Anhor kanali va ko'priklar, teleminora, Chorsu, Amir Temur xiyoboni, Toshkent Siti, Mustaqillik maydoni, bog'lar.
- Ishlaydigan svetoforlar: AI mashinalar qizilda to'xtaydi. Piyodalar trotuarda yuradi.
- 24 soatlik kun-tun sikli: 24 daqiqa real vaqt = 1 o'yin kuni. Tunda derazalar, reklama va ko'cha chiroqlari yonadi.
- 12 ta avtomobil. Har birining tezlanishi, maksimal tezligi, tormozi, benzin sarfi va dvigatel ovozi alohida.
- Iqtisodiyot: boshlang'ich pul 2 000 000 000 so'm. Har 10 km uchun bonus, kunlik bonus va kundalik topshiriqlar bor. Barcha operatsiyalar jurnalga yoziladi (E panelida ko'rinadi).
- AI-92, AI-95, AI-100 benzin turlari. Noto'g'ri tur quyilsa, dvigatel quvvati pasayadi.
- Tuning: rang, disklar, spoyler, neon, dvigatel (Stage 1–3).
- Grafika sifati: past, o'rta, yuqori, ultra (soyalar, bloom, transport soni).

## Fayllar tuzilmasi

```
index.html          HUD va oynalar tuzilmasi
css/style.css       Interfeys dizayni va animatsiyalar
js/main.js          Yuklash va o'yin sikli
js/config.js        Mashinalar, narxlar, tuning
js/state.js         Pul, garaj, saqlash
js/physics.js       Haydash fizikasi va kolliziyalar
js/carModel.js      Mashinalarning 3D modellari
js/traffic.js       AI transport va piyodalar
js/missions.js      Poyga, drift, taksi, yetkazib berish
js/ui.js, ui-garage.js, garage3d.js   Menyular va garaj
js/hud.js, map.js, camera.js, render.js, audio.js, input.js
js/world/           Shahar, binolar, jihozlar, osmon
```
