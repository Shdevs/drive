# 🚀 Supabase Storage Bucket Hızlı Kurulum

## "Bucket not found" Hatası mı Alıyorsunuz?

Bucket'ları oluşturmanız gerekiyor. İki yöntem var:

---

## ⚡ YÖNTEM 1: Supabase Dashboard (Kolay - Önerilen)

### Adım 1: Supabase Dashboard'a Gidin

1. https://supabase.com/dashboard adresine gidin
2. Projenizi seçin: **Drive**
3. Sol menüden **Storage** sekmesine tıklayın

### Adım 2: `files` Bucket'ı Oluşturun

1. **New bucket** butonuna tıklayın
2. Şu ayarları yapın:
   ```
   Name: files
   ✅ Public bucket (checkbox'ı işaretleyin!)
   File size limit: 52428800
   Allowed MIME types: (boş bırakın)
   ```
3. **Create bucket** butonuna tıklayın

### Adım 3: `avatars` Bucket'ı Oluşturun

1. **New bucket** butonuna tıklayın
2. Şu ayarları yapın:
   ```
   Name: avatars
   ✅ Public bucket (checkbox'ı işaretleyin!)
   File size limit: 5242880
   Allowed MIME types: image/jpeg,image/png,image/gif,image/webp
   ```
3. **Create bucket** butonuna tıklayın

### Adım 4: Test Edin

1. Uygulamanızı yeniden başlatın: `npm start`
2. Bir dosya veya avatar yüklemeyi deneyin - artık çalışmalı! ✅

---

## 🔧 YÖNTEM 2: Setup Script (Gelişmiş)

Service Role Key'iniz varsa, otomatik kurulum yapabilirsiniz:

1. **Service Role Key alın:**
   - Supabase Dashboard > Settings > API > service_role key

2. **Environment variable ayarlayın:**
   ```bash
   # Windows (PowerShell)
   $env:SUPABASE_SERVICE_ROLE_KEY="your-key-here"
   
   # Windows (CMD)
   set SUPABASE_SERVICE_ROLE_KEY=your-key-here
   
   # Linux/Mac
   export SUPABASE_SERVICE_ROLE_KEY="your-key-here"
   ```

3. **Setup script'ini çalıştırın:**
   ```bash
   npm run setup-storage
   ```

---

## ✅ Kontrol

Uygulama başladığında console'da şunu görmelisiniz:

```
✅ files bucket mevcut
✅ avatars bucket mevcut
✅ Supabase Storage bucket'ları hazır
```

---

## ⚠️ Sorun mu Var?

- **Bucket isimleri tam olarak** `files` ve `avatars` olmalı (küçük harfle)
- **Public bucket** checkbox'ı **mutlaka işaretli** olmalı
- Uygulamayı **yeniden başlatın** bucket'ları oluşturduktan sonra

