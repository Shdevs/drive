# Supabase Storage Kurulum Rehberi

Bu proje artık Supabase Storage kullanarak dosyaları ve avatar'ları saklıyor.

## Gerekli Adımlar

### 1. Supabase Dashboard'da Storage Bucket'ları Oluşturun

1. Supabase Dashboard'a gidin: https://supabase.com/dashboard
2. Projenizi seçin
3. Sol menüden **Storage** sekmesine gidin
4. **New bucket** butonuna tıklayın

#### `files` Bucket'ı Oluşturun:
- **Name**: `files`
- **Public bucket**: ✅ **AÇIK** (dosyalar public erişilebilir olmalı)
- **File size limit**: İstediğiniz maksimum dosya boyutu (örn: 100MB)
- **Allowed MIME types**: Boş bırakın (tüm dosya tiplerine izin verir)

#### `avatars` Bucket'ı Oluşturun:
- **Name**: `avatars`
- **Public bucket**: ✅ **AÇIK** (avatar'lar public erişilebilir olmalı)
- **File size limit**: 5MB (avatar'lar için yeterli)
- **Allowed MIME types**: `image/jpeg,image/png,image/gif,image/webp`

### 2. Storage Policies Ayarlayın

Her bucket için RLS (Row Level Security) politikaları ayarlayın:

#### `files` Bucket için:
```sql
-- Kullanıcılar sadece kendi dosyalarını görebilir
CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Kullanıcılar sadece kendi dosyalarını yükleyebilir
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Kullanıcılar sadece kendi dosyalarını silebilir
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);
```

#### `avatars` Bucket için:
```sql
-- Kullanıcılar sadece kendi avatar'larını görebilir
CREATE POLICY "Users can view their own avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Kullanıcılar sadece kendi avatar'larını yükleyebilir
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Kullanıcılar sadece kendi avatar'larını silebilir
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
```

**NOT**: Bu projede Supabase Auth kullanılmıyor, bu yüzden RLS politikaları çalışmayabilir. Alternatif olarak:

1. Bucket'ları **public** yapın (zaten public yaptık)
2. Veya service role key kullanarak tüm işlemleri backend'den yapın (şu anki durum)

### 3. Database Schema Güncellemesi

`files` tablosuna `storage_path` kolonu ekleyin:

```sql
ALTER TABLE files ADD COLUMN IF NOT EXISTS storage_path TEXT;
```

Bu kolon Supabase Storage'daki dosya path'ini saklar (örn: `userId/folder1/file.txt`).

### 4. Test

1. Bir dosya yükleyin - Supabase Storage'a kaydedilmeli
2. Bir avatar yükleyin - Supabase Storage'a kaydedilmeli
3. Dosya indirin - Supabase Storage'dan indirilmeli
4. Dosya silin - Supabase Storage'dan silinmeli

## Avantajlar

✅ **Production-ready**: Disk yazma sorunları yok
✅ **Scalable**: Sınırsız depolama (Supabase planınıza göre)
✅ **CDN**: Supabase Storage CDN kullanıyor, hızlı erişim
✅ **Backup**: Otomatik yedekleme
✅ **Güvenlik**: RLS politikaları ile güvenli

## Notlar

- Eski dosyalar hala disk'te olabilir (backward compatibility)
- Yeni yüklenen dosyalar artık Supabase Storage'da
- Avatar'lar artık Supabase Storage'da
- Public bucket'lar olduğu için dosyalara direkt URL ile erişilebilir

