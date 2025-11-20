/**
 * Bucket Permission Fix Script
 * Bucket'ların public olduğundan emin olur
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

async function fixBucketPermissions() {
    console.log('=== Bucket İzinlerini Kontrol Ediliyor ===\n');
    
    // 1. files bucket kontrolü
    console.log('1. files bucket kontrol ediliyor...');
    try {
        const { data: filesBucket, error: filesError } = await supabase.storage
            .from('files')
            .list('', { limit: 1 });
        
        if (filesError && filesError.message.includes('not found')) {
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
        } else if (filesError) {
            console.error('   ❌ HATA:', filesError.message);
        } else {
            console.log('   ✅ files bucket erişilebilir');
        }
    } catch (err) {
        console.error('   ❌ HATA:', err.message);
    }
    
    // 2. avatars bucket kontrolü
    console.log('\n2. avatars bucket kontrol ediliyor...');
    try {
        const { data: avatarsBucket, error: avatarsError } = await supabase.storage
            .from('avatars')
            .list('', { limit: 1 });
        
        if (avatarsError && avatarsError.message.includes('not found')) {
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
        } else if (avatarsError) {
            console.error('   ❌ HATA:', avatarsError.message);
        } else {
            console.log('   ✅ avatars bucket erişilebilir');
        }
    } catch (err) {
        console.error('   ❌ HATA:', err.message);
    }
    
    // 3. Anon key ile test
    console.log('\n3. Anon key ile erişim test ediliyor...');
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93dHB3bndpbnBsdXB0cnpwd3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjM3MjgsImV4cCI6MjA3OTE5OTcyOH0.pMyu6ad1KCB2WmhlfGcm5yayzoLLhTFDmX6XMzZjUEw';
    const anonSupabase = createClient(supabaseUrl, anonKey);
    
    try {
        const { data: testFiles, error: testError } = await anonSupabase.storage
            .from('files')
            .list('', { limit: 1 });
        
        if (testError) {
            console.error('   ⚠️  UYARI: Anon key ile files bucket erişilemiyor:', testError.message);
            console.error('   Bu normal olabilir, public bucket olsa bile RLS politikaları gerekebilir.');
        } else {
            console.log('   ✅ Anon key ile files bucket erişilebilir');
        }
    } catch (err) {
        console.error('   ❌ HATA:', err.message);
    }
    
    console.log('\n=== Kontrol Tamamlandı ===');
    console.log('\n📝 NOT: Eğer hala "Bucket not found" hatası alıyorsanız:');
    console.log('   1. Supabase Dashboard > Storage > files bucket > Settings');
    console.log('      - Public bucket checkbox\'ının işaretli olduğundan emin olun');
    console.log('   2. Supabase Dashboard > Storage > avatars bucket > Settings');
    console.log('      - Public bucket checkbox\'ının işaretli olduğundan emin olun');
    console.log('   3. Uygulamayı yeniden başlatın: npm start');
}

fixBucketPermissions();

