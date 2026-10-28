# Catatan format FMF dan keselamatan data

## Header yang terdeteksi

Pada file sampel `Tato.fmf`, byte awalnya adalah `02 01 66 6d 66 2e` (`02 01 fmf.`). Sampel memiliki rentang teks yang terlihat sejak offset 26 dan juga data biner/penanda `28 b5 2f fd` yang merupakan signature frame Zstandard. Ini menunjukkan file mengandung campuran data dan tidak aman diperlakukan sebagai satu dokumen XML biasa.

## Apa yang dilakukan parser

Parser membaca byte file, memindai rentang byte yang tampak seperti teks, mencari signature umum PNG/JPEG/GIF/WebP/BMP, dan menandai signature Zstandard. Offset asli disimpan untuk navigasi dan ekspor. Ini adalah heuristik; hasil deteksi bukan daftar resource resmi dari indeks FMF.

## Pengeditan

Teks hanya boleh diterapkan jika hasil encoding UTF-8 sama persis jumlah byte-nya dengan rentang semula. Tujuannya menjaga offset berikutnya tetap. Namun, panjang byte yang sama **tidak** menjamin data semantik atau struktur kontainer tetap valid. Jangan edit bagian yang tidak dipahami.

## Yang belum didukung

- Pembacaan indeks resource FMF lengkap untuk semua versi Football Manager.
- Dekompresi Zstandard dalam browser dan pemetaan isi hasil dekompresi ke entri kontainer.
- Penulisan ulang indeks/offset/checksum saat ukuran resource berubah.
- Penggantian gambar, pengemasan ulang, dan validasi oleh game.

## Rekomendasi

Simpan file asli sebagai cadangan, ekspor ke file baru, uji hanya pada salinan, dan pastikan jenis FMF cocok dengan versi Football Manager yang digunakan. Untuk dukungan pengemasan ulang yang benar, perlu spesifikasi/implementasi parser untuk varian FMF yang tepat dan pengujian dengan file nyata.
