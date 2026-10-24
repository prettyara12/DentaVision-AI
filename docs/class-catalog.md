# Class Catalog

31 kelas dari `model.names` di `best_resnet50.pt`. `id` adalah indeks di model dan **tidak boleh diubah urutannya**.

Kelompok:

| Kode | Label UI (ID / EN) | Warna token | Tampil default |
|---|---|---|---|
| `attention` | Perlu perhatian / Needs attention | `--finding-attention` | Ya |
| `treatment` | Perawatan & alat / Treatment & appliances | `--finding-treatment` | Ya |
| `anatomy` | Anatomi normal / Normal anatomy | `--finding-anatomy` | Tidak |

Setelah M2, sumber data ini pindah ke `web/src/features/scan/class-catalog.ts` (satu objek per kelas, teks ID/EN). Tabel di bawah lalu diganti tautan ke file itu supaya tidak ada dua sumber.

| id | `model.names` | `key` | Kelompok | ID | EN | Penjelasan singkat (ID) | Short explanation (EN) |
|---|---|---|---|---|---|---|---|
| 0 | Caries | `caries` | attention | Gigi berlubang (karies) | Cavity (caries) | Kerusakan email/dentin akibat bakteri, tampak lebih gelap di rontgen. | Tooth decay that shows as a darker area on the X-ray. |
| 1 | Crown | `crown` | treatment | Mahkota gigi | Crown | Penutup buatan yang menyelubungi gigi. | An artificial cap covering a tooth. |
| 2 | Filling | `filling` | treatment | Tambalan | Filling | Bahan pengisi gigi yang pernah berlubang. | Material placed where a cavity was treated. |
| 3 | Implant | `implant` | treatment | Implan | Implant | Sekrup logam di tulang rahang sebagai akar gigi buatan. | A metal post in the jawbone acting as an artificial root. |
| 4 | Malaligned | `malaligned` | attention | Gigi tidak rata | Misaligned tooth | Posisi gigi miring atau keluar dari lengkung. | A tooth tilted or out of the dental arch. |
| 5 | Mandibular Canal | `mandibular_canal` | anatomy | Saluran saraf rahang bawah | Mandibular canal | Saluran normal tempat saraf dan pembuluh darah rahang bawah. | A normal channel carrying the lower jaw's nerve and vessels. |
| 6 | Missing teeth | `missing_teeth` | attention | Gigi hilang | Missing tooth | Celah tempat gigi yang sudah tidak ada. | A gap where a tooth is no longer present. |
| 7 | Periapical lesion | `periapical_lesion` | attention | Lesi di ujung akar | Periapical lesion | Area gelap di ujung akar, sering terkait infeksi. | A dark area at the root tip, often linked to infection. |
| 8 | Retained root | `retained_root` | attention | Sisa akar | Retained root | Akar gigi yang tertinggal setelah mahkotanya hilang. | A root left behind after the crown of the tooth is gone. |
| 9 | Root Canal Treatment | `root_canal_treatment` | treatment | Perawatan saluran akar | Root canal treatment | Saluran akar yang sudah dibersihkan dan diisi. | A root canal that has been cleaned and filled. |
| 10 | Root Piece | `root_piece` | attention | Potongan akar | Root fragment | Fragmen akar kecil yang tertinggal di tulang. | A small root fragment left in the bone. |
| 11 | impacted tooth | `impacted_tooth` | attention | Gigi impaksi | Impacted tooth | Gigi yang tertahan dan tidak tumbuh sempurna, sering gigi bungsu. | A tooth that cannot fully erupt, often a wisdom tooth. |
| 12 | maxillary sinus | `maxillary_sinus` | anatomy | Sinus maksila | Maxillary sinus | Rongga udara normal di atas gigi rahang atas. | A normal air space above the upper back teeth. |
| 13 | Bone Loss | `bone_loss` | attention | Penurunan tulang | Bone loss | Tulang penyangga gigi berkurang, sering terkait penyakit gusi. | Reduced supporting bone, often linked to gum disease. |
| 14 | Fracture teeth | `fracture_teeth` | attention | Gigi retak/patah | Fractured tooth | Garis retak atau patahan pada gigi. | A crack or break in a tooth. |
| 15 | Permanent Teeth | `permanent_teeth` | anatomy | Gigi permanen | Permanent teeth | Gigi dewasa. | Adult teeth. |
| 16 | Supra Eruption | `supra_eruption` | attention | Gigi terlalu tumbuh (supra erupsi) | Over-erupted tooth | Gigi yang tumbuh melewati bidang gigitan, biasanya karena lawannya hilang. | A tooth that has grown past the bite line, usually when its opposite is missing. |
| 17 | TAD | `tad` | treatment | Mini-implan ortodonti (TAD) | Temporary anchorage device | Sekrup kecil sementara untuk membantu perawatan behel. | A small temporary screw that supports braces treatment. |
| 18 | abutment | `abutment` | treatment | Abutment | Abutment | Penghubung antara implan dan mahkota. | The connector between an implant and its crown. |
| 19 | attrition | `attrition` | attention | Gigi aus | Tooth wear | Permukaan gigi terkikis, sering karena menggertakkan gigi. | Worn tooth surfaces, often from grinding. |
| 20 | bone defect | `bone_defect` | attention | Defek tulang | Bone defect | Bagian tulang rahang yang bentuknya tidak normal atau hilang. | An area of jawbone that is missing or irregular. |
| 21 | gingival former | `gingival_former` | treatment | Pembentuk gusi | Healing abutment | Tutup sementara di implan untuk membentuk gusi. | A temporary cap on an implant that shapes the gum. |
| 22 | metal band | `metal_band` | treatment | Cincin logam behel | Orthodontic band | Cincin logam di gigi geraham sebagai bagian behel. | A metal ring on a molar, part of braces. |
| 23 | orthodontic brackets | `orthodontic_brackets` | treatment | Braket behel | Braces brackets | Braket yang ditempel di gigi untuk behel. | Brackets bonded to teeth for braces. |
| 24 | permanent retainer | `permanent_retainer` | treatment | Retainer cekat | Fixed retainer | Kawat tipis di belakang gigi agar posisi tetap setelah behel. | A thin wire behind the teeth that holds them after braces. |
| 25 | post - core | `post_core` | treatment | Pasak & inti | Post and core | Pasak di saluran akar untuk menopang mahkota. | A post in the root canal that supports a crown. |
| 26 | plating | `plating` | treatment | Plat fiksasi | Bone plate | Plat logam di rahang, biasanya setelah operasi atau patah tulang. | A metal plate on the jaw, usually after surgery or fracture. |
| 27 | wire | `wire` | treatment | Kawat | Wire | Kawat ortodonti atau fiksasi rahang. | An orthodontic or jaw fixation wire. |
| 28 | Cyst | `cyst` | attention | Kista | Cyst | Rongga berisi cairan di tulang rahang. | A fluid-filled cavity in the jawbone. |
| 29 | Root resorption | `root_resorption` | attention | Resorpsi akar | Root resorption | Akar gigi memendek karena terkikis dari dalam atau luar. | A root that has shortened as it is worn away. |
| 30 | Primary teeth | `primary_teeth` | anatomy | Gigi susu | Baby teeth | Gigi anak yang nantinya diganti gigi permanen. | Children's teeth that are later replaced. |

Penjelasan ini **Inferensi engineering** dari istilah kedokteran gigi umum. Pemilik repo (yang paham dataset) mereview sebelum M2 selesai.
