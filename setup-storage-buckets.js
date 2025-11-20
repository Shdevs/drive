/**
 * Supabase Storage Bucket Setup Script
 * Bu script'i bir kez çalıştırarak gerekli bucket'ları oluşturabilirsiniz
 * 
 * Kullanım: node setup-storage-buckets.js
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://owtpwnwinpluptrzpwzv.supabase.co';
// Service Role Key
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93dHB3bndpbnBsdXB0cnpwd3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzYyMzcyOCwiZXhwIjoyMDc5MTk5NzI4fQ.ClZ8JsEBYljMBdr_95_eVMP0Baijb2WwM6qlO686U9Y';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function setupBuckets() {
    console.log('=== Supabase Storage Bucket Kurulumu ===\n');
    
    // 1. files bucket oluştur
    console.log('1. files bucket kontrol ediliyor...');
    try {
        const { data: filesList, error: filesError } = await supabase.storage
            .from('files')
            .list('', { limit: 1 });
        
        if (filesError && filesError.message.includes('not found')) {
            console.log('   files bucket bulunamadı, oluşturuluyor...');
            const { data, error } = await supabase.storage.createBucket('files', {
                public: true,
                fileSizeLimit: 52428800, // 50MB
                allowedMimeTypes: null // Tüm dosya tiplerine izin ver
            });
            
            if (error) {
                console.error('   ❌ HATA: files bucket oluşturulamadı:', error.message);
            } else {
                console.log('   ✅ files bucket başarıyla oluşturuldu!');
            }
        } else if (filesError) {
            console.error('   ❌ HATA:', filesError.message);
        } else {
            console.log('   ✅ files bucket zaten mevcut');
        }
    } catch (err) {
        console.error('   ❌ HATA:', err.message);
    }
    
    // 2. avatars bucket oluştur
    console.log('\n2. avatars bucket kontrol ediliyor...');
    try {
        const { data: avatarsList, error: avatarsError } = await supabase.storage
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
                console.error('   ❌ HATA: avatars bucket oluşturulamadı:', error.message);
            } else {
                console.log('   ✅ avatars bucket başarıyla oluşturuldu!');
            }
        } else if (avatarsError) {
            console.error('   ❌ HATA:', avatarsError.message);
        } else {
            console.log('   ✅ avatars bucket zaten mevcut');
        }
    } catch (err) {
        console.error('   ❌ HATA:', err.message);
    }
    
    console.log('\n=== Kurulum tamamlandı ===');
}

setupBuckets();

