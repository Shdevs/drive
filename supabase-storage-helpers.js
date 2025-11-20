const supabase = require('./supabase');

// Supabase Storage bucket isimleri
const BUCKETS = {
    FILES: 'files',
    AVATARS: 'avatars'
};

/**
 * Bucket'ların var olup olmadığını kontrol et
 * NOT: Bucket oluşturma işlemi service role key gerektirir
 * Bu fonksiyon sadece kontrol eder
 */
async function ensureBucketsExist() {
    try {
        let allBucketsExist = true;
        
        // files bucket kontrolü
        const { data: filesBucket, error: filesError } = await supabase.storage
            .from(BUCKETS.FILES)
            .list('', { limit: 1 });
        
        if (filesError && filesError.message.includes('not found')) {
            console.error('\n❌ HATA: files bucket bulunamadı!');
            console.error('   Bucket oluşturmak için:');
            console.error('   1. Supabase Dashboard > Storage > New bucket');
            console.error('      - Name: files');
            console.error('      - ✅ Public bucket (checkbox işaretli)');
            console.error('      - File size limit: 52428800 (50MB)');
            console.error('   2. Veya: npm run setup-storage (Service Role Key gerekir)');
            console.error('   Detaylı talimatlar: STORAGE_QUICK_SETUP.md\n');
            allBucketsExist = false;
        } else if (!filesError) {
            console.log('✅ files bucket mevcut');
        }
        
        // avatars bucket kontrolü
        const { data: avatarsBucket, error: avatarsError } = await supabase.storage
            .from(BUCKETS.AVATARS)
            .list('', { limit: 1 });
        
        if (avatarsError && avatarsError.message.includes('not found')) {
            console.error('\n❌ HATA: avatars bucket bulunamadı!');
            console.error('   Bucket oluşturmak için:');
            console.error('   1. Supabase Dashboard > Storage > New bucket');
            console.error('      - Name: avatars');
            console.error('      - ✅ Public bucket (checkbox işaretli)');
            console.error('      - File size limit: 5242880 (5MB)');
            console.error('      - Allowed MIME types: image/jpeg,image/png,image/gif,image/webp');
            console.error('   2. Veya: npm run setup-storage (Service Role Key gerekir)');
            console.error('   Detaylı talimatlar: STORAGE_QUICK_SETUP.md\n');
            allBucketsExist = false;
        } else if (!avatarsError) {
            console.log('✅ avatars bucket mevcut');
        }
        
        return allBucketsExist;
    } catch (err) {
        console.error('Error checking buckets:', err);
        return false;
    }
}

// Uygulama başlarken bucket'ları kontrol et (sadece bilgilendirme)
ensureBucketsExist().then(exists => {
    if (exists) {
        console.log('✅ Supabase Storage bucket\'ları hazır\n');
    } else {
        console.error('\n⚠️  UYARI: Supabase Storage bucket\'ları eksik!');
        console.error('   Dosya yükleme işlemleri çalışmayacak.\n');
    }
}).catch(err => {
    console.error('Error checking buckets:', err);
});

/**
 * Dosyayı Supabase Storage'a yükle
 * @param {string} userId - Kullanıcı ID
 * @param {string} filePath - Dosya yolu (örn: 'folder1/file.txt')
 * @param {Buffer} fileBuffer - Dosya buffer'ı
 * @param {string} contentType - MIME type (örn: 'image/png')
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
async function uploadFileToStorage(userId, filePath, fileBuffer, contentType = 'application/octet-stream') {
    try {
        // Önce bucket'ın var olduğundan emin ol
        await ensureBucketsExist();
        
        const storagePath = `${userId}/${filePath}`;
        
        const { data, error } = await supabase.storage
            .from(BUCKETS.FILES)
            .upload(storagePath, fileBuffer, {
                contentType: contentType,
                upsert: true // Aynı dosya varsa üzerine yaz
            });
        
        if (error) {
            console.error('Error uploading file to Supabase Storage:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            
            // Daha detaylı hata mesajı
            let errorMessage = error.message || 'Bilinmeyen hata';
            
            if (error.message && error.message.includes('not found')) {
                errorMessage = 'Bucket bulunamadı. Lütfen Supabase Dashboard\'dan "files" bucket\'ının oluşturulduğundan ve public olduğundan emin olun.';
            } else if (error.message && error.message.includes('new row violates row-level security')) {
                errorMessage = 'Bucket erişim izni yok. Bucket\'ın public olduğundan emin olun.';
            } else if (error.message && error.message.includes('permission denied')) {
                errorMessage = 'Bucket\'a yazma izni yok. Bucket\'ın public olduğundan emin olun.';
            }
            
            return { success: false, error: errorMessage };
        }
        
        console.log('File uploaded to Supabase Storage:', storagePath);
        return { success: true, path: storagePath };
    } catch (err) {
        console.error('Exception in uploadFileToStorage:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Supabase Storage'dan dosya indir
 * @param {string} storagePath - Storage path (örn: 'userId/folder1/file.txt')
 * @returns {Promise<{success: boolean, data?: Buffer, error?: string}>}
 */
async function downloadFileFromStorage(storagePath) {
    try {
        const { data, error } = await supabase.storage
            .from(BUCKETS.FILES)
            .download(storagePath);
        
        if (error) {
            console.error('Error downloading file from Supabase Storage:', error);
            return { success: false, error: error.message };
        }
        
        // Convert Blob to Buffer
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        return { success: true, data: buffer };
    } catch (err) {
        console.error('Exception in downloadFileFromStorage:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Supabase Storage'dan dosya sil
 * @param {string} storagePath - Storage path
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteFileFromStorage(storagePath) {
    try {
        const { error } = await supabase.storage
            .from(BUCKETS.FILES)
            .remove([storagePath]);
        
        if (error) {
            console.error('Error deleting file from Supabase Storage:', error);
            return { success: false, error: error.message };
        }
        
        console.log('File deleted from Supabase Storage:', storagePath);
        return { success: true };
    } catch (err) {
        console.error('Exception in deleteFileFromStorage:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Avatar'ı Supabase Storage'a yükle
 * @param {string} userId - Kullanıcı ID
 * @param {Buffer} avatarBuffer - Avatar buffer'ı
 * @param {string} contentType - MIME type (örn: 'image/png')
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
async function uploadAvatarToStorage(userId, avatarBuffer, contentType = 'image/png') {
    try {
        // Önce bucket'ın var olduğundan emin ol
        await ensureBucketsExist();
        
        // Ext'i content type'dan veya default olarak al
        let ext = 'png';
        if (contentType.includes('jpeg') || contentType.includes('jpg')) {
            ext = 'jpg';
        } else if (contentType.includes('gif')) {
            ext = 'gif';
        } else if (contentType.includes('webp')) {
            ext = 'webp';
        }
        
        const storagePath = `${userId}/avatar.${ext}`;
        
        const { data, error } = await supabase.storage
            .from(BUCKETS.AVATARS)
            .upload(storagePath, avatarBuffer, {
                contentType: contentType,
                upsert: true
            });
        
        if (error) {
            console.error('Error uploading avatar to Supabase Storage:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            
            // Daha detaylı hata mesajı
            let errorMessage = error.message || 'Bilinmeyen hata';
            
            if (error.message && error.message.includes('not found')) {
                errorMessage = 'Bucket bulunamadı. Lütfen Supabase Dashboard\'dan "avatars" bucket\'ının oluşturulduğundan ve public olduğundan emin olun.';
            } else if (error.message && error.message.includes('new row violates row-level security')) {
                errorMessage = 'Bucket erişim izni yok. Bucket\'ın public olduğundan emin olun.';
            } else if (error.message && error.message.includes('permission denied')) {
                errorMessage = 'Bucket\'a yazma izni yok. Bucket\'ın public olduğundan emin olun.';
            }
            
            return { success: false, error: errorMessage };
        }
        
        console.log('Avatar uploaded to Supabase Storage:', storagePath);
        return { success: true, path: storagePath };
    } catch (err) {
        console.error('Exception in uploadAvatarToStorage:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Avatar'ı Supabase Storage'dan indir
 * @param {string} storagePath - Storage path
 * @returns {Promise<{success: boolean, data?: Buffer, error?: string}>}
 */
async function downloadAvatarFromStorage(storagePath) {
    try {
        const { data, error } = await supabase.storage
            .from(BUCKETS.AVATARS)
            .download(storagePath);
        
        if (error) {
            console.error('Error downloading avatar from Supabase Storage:', error);
            return { success: false, error: error.message };
        }
        
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        return { success: true, data: buffer };
    } catch (err) {
        console.error('Exception in downloadAvatarFromStorage:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Avatar'ı Supabase Storage'dan sil
 * @param {string} storagePath - Storage path
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteAvatarFromStorage(storagePath) {
    try {
        const { error } = await supabase.storage
            .from(BUCKETS.AVATARS)
            .remove([storagePath]);
        
        if (error) {
            console.error('Error deleting avatar from Supabase Storage:', error);
            return { success: false, error: error.message };
        }
        
        console.log('Avatar deleted from Supabase Storage:', storagePath);
        return { success: true };
    } catch (err) {
        console.error('Exception in deleteAvatarFromStorage:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Public URL al (signed URL yerine public bucket için)
 * @param {string} bucket - Bucket adı
 * @param {string} storagePath - Storage path
 * @returns {string} Public URL
 */
function getPublicUrl(bucket, storagePath) {
    const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(storagePath);
    
    return data.publicUrl;
}

module.exports = {
    uploadFileToStorage,
    downloadFileFromStorage,
    deleteFileFromStorage,
    uploadAvatarToStorage,
    downloadAvatarFromStorage,
    deleteAvatarFromStorage,
    getPublicUrl,
    ensureBucketsExist,
    BUCKETS
};

