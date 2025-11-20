# Supabase Storage Bucket Kurulumu

## ⚠️ ÖNEMLİ: Bucket'ları Oluşturmanız Gerekiyor!

"Bucket not found" hatası alıyorsanız, bucket'ları oluşturmanız gerekiyor.

## Yöntem 1: Setup Script ile Otomatik Kurulum (Kolay)

### 1. Service Role Key Alın

1. Supabase Dashboard'a gidin: https://supabase.com/dashboard
2. Projenizi seçin
3. **Settings** > **API** sekmesine gidin
4. **service_role** key'i kopyalayın (⚠️ Bu key'i güvenli tutun, public'te paylaşmayın!)

### 2. Environment Variable Olarak Ayarlayın

**Windows (PowerShell):**
```powershell
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

**Windows (Command Prompt):**
```cmd
set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Linux/Mac:**
```bash
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

### 3. Setup Script'ini Çalıştırın

```bash
npm run setup-storage
```

veya

```bash
node setup-storage-buckets.js
```

## Yöntem 2: Supabase Dashboard Üzerinden Manuel Kurulum

### 1. Supabase Dashboard'a Gidin

1. https://supabase.com/dashboard
2. Projenizi seçin
3. Sol menüden **Storage** sekmesine gidin

### 2. `files` Bucket'ı Oluşturun

1. **New bucket** butonuna tıklayın
2. Ayarlar:
   - **Name**: `files`
   - **Public bucket**: ✅ **AÇIK** (checkbox'ı işaretleyin)
   - **File size limit**: `52428800` (50MB)
   - **Allowed MIME types**: Boş bırakın (tüm dosya tiplerine izin verir)
3. **Create bucket** butonuna tıklayın

### 3. `avatars` Bucket'ı Oluşturun

1. **New bucket** butonuna tıklayın
2. Ayarlar:
   - **Name**: `avatars`
   - **Public bucket**: ✅ **AÇIK** (checkbox'ı işaretleyin)
   - **File size limit**: `5242880` (5MB)
   - **Allowed MIME types**: `image/jpeg,image/png,image/gif,image/webp`
3. **Create bucket** butonuna tıklayın

## Kurulumu Doğrulama

Bucket'ları oluşturduktan sonra:

1. Uygulamanızı yeniden başlatın: `npm start`
2. Console'da şu mesajı görmelisiniz:
   ```
   ✅ files bucket zaten mevcut
   ✅ avatars bucket zaten mevcut
   ```
3. Bir dosya veya avatar yüklemeyi deneyin - artık çalışmalı!

## Sorun Giderme

### "Bucket not found" hatası devam ediyor mu?

1. Bucket isimlerini kontrol edin:
   - `files` (tam olarak küçük harfle)
   - `avatars` (tam olarak küçük harfle)

2. Bucket'ların **public** olduğundan emin olun

3. Supabase Dashboard > Storage'dan bucket'ları kontrol edin

4. Uygulamayı yeniden başlatın

### Service Role Key Bulamıyor musunuz?

1. Supabase Dashboard > Settings > API
2. **service_role** key'i görmüyorsanız, **Reveal** butonuna tıklayın
3. Key'i kopyalayın ve güvenli bir yerde saklayın

