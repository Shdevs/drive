/**
 * Bucket Erişim Test Script
 * Anon key ile bucket'lara erişimi test eder
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://owtpwnwinpluptrzpwzv.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93dHB3bndpbnBsdXB0cnpwd3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjM3MjgsImV4cCI6MjA3OTE5OTcyOH0.pMyu6ad1KCB2WmhlfGcm5yayzoLLhTFDmX6XMzZjUEw';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93dHB3bndpbnBsdXB0cnpwd3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzYyMzcyOCwiZXhwIjoyMDc5MTk5NzI4fQ.ClZ8JsEBYljMBdr_95_eVMP0Baijb2WwM6qlO686U9Y';

const anonSupabase = createClient(supabaseUrl, anonKey);
const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

async function testBucketAccess() {
    console.log('=== Bucket Erişim Testi ===\n');
    
    // Tüm bucket'ları listele (admin ile)
    console.log('1. Tüm bucket\'lar listeleniyor (admin)...');
    try {
        const { data: buckets, error } = await adminSupabase.storage.listBuckets();
        
        if (error) {
            console.error('   ❌ HATA:', error.message);
        } else {
            console.log('   ✅ Bulunan bucket\'lar:');
            buckets.forEach(bucket => {
                console.log(`      - ${bucket.name} (public: ${bucket.public ? '✅' : '❌'})`);
            });
        }
    } catch (err) {
        console.error('   ❌ HATA:', err.message);
    }
    
    // files bucket test (anon)
    console.log('\n2. files bucket erişim testi (anon key)...');
    try {
        const { data, error } = await anonSupabase.storage
            .from('files')
            .list('', { limit: 1 });
        
        if (error) {
            console.error('   ❌ HATA:', error.message);
            console.error('   ❌ Detay:', JSON.stringify(error, null, 2));
        } else {
            console.log('   ✅ files bucket erişilebilir');
        }
    } catch (err) {
        console.error('   ❌ HATA:', err.message);
    }
    
    // avatars bucket test (anon)
    console.log('\n3. avatars bucket erişim testi (anon key)...');
    try {
        const { data, error } = await anonSupabase.storage
            .from('avatars')
            .list('', { limit: 1 });
        
        if (error) {
            console.error('   ❌ HATA:', error.message);
            console.error('   ❌ Detay:', JSON.stringify(error, null, 2));
        } else {
            console.log('   ✅ avatars bucket erişilebilir');
        }
    } catch (err) {
        console.error('   ❌ HATA:', err.message);
    }
    
    // files bucket public kontrolü (admin)
    console.log('\n4. files bucket public durumu kontrol ediliyor (admin)...');
    try {
        const { data: buckets, error } = await adminSupabase.storage.listBuckets();
        if (!error && buckets) {
            const filesBucket = buckets.find(b => b.name === 'files');
            if (filesBucket) {
                console.log(`   files bucket public: ${filesBucket.public ? '✅' : '❌'}`);
                if (!filesBucket.public) {
                    console.log('   ⚠️  UYARI: files bucket public değil! Public yapılması gerekiyor.');
                }
            }
        }
    } catch (err) {
        console.error('   ❌ HATA:', err.message);
    }
    
    // avatars bucket public kontrolü (admin)
    console.log('\n5. avatars bucket public durumu kontrol ediliyor (admin)...');
    try {
        const { data: buckets, error } = await adminSupabase.storage.listBuckets();
        if (!error && buckets) {
            const avatarsBucket = buckets.find(b => b.name === 'avatars');
            if (avatarsBucket) {
                console.log(`   avatars bucket public: ${avatarsBucket.public ? '✅' : '❌'}`);
                if (!avatarsBucket.public) {
                    console.log('   ⚠️  UYARI: avatars bucket public değil! Public yapılması gerekiyor.');
                }
            }
        }
    } catch (err) {
        console.error('   ❌ HATA:', err.message);
    }
    
    console.log('\n=== Test Tamamlandı ===');
}

testBucketAccess();

