# Supabase Migration Guide

Bu proje JSON dosya tabanlı depolamadan Supabase veritabanına taşınmıştır.

## Yapılan Değişiklikler

### 1. Veritabanı Şeması
Supabase'de aşağıdaki tablolar oluşturulmalıdır:
- `users` - Kullanıcı bilgileri
- `files` - Dosya metadata'sı
- `folders` - Klasör metadata'sı
- `payment_requests` - Ödeme istekleri

Şema dosyası: `supabase-schema.sql`

### 2. Kurulum

1. Supabase SQL Editor'de `supabase-schema.sql` dosyasını çalıştırın
2. Supabase proje bilgileri `supabase.js` dosyasında yapılandırılmıştır:
   - Project URL: https://owtpwnwinpluptrzpwzv.supabase.co
   - API Key: (anon key kullanılıyor)

### 3. Dosya Depolama
- Dosyalar hala disk'te (`data/{username}/`) saklanıyor
- Sadece metadata (isim, path, boyut, tarih vb.) Supabase'de tutuluyor

### 4. Migration Script
Mevcut JSON verilerini Supabase'e taşımak için `migrate-to-supabase.js` script'ini kullanın:

```bash
node migrate-to-supabase.js
```

## Kalan Görevler

Aşağıdaki endpoint'ler henüz Supabase'e taşınmadı:
- `/rename` - Dosya adı değiştirme
- `/star` - Dosya yıldızlama
- `/move-file` - Dosya taşıma
- `/create-folder` - Klasör oluşturma
- `/delete-folder` - Klasör silme
- `/restore-folder` - Klasör geri yükleme
- `/rename-folder` - Klasör adı değiştirme
- `/star-folder` - Klasör yıldızlama
- `/submit-payment` - Ödeme isteği gönderme
- `/approve-payment` - Ödeme onaylama
- `/reject-payment` - Ödeme reddetme
- `/update-username` - Kullanıcı adı güncelleme
- `/update-phone` - Telefon güncelleme
- `/update-avatar` - Avatar güncelleme
- `/request-password-change` - Şifre değiştirme isteği
- `/verify-password-change` - Şifre değiştirme doğrulama
- `/request-email-change` - Email değiştirme isteği
- `/verify-email-change` - Email değiştirme doğrulama

## Önemli Notlar

1. **Session Management**: `req.session.userId` artık Supabase user ID'sini içeriyor
2. **User Data Format**: `formatUserForSession()` fonksiyonu eski formatı koruyor
3. **File Storage**: Dosyalar hala disk'te saklanıyor, sadece metadata Supabase'de
4. **Backward Compatibility**: Eski JSON formatıyla uyumlu format dönüşümleri yapılıyor

