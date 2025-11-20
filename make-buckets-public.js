/**
 * Bucket'ları Public Yap ve RLS Politikalarını Ayarla
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://owtpwnwinpluptrzpwzv.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93dHB3bndpbnBsdXB0cnpwd3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzYyMzcyOCwiZXhwIjoyMDc5MTk5NzI4fQ.ClZ8JsEBYljMBdr_95_eVMP0Baijb2WwM6qlO686U9Y';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function makeBucketsPublic() {
    console.log('=== Bucket\'ları Public Yapıyoruz ===\n');
    
    // 1. files bucket'ı public yap
    console.log('1. files bucket kontrol ediliyor ve public yapılıyor...');
    try {
        // Önce bucket'ı bul
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (listError) {
            console.error('   ❌ Bucket listesi alınamadı:', listError.message);
            return;
        }
        
        const filesBucket = buckets.find(b => b.name === 'files');
        
        if (!filesBucket) {
            console.log('   files bucket bulunamadı, oluşturuluyor...');
            const { data, error } = await supabase.storage.createBucket('files', {
                public: true,
                fileSizeLimit: 52428800, // 50MB
                allowedMimeTypes: null
            });
            
            if (error) {
                console.error('   ❌ HATA:', error.message);
            } else {
                console.log('   ✅ files bucket oluşturuldu ve public yapıldı!');
            }
        } else {
            console.log(`   files bucket bulundu (public: ${filesBucket.public ? '✅' : '❌'})`);
            
            if (!filesBucket.public) {
                // Bucket'ı güncelle (public yap)
                // Not: Supabase JS client'ında bucket'ı güncelleme yok, SQL ile yapılmalı
                console.log('   ⚠️  Bucket public değil. Supabase Dashboard\'dan manuel olarak public yapmanız gerekiyor.');
                console.log('      Storage > files bucket > Settings > Public bucket (checkbox)');
            } else {
                console.log('   ✅ files bucket zaten public');
            }
        }
    } catch (err) {
        console.error('   ❌ HATA:', err.message);
    }
    
    // 2. avatars bucket'ı public yap
    console.log('\n2. avatars bucket kontrol ediliyor ve public yapılıyor...');
    try {
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (listError) {
            console.error('   ❌ Bucket listesi alınamadı:', listError.message);
            return;
        }
        
        const avatarsBucket = buckets.find(b => b.name === 'avatars');
        
        if (!avatarsBucket) {
            console.log('   avatars bucket bulunamadı, oluşturuluyor...');
            const { data, error } = await supabase.storage.createBucket('avatars', {
                public: true,
                fileSizeLimit: 5242880, // 5MB
                allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
            });
            
            if (error) {
                console.error('   ❌ HATA:', error.message);
            } else {
                console.log('   ✅ avatars bucket oluşturuldu ve public yapıldı!');
            }
        } else {
            console.log(`   avatars bucket bulundu (public: ${avatarsBucket.public ? '✅' : '❌'})`);
            
            if (!avatarsBucket.public) {
                console.log('   ⚠️  Bucket public değil. Supabase Dashboard\'dan manuel olarak public yapmanız gerekiyor.');
                console.log('      Storage > avatars bucket > Settings > Public bucket (checkbox)');
            } else {
                console.log('   ✅ avatars bucket zaten public');
            }
        }
    } catch (err) {
        console.error('   ❌ HATA:', err.message);
    }
    
    // 3. Anon key ile test
    console.log('\n3. Anon key ile erişim test ediliyor...');
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93dHB3bndpbnBsdXB0cnpwd3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjM3MjgsImV4cCI6MjA3OTE5OTcyOH0.pMyu6ad1KCB2WmhlfGcm5yayzoLLhTFDmX6XMzZjUEw';
    const anonSupabase = createClient(supabaseUrl, anonKey);
    
    // files test
    try {
        const { data, error } = await anonSupabase.storage
            .from('files')
            .list('', { limit: 1 });
        
        if (error) {
            console.error('   ❌ files bucket anon key ile erişilemiyor:', error.message);
        } else {
            console.log('   ✅ files bucket anon key ile erişilebilir');
        }
    } catch (err) {
        console.error('   ❌ HATA:', err.message);
    }
    
    // avatars test
    try {
        const { data, error } = await anonSupabase.storage
            .from('avatars')
            .list('', { limit: 1 });
        
        if (error) {
            console.error('   ❌ avatars bucket anon key ile erişilemiyor:', error.message);
        } else {
            console.log('   ✅ avatars bucket anon key ile erişilebilir');
        }
    } catch (err) {
        console.error('   ❌ HATA:', err.message);
    }
    
    console.log('\n=== İşlem Tamamlandı ===');
    console.log('\n📝 EĞER BUCKET\'LAR PUBLIC DEĞİLSE:');
    console.log('   1. Supabase Dashboard > Storage > files bucket > Settings');
    console.log('      - "Public bucket" checkbox\'ını işaretleyin');
    console.log('   2. Supabase Dashboard > Storage > avatars bucket > Settings');
    console.log('      - "Public bucket" checkbox\'ını işaretleyin');
}

makeBucketsPublic();

