const supabase = require('./supabase');
const path = require('path');

// User operations
async function getUserByUsername(username) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error getting user:', error);
        return null;
    }
    
    return data;
}

async function getUserById(userId) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('Error getting user by ID:', error);
        return null;
    }
    
    return data;
}

async function createUser(userData) {
    try {
        console.log('Creating user in Supabase:', {
            username: userData.username,
            email: userData.email,
            hasPassword: !!userData.password,
            hasPhone: !!userData.phone
        });
        
        const { data, error } = await supabase
            .from('users')
            .insert([{
                username: userData.username,
                password: userData.password,
                email: userData.email || '',
                phone: userData.phone || '',
                storage_used: 0,
                max_storage: userData.maxStorage || 2147483648,
                avatar: userData.avatar || null,
                email_verified: userData.emailVerified || false,
                status: userData.status || 'user'
            }])
            .select()
            .single();
        
        if (error) {
            console.error('Error creating user:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            return null;
        }
        
        console.log('User created successfully:', data.id);
        return data;
    } catch (err) {
        console.error('Exception in createUser:', err);
        return null;
    }
}

async function updateUser(userId, updates) {
    try {
        console.log('Updating user:', userId, 'with updates:', updates);
        
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        
        if (error) {
            console.error('Error updating user:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            return null;
        }
        
        console.log('User updated successfully:', data.id);
        return data;
    } catch (err) {
        console.error('Exception in updateUser:', err);
        return null;
    }
}

async function getUserByEmail(email) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();
    
    if (error && error.code !== 'PGRST116') {
        console.error('Error getting user by email:', error);
        return null;
    }
    
    return data;
}

// File operations
async function getFiles(userId, options = {}) {
    let query = supabase
        .from('files')
        .select('*')
        .eq('user_id', userId);
    
    if (options.deleted !== undefined) {
        query = query.eq('deleted', options.deleted);
    }
    
    if (options.path) {
        query = query.eq('path', options.path);
    }
    
    if (options.pathPrefix) {
        query = query.like('path', `${options.pathPrefix}%`);
    }
    
    if (options.starred !== undefined) {
        query = query.eq('starred', options.starred);
    }
    
    if (options.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending !== false });
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error getting files:', error);
        return [];
    }
    
    return data || [];
}

async function createFile(userId, fileData) {
    const { data, error } = await supabase
        .from('files')
        .insert([{
            user_id: userId,
            name: fileData.name,
            path: fileData.path,
            size: fileData.size,
            storage_path: fileData.storagePath || null, // Supabase Storage path
            upload_date: fileData.uploadDate || new Date().toISOString(),
            starred: fileData.starred || false,
            deleted: fileData.deleted || false
        }])
        .select()
        .single();
    
    if (error) {
        console.error('Error creating file:', error);
        return null;
    }
    
    return data;
}

async function updateFile(userId, filePath, updates) {
    const { data, error } = await supabase
        .from('files')
        .update(updates)
        .eq('user_id', userId)
        .eq('path', filePath)
        .select()
        .single();
    
    if (error) {
        console.error('Error updating file:', error);
        return null;
    }
    
    return data;
}

async function deleteFilePermanently(userId, filePath) {
    const { error } = await supabase
        .from('files')
        .delete()
        .eq('user_id', userId)
        .eq('path', filePath);
    
    if (error) {
        console.error('Error deleting file:', error);
        return false;
    }
    
    return true;
}

// Folder operations
async function getFolders(userId, options = {}) {
    let query = supabase
        .from('folders')
        .select('*')
        .eq('user_id', userId);
    
    if (options.deleted !== undefined) {
        query = query.eq('deleted', options.deleted);
    }
    
    if (options.path) {
        query = query.eq('path', options.path);
    }
    
    if (options.pathPrefix) {
        query = query.like('path', `${options.pathPrefix}%`);
    }
    
    if (options.starred !== undefined) {
        query = query.eq('starred', options.starred);
    }
    
    if (options.parentPath) {
        // Get folders where parent path matches
        query = query.like('path', `${options.parentPath}/%`)
            .not('path', 'like', `${options.parentPath}/%/%`);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error getting folders:', error);
        return [];
    }
    
    return data || [];
}

async function createFolder(userId, folderData) {
    const { data, error } = await supabase
        .from('folders')
        .insert([{
            user_id: userId,
            name: folderData.name,
            path: folderData.path,
            created_by: folderData.createdBy || null,
            created_at: folderData.createdAt || new Date().toISOString(),
            last_modified: folderData.lastModified || new Date().toISOString(),
            starred: folderData.starred || false,
            deleted: folderData.deleted || false,
            size: folderData.size || 0
        }])
        .select()
        .single();
    
    if (error) {
        // If folder already exists, try to get it
        if (error.code === '23505') { // Unique violation
            const existing = await getFolders(userId, { path: folderData.path });
            return existing[0] || null;
        }
        console.error('Error creating folder:', error);
        return null;
    }
    
    return data;
}

async function updateFolder(userId, folderPath, updates) {
    const { data, error } = await supabase
        .from('folders')
        .update(updates)
        .eq('user_id', userId)
        .eq('path', folderPath)
        .select()
        .single();
    
    if (error) {
        console.error('Error updating folder:', error);
        return null;
    }
    
    return data;
}

async function deleteFolderPermanently(userId, folderPath) {
    const { error } = await supabase
        .from('folders')
        .delete()
        .eq('user_id', userId)
        .like('path', `${folderPath}%`);
    
    if (error) {
        console.error('Error deleting folder:', error);
        return false;
    }
    
    return true;
}

// Verification code operations
async function createVerificationCode(codeData) {
    const { data, error } = await supabase
        .from('verification_codes')
        .insert([{
            email: codeData.email.toLowerCase(),
            code: codeData.code,
            type: codeData.type || 'registration',
            username: codeData.username || null,
            user_data: codeData.userData || null,
            expires_at: codeData.expiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            used: false
        }])
        .select()
        .single();
    
    if (error) {
        console.error('Error creating verification code:', error);
        return null;
    }
    
    return data;
}

async function getVerificationCode(email, code, type = 'registration') {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        const normalizedCode = String(code).trim();
        
        console.log('Verification code lookup:', {
            email: normalizedEmail,
            code: normalizedCode,
            type: type
        });
        
        const { data, error } = await supabase
            .from('verification_codes')
            .select('*')
            .eq('email', normalizedEmail)
            .eq('code', normalizedCode)
            .eq('type', type)
            .eq('used', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1);
        
        if (error) {
            console.error('Error getting verification code:', error);
            return null;
        }
        
        if (!data || data.length === 0) {
            console.log('No verification code found matching criteria');
            return null;
        }
        
        console.log('Verification code found:', data[0].id);
        return data[0];
    } catch (err) {
        console.error('Exception in getVerificationCode:', err);
        return null;
    }
}

async function markVerificationCodeAsUsed(codeId) {
    try {
        const { error } = await supabase
            .from('verification_codes')
            .update({ used: true })
            .eq('id', codeId);
        
        if (error) {
            console.error('Error marking verification code as used:', error);
            return false;
        }
        
        console.log('Verification code marked as used:', codeId);
        return true;
    } catch (err) {
        console.error('Exception in markVerificationCodeAsUsed:', err);
        return false;
    }
}

async function deleteExpiredVerificationCodes() {
    const { error } = await supabase
        .from('verification_codes')
        .delete()
        .lt('expires_at', new Date().toISOString());
    
    if (error) {
        console.error('Error deleting expired verification codes:', error);
        return false;
    }
    
    return true;
}

// Payment request operations
async function getPaymentRequests(options = {}) {
    let query = supabase
        .from('payment_requests')
        .select('*');
    
    if (options.status) {
        query = query.eq('status', options.status);
    }
    
    if (options.username) {
        query = query.eq('username', options.username);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('Error getting payment requests:', error);
        return [];
    }
    
    return data || [];
}

async function createPaymentRequest(requestData) {
    const { data, error } = await supabase
        .from('payment_requests')
        .insert([{
            id: requestData.id,
            username: requestData.username,
            gb: requestData.gb,
            price: requestData.price,
            receipt_path: requestData.receiptPath,
            receipt_filename: requestData.receiptFilename,
            submitted_at: requestData.submittedAt || new Date().toISOString(),
            status: requestData.status || 'pending'
        }])
        .select()
        .single();
    
    if (error) {
        console.error('Error creating payment request:', error);
        return null;
    }
    
    return data;
}

async function updatePaymentRequest(requestId, updates) {
    const { data, error } = await supabase
        .from('payment_requests')
        .update(updates)
        .eq('id', requestId)
        .select()
        .single();
    
    if (error) {
        console.error('Error updating payment request:', error);
        return null;
    }
    
    return data;
}

// Helper to convert Supabase user to old format
function formatUserForSession(user) {
    if (!user) return null;
    
    return {
        id: user.id,
        username: user.username,
        password: user.password,
        email: user.email || '',
        phone: user.phone || '',
        storageUsed: user.storage_used || 0,
        maxStorage: user.max_storage || 2147483648,
        avatar: user.avatar || null,
        emailVerified: user.email_verified || false,
        status: user.status || 'user'
    };
}

// Helper to convert Supabase file to old format
function formatFile(file) {
    if (!file) return null;
    
    return {
        id: file.id,
        name: file.name,
        path: file.path,
        size: file.size,
        uploadDate: file.upload_date,
        starred: file.starred || false,
        deleted: file.deleted || false
    };
}

// Helper to convert Supabase folder to old format
function formatFolder(folder) {
    if (!folder) return null;
    
    return {
        id: folder.id,
        name: folder.name,
        path: folder.path,
        createdBy: folder.created_by || null,
        createdAt: folder.created_at,
        lastModified: folder.last_modified,
        starred: folder.starred || false,
        deleted: folder.deleted || false,
        size: folder.size || 0
    };
}

module.exports = {
    getUserByUsername,
    getUserById,
    createUser,
    updateUser,
    getUserByEmail,
    getFiles,
    createFile,
    updateFile,
    deleteFilePermanently,
    getFolders,
    createFolder,
    updateFolder,
    deleteFolderPermanently,
    createVerificationCode,
    getVerificationCode,
    markVerificationCodeAsUsed,
    deleteExpiredVerificationCodes,
    getPaymentRequests,
    createPaymentRequest,
    updatePaymentRequest,
    formatUserForSession,
    formatFile,
    formatFolder
};

