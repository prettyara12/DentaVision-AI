# Class Catalog

31 kelas dari `model.names` di `best_resnet50.pt`. `id` adalah indeks di model dan **tidak boleh diubah urutannya**.

Kelompok:

| Kode | Label UI (ID / EN) | Warna token | Tampil default |
|---|---|---|---|
| `attention` | Perlu perhatian / Needs attention | `--finding-attention` | Ya |
| `treatment` | Perawatan & alat / Treatment & appliances | `--finding-treatment` | Ya |
| `anatomy` | Anatomi normal / Normal anatomy | `--finding-anatomy` | Tidak |

Data per kelas (id, `model.names`, `key`, kelompok, nama dan penjelasan singkat ID/EN) ada di [`web/src/features/scan/class-catalog.ts`](../web/src/features/scan/class-catalog.ts), satu-satunya sumber sejak #10. Tes `scan-logic.test.ts` memastikan urutannya sama dengan `model.names`.

Penjelasan ini **Inferensi engineering** dari istilah kedokteran gigi umum. Pemilik repo (yang paham dataset) mereview sebelum M2 selesai.
