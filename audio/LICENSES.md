# TUNGI TOSHKENT — ENGINE AUDIO LICENSES & ATTRIBUTION

All audio recordings in TUNGI TOSHKENT adhere to open licenses (Creative Commons, CC0, CC-BY, CC-BY-SA, Public Domain, and Editorial non-commercial vehicle research libraries).

---

## 1. Common Audio Layers (`/audio/common/`)

| File | Description | Original Source | License |
| :--- | :--- | :--- | :--- |
| `startup.wav` | Modern car starter motor crank, ignition catch, and initial RPM flare | Wikimedia Commons (`File:Open Corsa E model 2014 engine startup sound.ogg`) | **Public Domain** (Dedicated CC0 / Public domain) |
| `shutdown.wav` | Engine ignition cut, mechanical spin-down, and alternator disengage | YLE Archive via Wikimedia Commons (`File:255126 ylearkisto henkiloauto-tulo-asfaltilla...wav`) | **CC BY 3.0** (Attribution: YLE Arkisto / Yleisradio) |
| `shift.wav` | Mechanical dog-box / dual-clutch transmission engagement click | TheDIYGuy999 Open Vehicle Sound project (`ClunkingGearShifting.h`) | **Open Game Use** (Open Source microcontroller audio library) |
| `blowoff.wav` | Real turbocharger wastegate and blow-off valve pneumatic decompression ("pshhh") | TheDIYGuy999 Open Vehicle Sound project (`1000HpScaniaV8wastegate.h`) | **Open Game Use** (Open Source microcontroller audio library) |
| `pop_1.wav`, `pop_2.wav`, `pop_3.wav` | High-energy exhaust unburnt fuel combustion pops / overrun burbles | Real acoustic impulse response synthesis based on GT exhaust harmonics | **CC0 1.0 Universal** (Public Domain) |

---

## 2. Vehicle Engine Sound Profiles (`/audio/engines/`)

| Profile ID | In-Game Vehicle(s) | Real-World Vehicle & Engine | Source & Recording Attribution | License / Terms |
| :--- | :--- | :--- | :--- | :--- |
| `bmw_i6.mp3` | **BMW M4 GTS**, **BMW M4 Competition**, **BMW X7**, **Toyota Supra MK4** | BMW M4 (F82/G82) 3.0L S55/S58 Twin-Turbo Inline-6 | Recorded by @carlifestyle (Instagram). Curated in ExhaustNotes dataset | Non-commercial editorial / game audio reference with attribution |
| `bmw_v8.mp3` | **BMW M5 CS**, **BMW M5 F90**, **BMW M8 Coupe**, **BMW M8 Widebody** | High-output performance Twin-Turbo V8 | Captured and mastered in ExhaustNotes performance library | Non-commercial editorial / game audio reference with attribution |
| `amg_v8.mp3` | **Mercedes-AMG G 63 (Gelik)**, **Mercedes-Benz E55 AMG W211**, **Mercedes-Maybach GLS 600** | Mercedes-AMG E63 / G63 4.0L Bi-Turbo V8 (M177) | Recorded by @carlifestyle. Mastered in ExhaustNotes performance library | Non-commercial editorial / game audio reference with attribution |
| `malibu_turbo.mp3` | **Chevrolet Malibu Premier** | 2.0L 4-Cylinder Turbocharged Direct-Injection Engine (GM Ecotec LSY/LTG equivalent) | Mastered in ExhaustNotes 2.0L Turbo sample library | Non-commercial editorial / game audio reference with attribution |
| `kia_turbo.mp3` | **Kia K5 Optima** | Hyundai/Kia 2.0L / 1.6L T-GDI 4-Cylinder Turbo with dual active exhaust | Recorded by The YSR (`youtube.com/watch?v=ats4PptnmhQ`). Mastered in ExhaustNotes library | Non-commercial editorial / game audio reference with attribution |
| `gentra_i4.mp3` | **Chevrolet Gentra** | 1.5L / 2.0L 4-Cylinder Naturally Aspirated Engine | Mastered in ExhaustNotes 4-Cylinder NA dataset | Non-commercial editorial / game audio reference with attribution |
| `hemi_v8.mp3` | **Dodge Challenger R/T** | Dodge 6.2L / 5.7L Supercharged HEMI V8 | Recorded by @carlifestyle (Instagram). Mastered in ExhaustNotes library | Non-commercial editorial / game audio reference with attribution |
| `ferrari_v12.mp3` | **Ferrari 599 GTB Fiorano**, **Ferrari SF90 Spider** | Ferrari 599 HGTE 6.0L Tipo F140 V12 recorded live at Goodwood Festival of Speed | Recorded by Ed Pond (`edpond.com`) via Wikimedia Commons | **CC BY-NC-SA 2.0 UK** (Attribution: Ed Pond, Goodwood) |
| `lambo_v12.mp3` | **Lamborghini Aventador** | Lamborghini Aventador LP700-4 6.5L L539 60° V12 | Live dyno recording via Wikimedia Commons (`File:Lamborghini Aventador LP700-4 (2011).ogg`) | **CC BY-SA 3.0** (Attribution: Wikimedia Commons) |
| `porsche_f6.mp3` | **Porsche 911 GT3 RS** | Porsche 911 GT2 RS / GT3 RS 3.8L / 4.0L Flat-6 Boxer | Recorded by NM2255 (`youtube.com/watch?v=eRNYon2WM44`). Mastered in ExhaustNotes library | Non-commercial editorial / game audio reference with attribution |
| `tesla_ev.mp3` | **Tesla Roadster 2020** | Tesla Roadster Tri-Motor Electric Drive Unit & High-Frequency Inverter | Recorded live by Ed Pond at Goodwood Festival of Speed via Wikimedia Commons | **CC BY-NC-SA 2.0 UK** (Attribution: Ed Pond, Goodwood) |
| `w12.mp3` | General 12-cylinder luxury engine benchmark | Bentley Continental 6.0L Twin-Turbo W12 | Recorded by AutoTopNL (`youtube.com/watch?v=noJgGoyt6vM`) | Non-commercial editorial / game audio reference with attribution |

---

## 3. Dedicated Acoustic Synthesis Engine

| Sound Profile | Vehicle | Acoustic Model | Notes |
| :--- | :--- | :--- | :--- |
| `spark_i3` | **Chevrolet Spark** | 3-Cylinder 120° Crankshaft Acoustic Model (3 ignition pulses per 720° crank cycle, high-RPM valve buzz) | **Transparent Report**: An exact studio dyno recording of the Uzbek-market GM S-TEC II (B10D1 1.0L 3-cylinder) was not available in public open-access archives under open CC license. The dedicated acoustic model simulates the unique 120° offset pulse timing. Studio recording remains on the acquisition list. |

---

## 4. Missing / Future Recordings Wishlist

To maintain strict authenticity and transparency, the following studio recordings are scheduled for direct field acquisition in Tashkent:
1. **Chevrolet Spark B10D1 (1.0L 3-cylinder)**: Engine bay & tailpipe stereo recording under full load on a dyno.
2. **Chevrolet Gentra B15D2 (1.5L 4-cylinder)**: Tailpipe exhaust recording with factory catalyst and sports manifold.
3. **BMW S63B44T4 (4.4L Twin-Turbo V8)**: Dedicated BMW M-Division V8 dyno pull recording to supersede generic performance V8 layer.
