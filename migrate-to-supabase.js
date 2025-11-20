const fs = require('fs-extra');
const path = require('path');
const {
    getUserByUsername,
    createUser,
    createFile,
    createFolder,
    getFiles,
    getFolders
} = require('./supabase-helpers');

async function migrateData() {
    console.log('Migration başlatılıyor...');
    
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        console.log('Data dizini bulunamadı');
        return;
    }
    
    const users = fs.readdirSync(dataDir).filter(item => {
        const userPath = path.join(dataDir, item);
        return fs.statSync(userPath).isDirectory() && item !== 'payment-receipts';
    });
    
    console.log(`${users.length} kullanıcı bulundu`);
    
    for (const username of users) {
        console.log(`\nKullanıcı işleniyor: ${username}`);
        
        const userDir = path.join(dataDir, username);
        const userJsonPath = path.join(userDir, 'user.json');
        
        if (!fs.existsSync(userJsonPath)) {
            console.log(`  User.json bulunamadı: ${username}`);
            continue;
        }
        
        try {
            const userData = fs.readJsonSync(userJsonPath);
            
            // Check if user already exists in Supabase
            let user = await getUserByUsername(username);
            
            if (!user) {
                // Create user in Supabase
                console.log(`  Kullanıcı oluşturuluyor: ${username}`);
                user = await createUser({
                    username: userData.username || username,
                    password: userData.password || '',
                    email: userData.email || '',
                    phone: userData.phone || '',
                    maxStorage: userData.maxStorage || 2147483648,
                    avatar: userData.avatar || null,
                    emailVerified: userData.emailVerified || false,
                    status: userData.status || 'user'
                });
                
                if (!user) {
                    console.log(`  Hata: Kullanıcı oluşturulamadı: ${username}`);
                    continue;
                }
                
                // Update storage_used
                if (userData.storageUsed) {
                    await require('./supabase-helpers').updateUser(user.id, {
                        storage_used: userData.storageUsed
                    });
                }
            } else {
                console.log(`  Kullanıcı zaten var: ${username}`);
            }
            
            const userId = user.id;
            
            // Migrate files
            if (userData.files && userData.files.length > 0) {
                console.log(`  ${userData.files.length} dosya migrate ediliyor...`);
                
                const existingFiles = await getFiles(userId);
                const existingPaths = new Set(existingFiles.map(f => f.path));
                
                for (const file of userData.files) {
                    if (existingPaths.has(file.path)) {
                        continue; // Skip if already exists
                    }
                    
                    try {
                        await createFile(userId, {
                            name: file.name,
                            path: file.path,
                            size: file.size || 0,
                            uploadDate: file.uploadDate || new Date().toISOString(),
                            starred: file.starred || false,
                            deleted: file.deleted || false
                        });
                    } catch (error) {
                        console.log(`    Hata: Dosya oluşturulamadı: ${file.path} - ${error.message}`);
                    }
                }
                
                console.log(`  Dosyalar migrate edildi`);
            }
            
            // Migrate folders
            if (userData.folders && userData.folders.length > 0) {
                console.log(`  ${userData.folders.length} klasör migrate ediliyor...`);
                
                const existingFolders = await getFolders(userId);
                const existingPaths = new Set(existingFolders.map(f => f.path));
                
                for (const folder of userData.folders) {
                    if (existingPaths.has(folder.path)) {
                        continue; // Skip if already exists
                    }
                    
                    try {
                        await createFolder(userId, {
                            name: folder.name,
                            path: folder.path,
                            createdBy: folder.createdBy || username,
                            createdAt: folder.createdAt || new Date().toISOString(),
                            lastModified: folder.lastModified || new Date().toISOString(),
                            starred: folder.starred || false,
                            deleted: folder.deleted || false,
                            size: folder.size || 0
                        });
                    } catch (error) {
                        console.log(`    Hata: Klasör oluşturulamadı: ${folder.path} - ${error.message}`);
                    }
                }
                
                console.log(`  Klasörler migrate edildi`);
            }
            
            console.log(`✓ ${username} başarıyla migrate edildi`);
            
        } catch (error) {
            console.error(`Hata: ${username} migrate edilemedi - ${error.message}`);
        }
    }
    
    console.log('\nMigration tamamlandı!');
}

// Run migration
migrateData().catch(console.error);

