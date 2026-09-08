# v0.4 tarayıcı kontrolü — 7 Eylül 2026

CUA ile uygulamanın gerçek kontrolleri kullanıldı. Ayrı `127.0.0.1:17871` origin'i, kullanıcının `17870` oturumunu değiştirmeden test edildi.

- 20 Gypsy’s Fragment hazırlandı ve Transmute çalıştırıldı. Cube’da tek Gypsy’s Prophecy oluştu; envanter boş kaldı. Sayaçlar: 1 craft, 20 malzeme, 1 sonuç.
- İkinci birleşim mevcut Prophecy yığınını 2 adede çıkardı. Geri al, yığını 1 adede döndürdü ve 20 fragmenti geri getirdi; diğer Cube eşyaları korundu.
- Add Sockets tarifinde yedi Perfect gem'in adı ve ikonu görüldü. Perfect Ruby seçilip malzemeler hazırlandığında Cube’a 2 Hel ve 1 Perfect Ruby eklendi. Sayısal malzeme kimliği gösterilmedi.
- Mouse Gypsy’s Prophecy üzerine taşınınca kullanım açıklaması ve lore içeren kart açıldı. Mouse Cube’daki Harlequinn’s Crest üzerine taşınınca SS tier ve yedi stat değeri göründü; inceleme tıklaması gerekmedi.
- Katalogda Harlequinn’s Crest klavye odağıyla aynı stat kartını açtı. Kart modal pencerenin önündeydi (`:popover-open`).
- Açıklama kartı ekran sınırları içindeydi; yatay sayfa taşması, yüklenmeyen görsel veya tarayıcı error kaydı yoktu.

`npm test` tüm mekanik, workshop, Item Editor referans ve 8 Cube deneyimi testini geçti. Son UI düzenlemesinden sonra `npm run check` ve Cube deneyimi testleri tekrar geçti. Güncel oyunla tam mekanik eşitliği bu kontrollerin kapsamı değildir.
