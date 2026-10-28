# FMF Studio — Football Manager Resource Explorer

Aplikasi web statis untuk memeriksa file `.fmf` Football Manager langsung di browser. Tidak ada server, upload, atau backend. Bisa di-host lewat GitHub Pages.

## Isi repository

- `index.html` — antarmuka aplikasi
- `assets/styles.css` — tampilan desktop dan Android
- `src/fmf-parser.js` — pemindai header, rentang teks, signature gambar, dan penanda Zstandard
- `src/app.js` — daftar resource, editor, riwayat, dan ekspor
- `manifest.json` — metadata PWA dasar
- `tests/parser-smoke.html` — tes pemindai dasar di browser
- `docs/FORMAT-NOTES.md` — batasan format dan keamanan ekspor

## Menjalankan

Bisa dibuka lokal dengan browser modern atau di-host di GitHub Pages. Tidak perlu API key dan tidak mengirim file ke server.

### GitHub Pages

1. Buat repository baru, misalnya `fmf-studio`.
2. Unggah seluruh isi folder ini (bukan folder pembungkusnya) ke root repository.
3. Buka **Settings → Pages**.
4. Pilih **Deploy from a branch**, branch `main`, folder `/(root)` lalu simpan.
5. Buka URL Pages yang diberikan GitHub.

## Fitur

- Pemindaian otomatis saat file dibuka
- Daftar bagian teks/XML, gambar yang dikenali, dan penanda kompresi
- Filter dan pencarian dalam bagian yang sudah dipindai
- Pratinjau gambar jika format dan batas resource bisa dikenali
- Edit rentang teks dengan perlindungan panjang byte yang sama
- Undo/Redo, batalkan semua perubahan, salin, ekspor bagian, ekspor file
- Mendukung file lokal besar sejauh memori browser memungkinkan

## Batasan penting

FMF adalah format proprietary dan struktur antarversi/jenis resource bisa berbeda. Ini merupakan **resource explorer konservatif**, bukan parser lengkap untuk setiap varian FMF. Ia tidak mengurai seluruh indeks kontainer, tidak mendekompresi blok Zstandard, dan tidak bisa menjamin file hasil edit akan diterima game. Untuk mencegah pergeseran offset, editor teks hanya menerima pengeditan dengan jumlah byte UTF-8 yang sama. Resource gambar hanya dipratinjau, belum diganti. Jangan gunakan pada satu-satunya salinan file.

Lihat `docs/FORMAT-NOTES.md` sebelum mengedit file penting.
