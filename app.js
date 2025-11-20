const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const bodyParser = require('body-parser');
const compression = require('compression');
const nodemailer = require('nodemailer');
const supabase = require('./supabase');
const {
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
} = require('./supabase-helpers');

const storageHelpers = require('./supabase-storage-helpers');
const {
    uploadFileToStorage,
    downloadFileFromStorage,
    deleteFileFromStorage,
    uploadAvatarToStorage,
    deleteAvatarFromStorage,
    getPublicUrl,
    BUCKETS,
    ensureBucketsExist
} = storageHelpers;

const app = express();
const port = 3000;
// const host = "46.31.77.188";

// Mail.ru SMTP yapılandırması
const transporter = nodemailer.createTransport({
    host: 'smtp.mail.ru',
    port: 465,
    secure: true, // SSL kullan
    auth: {
        user: 'samilhsv@mail.ru',
        pass: '3VjD25XXNlAqm4gwhcIl'
    }
});

// Email gönderme fonksiyonu
async function sendVerificationEmail(email, verificationCode) {
    try {
        const mailOptions = {
            from: 'samilhsv@mail.ru',
            to: email,
            subject: 'Drive - Email Doğrulama Kodu',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
                    <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #4285f4; text-align: center;">Email Doğrulama</h2>
                        <p style="color: #333; font-size: 16px;">Hesabınızı doğrulamak üçün aşağıdakı doğrulama kodunu istifadə edin:</p>
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                            <h1 style="color: #4285f4; font-size: 36px; letter-spacing: 5px; margin: 0;">${verificationCode}</h1>
                        </div>
                        <p style="color: #666; font-size: 14px;">Bu kod 10 dəqiqə müddətində etibarlıdır.</p>
                        <p style="color: #666; font-size: 14px;">Əgər bu emaili siz göndərməmisinizsə, bu mesajı nəzərə almayın.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="color: #999; font-size: 12px; text-align: center;">© 2024 Drive. Bütün hüquqlar qorunur.</p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Email gönderme hatası:', error);
        return false;
    }
}

// Doğrulama kodu oluşturma
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Şifre sıfırlama email gönderme fonksiyonu
async function sendPasswordResetEmail(email, verificationCode) {
    try {
        const mailOptions = {
            from: 'samilhsv@mail.ru',
            to: email,
            subject: 'Drive - Şifrə Sıfırlama Kodu',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
                    <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #4285f4; text-align: center;">Şifrə Sıfırlama</h2>
                        <p style="color: #333; font-size: 16px;">Şifrənizi sıfırlamaq üçün aşağıdakı doğrulama kodunu istifadə edin:</p>
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                            <h1 style="color: #4285f4; font-size: 36px; letter-spacing: 5px; margin: 0;">${verificationCode}</h1>
                        </div>
                        <p style="color: #666; font-size: 14px;">Bu kod 10 dəqiqə müddətində etibarlıdır.</p>
                        <p style="color: #ea4335; font-size: 14px; font-weight: bold;">Əgər bu tələbi siz etməmisinizsə, bu mesajı nəzərə almayın və şifrənizi dəyişməyin.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="color: #999; font-size: 12px; text-align: center;">© 2024 Drive. Bütün hüquqlar qorunur.</p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Email gönderme hatası:', error);
        return false;
    }
}

// Middleware
app.use(express.static('public'));
app.use('/img', express.static('img'));
app.use('/payment-receipts', express.static(path.join(__dirname, 'data', 'payment-receipts')));
// Avatar'ları data klasöründen serve et
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(compression());
app.set('view engine', 'ejs');

// Session ayarları
app.use(session({
    secret: 'gizli-anahtar',
    resave: true, // Force save session even if not modified
    saveUninitialized: true, // Save uninitialized sessions (needed for redirect)
    cookie: {
        secure: false, // Set to true only if using HTTPS
        httpOnly: true, // Prevent XSS attacks
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax' // CSRF protection
    },
    name: 'sessionId' // Custom session name
}));

// Multer ayarları
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const userDir = path.join(__dirname, 'data', req.session.username);
        fs.ensureDirSync(userDir);
        cb(null, userDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });
const uploadNone = multer();
// Avatar için memory storage kullan (production'da disk yazma sorunları olabilir)
const multerAvatar = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Uygulama başlarken bucket'ları kontrol et
ensureBucketsExist().then(() => {
    console.log('Supabase Storage buckets checked');
}).catch(err => {
    console.error('Error checking Supabase Storage buckets:', err);
});

// Ana sayfa
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

// Kayıt sayfası
app.get('/register', (req, res) => {
    res.render('register');
});

// Giriş sayfası
app.get('/login', (req, res) => {
    const verified = req.query.verified === 'true' || false;
    const passwordReset = req.query.passwordReset === 'true' || false;
    res.render('login', { verified: verified, passwordReset: passwordReset });
});

// Kullanıcı kaydı - Email doğrulama gönder
app.post('/register', async (req, res) => {
    const { username, password, email, phone } = req.body;
    
    // Check if username already exists in Supabase
    const existingUser = await getUserByUsername(username);
    if (existingUser) {
        return res.status(400).send('İstifadəçi adı artıq mövcuddur');
    }

    // Email ve telefon numarası validasyonu
    if (!email || !email.includes('@')) {
        return res.status(400).send('Düzgün e-poçt ünvanı daxil edin');
    }

    if (!phone || phone.trim() === '') {
        return res.status(400).send('Telefon nömrəsi daxil edin');
    }

    // Check if email already exists
    const existingEmail = await getUserByEmail(email);
    if (existingEmail) {
        return res.status(400).send('Bu e-poçt ünvanı artıq istifadə olunur');
    }

    // Doğrulama kodu oluştur
    const verificationCode = generateVerificationCode();
    const codeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 dakika

    // Supabase'e doğrulama kodunu kaydet
    const verificationCodeRecord = await createVerificationCode({
        email: email,
        code: verificationCode,
        type: 'registration',
        username: username,
        userData: {
            username,
            password,
            email,
            phone
        },
        expiresAt: codeExpiry.toISOString()
    });

    if (!verificationCodeRecord) {
        return res.status(500).send('Doğrulama kodu oluşturulamadı. Zəhmət olmasa yenidən cəhd edin.');
    }

    // Email gönder
    const emailSent = await sendVerificationEmail(email, verificationCode);
    
    if (!emailSent) {
        return res.status(500).send('Email göndərilə bilmədi. Zəhmət olmasa yenidən cəhd edin.');
    }

    // Doğrulama sayfasına yönlendir
    res.redirect('/verify-email?email=' + encodeURIComponent(email));
});

// Email doğrulama sayfası
app.get('/verify-email', (req, res) => {
    const email = req.query.email;
    if (!email) {
        return res.redirect('/register');
    }
    res.render('verify-email', { email: email });
});

// Email doğrulama işlemi
app.post('/verify-email', async (req, res) => {
    try {
        // Hem JSON hem de form-urlencoded desteği
        let code = req.body.code;
        const email = req.body.email || req.query.email;
        
        // Eğer JSON body'den geliyorsa
        if (req.body && typeof req.body === 'object' && 'code' in req.body) {
            code = req.body.code;
        }

        if (!email || !code) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email və kod təmin edilməlidir.' 
            });
        }

        // Debug: Gelen veriyi kontrol et
        console.log('=== Email Verification Request ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('Code:', code);
        console.log('Email:', email);
        console.log('Code type:', typeof code);

        // Supabase'den doğrulama kodunu al
        const verificationRecord = await getVerificationCode(email, String(code || '').trim(), 'registration');

        console.log('Verification record:', verificationRecord ? 'Found' : 'Not found');

        if (!verificationRecord) {
            console.log('Verification failed: No matching code found');
            return res.status(400).json({ 
                success: false, 
                message: 'Yanlış doğrulama kodu və ya kodun müddəti bitib. Zəhmət olmasa yenidən cəhd edin.' 
            });
        }

        // Kod kullanılmış mı kontrol et
        if (verificationRecord.used) {
            return res.status(400).json({ 
                success: false, 
                message: 'Bu kod artıq istifadə olunub. Zəhmət olmasa yenidən qeydiyyatdan keçin.' 
            });
        }

        // User data'yı al
        const userDataObj = verificationRecord.user_data || {};
        
        console.log('User data from verification record:', {
            hasUserData: !!userDataObj,
            username: userDataObj.username || verificationRecord.username,
            hasPassword: !!userDataObj.password,
            email: userDataObj.email || email
        });
        
        // Kullanıcı kaydını tamamla - Supabase'e ekle
        const userData = {
            username: userDataObj.username || verificationRecord.username,
            password: userDataObj.password,
            email: userDataObj.email || email,
            phone: userDataObj.phone || '',
            maxStorage: 2 * 1024 * 1024 * 1024, // 2GB
            emailVerified: true
        };

        if (!userData.username || !userData.password) {
            console.error('Missing required user data:', { username: userData.username, hasPassword: !!userData.password });
            return res.status(500).json({ 
                success: false, 
                message: 'İstifadəçi məlumatları yanlışdır. Zəhmət olmasa yenidən qeydiyyatdan keçin.' 
            });
        }

        console.log('Creating user with data:', {
            username: userData.username,
            email: userData.email,
            hasPassword: !!userData.password,
            hasPhone: !!userData.phone
        });

        const newUser = await createUser(userData);
        
        if (!newUser) {
            console.error('User creation failed - createUser returned null');
            return res.status(500).json({ 
                success: false, 
                message: 'İstifadəçi yaradıla bilmədi. Zəhmət olmasa yenidən cəhd edin.' 
            });
        }

        console.log('User created successfully:', newUser.id);

        // Doğrulama kodunu kullanıldı olarak işaretle
        const marked = await markVerificationCodeAsUsed(verificationRecord.id);
        console.log('Verification code marked as used:', marked);

        // Create user directory for file storage (still using disk for files)
        // Try to create directory, but don't fail if it doesn't work (will be created on first file upload)
        try {
            const userDir = path.join(__dirname, 'data', userData.username);
            fs.ensureDirSync(userDir);
            console.log('User directory created:', userDir);
        } catch (dirError) {
            console.warn('Could not create user directory (will be created on first upload):', dirError.message);
            // Don't fail the registration if directory creation fails
        }
        
        console.log('=== Email Verification SUCCESS ===');
        console.log('User created:', newUser.username);
        console.log('Sending success response...');
        
        // JSON response döndür (fetch için)
        return res.status(200).json({ 
            success: true, 
            message: 'Email doğrulandı! İndi giriş edə bilərsiniz.',
            redirect: '/login?verified=true' 
        });
    } catch (error) {
        console.error('=== Email Verification ERROR ===');
        console.error('Error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        return res.status(500).json({ 
            success: false, 
            message: 'Doğrulama zamanı xəta yarandı: ' + (error.message || 'Bilinməyən xəta') 
        });
    }
});

// Doğrulama kodunu yeniden gönder
app.post('/resend-verification', async (req, res) => {
    const email = req.body.email || req.query.email;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email təmin edilməlidir.' });
    }

    // Email'e ait en son doğrulama kodunu bul
    const { data: existingCodes } = await supabase
        .from('verification_codes')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('type', 'registration')
        .eq('used', false)
        .order('created_at', { ascending: false })
        .limit(1);

    let userData = null;
    if (existingCodes && existingCodes.length > 0) {
        userData = existingCodes[0].user_data;
    }

    // Yeni kod oluştur
    const verificationCode = generateVerificationCode();
    const codeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 dakika

    // Supabase'e yeni doğrulama kodunu kaydet
    const verificationCodeRecord = await createVerificationCode({
        email: email,
        code: verificationCode,
        type: 'registration',
        username: userData?.username || null,
        userData: userData,
        expiresAt: codeExpiry.toISOString()
    });

    if (!verificationCodeRecord) {
        return res.status(500).json({ 
            success: false, 
            message: 'Doğrulama kodu oluşturulamadı. Zəhmət olmasa yenidən cəhd edin.' 
        });
    }

    // Email gönder
    const emailSent = await sendVerificationEmail(email, verificationCode);
    
    if (!emailSent) {
        return res.status(500).json({ 
            success: false, 
            message: 'Email göndərilə bilmədi. Zəhmət olmasa yenidən cəhd edin.' 
        });
    }

    res.json({ success: true, message: 'Doğrulama kodu yenidən göndərildi.' });
});

// Kullanıcı girişi
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    console.log('=== Login Request ===');
    console.log('Username:', username);
    console.log('Password provided:', !!password);
    
    const user = await getUserByUsername(username);
    if (!user) {
        console.log('User not found:', username);
        return res.status(400).send('İstifadəçi tapılmadı');
    }
    
    console.log('User found:', {
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: user.email_verified,
        hasPassword: !!user.password,
        storedPassword: user.password,
        providedPassword: password,
        passwordMatch: user.password === password
    });
    
    // Email doğrulaması kontrolü
    if (!user.email_verified) {
        console.log('Email not verified for user:', username);
        return res.status(400).send('Email doğrulanmayıb. Zəhmət olmasa email doğrulama linkinə klikləyin.');
    }
    
    // Şifre kontrolü (şu an hash'lenmemiş şekilde saklanıyor)
    if (user.password !== password) {
        console.log('Password mismatch for user:', username);
        return res.status(400).send('Yanlış şifrə');
    }
    
    // Format user for session (compatible with old format)
    const userData = formatUserForSession(user);
    
    // Ensure user directory exists for file storage (try to create, but don't fail if it doesn't work)
    try {
        const userDir = path.join(__dirname, 'data', username);
        fs.ensureDirSync(userDir);
    } catch (dirError) {
        console.warn('Could not create user directory on login (will be created on first upload):', dirError.message);
        // Don't fail the login if directory creation fails
    }
    
    // Save session data
    req.session.user = userData;
    req.session.username = username;
    req.session.userId = user.id; // Store Supabase user ID
    
    console.log('Session data set:', {
        hasUser: !!req.session.user,
        userId: req.session.userId,
        username: req.session.username,
        sessionId: req.sessionID
    });
    
    // Force session save and then redirect
    req.session.save((err) => {
        if (err) {
            console.error('Session save error:', err);
            return res.status(500).send('Session kaydedilmedi');
        }
        
        console.log('Login successful, session saved. Session ID:', req.sessionID);
        console.log('Redirecting to /drive');
        
        // Redirect after ensuring session is saved
        return res.redirect('/drive');
    });
});

// Şifremi unuttum sayfası
app.get('/forgot-password', (req, res) => {
    res.render('forgot-password');
});

// Şifre sıfırlama - Email'e kod gönder
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
        return res.status(400).json({ 
            success: false, 
            message: 'Düzgün e-poçt ünvanı daxil edin' 
        });
    }

    // Kullanıcıyı email ile bul - Supabase'den
    const foundUser = await getUserByEmail(email);

    if (!foundUser) {
        // Güvenlik için: Email bulunamadı mesajı göster (gerçek kullanıcıyı açığa çıkarmamak için)
        return res.json({ 
            success: true, 
            message: 'Əgər bu email qeydiyyatdan keçibsə, doğrulama kodu göndərildi.' 
        });
    }

    // Doğrulama kodu oluştur
    const verificationCode = generateVerificationCode();
    const codeExpiry = Date.now() + 10 * 60 * 1000; // 10 dakika

    // Session'a kaydet
    req.session.pendingPasswordReset = {
        email: email,
        username: foundUser.username,
        userId: foundUser.id,
        verificationCode,
        codeExpiry
    };

    // Email gönder
    const emailSent = await sendPasswordResetEmail(email, verificationCode);
    
    if (!emailSent) {
        return res.status(500).json({ 
            success: false, 
            message: 'Email göndərilə bilmədi. Zəhmət olmasa yenidən cəhd edin.' 
        });
    }

    res.json({ 
        success: true, 
        message: 'Doğrulama kodu e-poçt ünvanınıza göndərildi.' 
    });
});

// Şifre sıfırlama kod doğrulama sayfası
app.get('/reset-password-verify', (req, res) => {
    const email = req.query.email;
    if (!req.session.pendingPasswordReset) {
        return res.redirect('/forgot-password');
    }
    res.render('reset-password-verify', { email: email || req.session.pendingPasswordReset.email });
});

// Şifre sıfırlama kod doğrulama
app.post('/reset-password-verify', async (req, res) => {
    const { code, email } = req.body;
    const pending = req.session.pendingPasswordReset;

    if (!pending) {
        return res.status(400).json({ 
            success: false, 
            message: 'Doğrulama səhifəsi tapılmadı. Zəhmət olmasa yenidən cəhd edin.' 
        });
    }

    // Email kontrolü
    if (email && pending.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email uyğun deyil.' 
        });
    }

    // Kod süresi kontrolü
    if (Date.now() > pending.codeExpiry) {
        req.session.pendingPasswordReset = null;
        return res.status(400).json({ 
            success: false, 
            message: 'Doğrulama kodu müddəti bitib. Zəhmət olmasa yenidən cəhd edin.' 
        });
    }

    // Kod kontrolü
    const enteredCode = String(code || '').trim();
    const expectedCode = String(pending.verificationCode || '').trim();
    
    if (enteredCode !== expectedCode) {
        return res.status(400).json({ 
            success: false, 
            message: 'Yanlış doğrulama kodu. Zəhmət olmasa yenidən cəhd edin.' 
        });
    }

    // Token oluştur (basit bir token - production'da daha güvenli olmalı)
    const resetToken = Buffer.from(`${pending.username}:${Date.now()}`).toString('base64');
    
    // Session'a token ekle
    req.session.pendingPasswordReset.resetToken = resetToken;
    req.session.pendingPasswordReset.tokenExpiry = Date.now() + 15 * 60 * 1000; // 15 dakika

    res.json({ 
        success: true, 
        token: resetToken,
        redirect: '/reset-password?token=' + encodeURIComponent(resetToken)
    });
});

// Kod yeniden gönderme
app.post('/resend-reset-code', async (req, res) => {
    const { email } = req.body;
    const pending = req.session.pendingPasswordReset;

    if (!pending || (email && pending.email.toLowerCase() !== email.toLowerCase())) {
        return res.status(400).json({ 
            success: false, 
            message: 'Doğrulama səhifəsi tapılmadı.' 
        });
    }

    // Yeni kod oluştur
    const verificationCode = generateVerificationCode();
    const codeExpiry = Date.now() + 10 * 60 * 1000;

    // Session'ı güncelle
    req.session.pendingPasswordReset.verificationCode = verificationCode;
    req.session.pendingPasswordReset.codeExpiry = codeExpiry;

    // Email gönder
    const emailSent = await sendPasswordResetEmail(pending.email, verificationCode);
    
    if (!emailSent) {
        return res.status(500).json({ 
            success: false, 
            message: 'Email göndərilə bilmədi. Zəhmət olmasa yenidən cəhd edin.' 
        });
    }

    res.json({ 
        success: true, 
        message: 'Doğrulama kodu yenidən göndərildi.' 
    });
});

// Yeni şifre belirleme sayfası
app.get('/reset-password', (req, res) => {
    const token = req.query.token;
    const pending = req.session.pendingPasswordReset;

    if (!pending || !pending.resetToken || pending.resetToken !== token) {
        return res.redirect('/forgot-password');
    }

    // Token süresi kontrolü
    if (Date.now() > pending.tokenExpiry) {
        req.session.pendingPasswordReset = null;
        return res.redirect('/forgot-password');
    }

    res.render('reset-password');
});

// Şifre güncelleme
app.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    const pending = req.session.pendingPasswordReset;

    if (!pending || !pending.resetToken || pending.resetToken !== token) {
        return res.status(400).json({ 
            success: false, 
            message: 'Token etibarsızdır. Zəhmət olmasa yenidən cəhd edin.' 
        });
    }

    // Token süresi kontrolü
    if (Date.now() > pending.tokenExpiry) {
        req.session.pendingPasswordReset = null;
        return res.status(400).json({ 
            success: false, 
            message: 'Token müddəti bitib. Zəhmət olmasa yenidən cəhd edin.' 
        });
    }

    // Şifre validasyonu
    if (!password || password.length < 6) {
        return res.status(400).json({ 
            success: false, 
            message: 'Şifrə ən azı 6 simvol olmalıdır.' 
        });
    }

    // Kullanıcı şifresini güncelle - Supabase'de
    const updatedUser = await updateUser(pending.userId, { password });
    
    if (!updatedUser) {
        return res.status(500).json({ 
            success: false, 
            message: 'Şifrə yenilənərkən xəta yarandı.' 
        });
    }

    // Session'ı temizle
    req.session.pendingPasswordReset = null;

    res.json({ 
        success: true, 
        message: 'Şifrəniz uğurla yeniləndi.',
        redirect: '/login?passwordReset=true'
    });
});

// Drive sayfası
app.get('/drive', async (req, res) => {
    console.log('=== Drive Request ===');
    console.log('Session user:', req.session.user ? 'exists' : 'missing');
    console.log('Session userId:', req.session.userId);
    console.log('Session username:', req.session.username);
    
    if (!req.session.user || !req.session.userId) {
        console.log('Session check failed, redirecting to login');
        console.log('Missing session data - user:', !req.session.user, 'userId:', !req.session.userId);
        console.log('Session object:', JSON.stringify(req.session, null, 2));
        return res.redirect('/login');
    }
    
    const userId = req.session.userId;
    console.log('Fetching user data from Supabase for userId:', userId);
    
    const supabaseUser = await getUserById(userId);
    if (!supabaseUser) {
        console.error('User not found in Supabase for userId:', userId);
        return res.status(500).send('İstifadəçi tapılmadı');
    }
    
    const userData = formatUserForSession(supabaseUser);
    
    if (!userData) {
        console.error('formatUserForSession returned null');
        return res.status(500).send('İstifadəçi tapılmadı');
    }
    
    console.log('User data formatted:', {
        id: userData.id,
        username: userData.username,
        email: userData.email
    });
    
    // Ensure user directory exists for file storage (try to create, but don't fail if it doesn't work)
    try {
        const userDir = path.join(__dirname, 'data', req.session.username);
        fs.ensureDirSync(userDir);
    } catch (dirError) {
        console.warn('Could not create user directory on drive access (will be created on first upload):', dirError.message);
        // Don't fail the drive access if directory creation fails
    }

    // Klasör içeriği için path parametresi
    const currentPath = req.query.path || '';
    const filter = req.query.filter || '';
    
    // Payment filter için özel kontrol
    let paymentRequests = [];
    if (filter === 'payment') {
        if (userData.status !== 'developer') {
            return res.status(403).send('Developer deyilsiniz');
        }
        paymentRequests = await getPaymentRequests({ status: 'pending' });
        // Payment filter için boş dosya ve klasör listesi döndür
        return res.render('drive', {
            user: userData,
            currentPath: '',
            folders: [],
            files: [],
            filter: 'payment',
            paymentRequests: paymentRequests
        });
    }
    
    // Get files and folders from Supabase
    const fileOptions = {};
    const folderOptions = {};
    
    if (filter === 'starred') {
        fileOptions.starred = true;
        fileOptions.deleted = false;
        folderOptions.starred = true;
        folderOptions.deleted = false;
    } else if (filter === 'recent') {
        fileOptions.deleted = false;
        fileOptions.orderBy = 'upload_date';
    } else if (filter === 'deleted') {
        fileOptions.deleted = true;
        folderOptions.deleted = true;
    } else {
        fileOptions.deleted = false;
        folderOptions.deleted = false;
    }
    
    let allFiles = await getFiles(userId, fileOptions);
    let allFoldersData = await getFolders(userId, folderOptions);
    
    // Format files and folders
    allFiles = allFiles.map(formatFile);
    allFoldersData = allFoldersData.map(formatFolder);
    
    if (filter === 'recent') {
        allFiles = allFiles.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)).slice(0, 20);
    }
    
    // Create folder map
    const allFolders = new Map();
    allFoldersData.forEach(folder => {
        allFolders.set(folder.path, folder);
    });
    
    // Process files to find folders in current path
    const files = [];
    const seenFolders = new Set();
    
    allFiles.forEach(file => {
        const relPath = file.path.replace(/\\/g, '/');
        const parts = relPath.split('/');
        const fileFolder = parts.slice(0, -1).join('/');
        
        // Şu anki klasörde mi?
        if (fileFolder === currentPath) {
            files.push(file);
        } else if (currentPath === '' || fileFolder.startsWith(currentPath + '/')) {
            // Alt klasörleri bul
            const subFolder = parts.slice(0, currentPath ? currentPath.split('/').length + 1 : 1).join('/');
            if (subFolder && subFolder !== currentPath && !seenFolders.has(subFolder)) {
                seenFolders.add(subFolder);
                // Klasör bilgisi yoksa oluştur
                if (!allFolders.has(subFolder)) {
                    const isDeleted = filter === 'deleted';
                    const folderObj = {
                        name: subFolder.split('/').pop(),
                        path: subFolder,
                        createdBy: req.session.username,
                        createdAt: new Date().toISOString(),
                        lastModified: new Date().toISOString(),
                        starred: false,
                        deleted: isDeleted,
                        size: 0
                    };
                    allFolders.set(subFolder, folderObj);
                    // Create folder in Supabase
                    createFolder(userId, folderObj);
                }
            }
        }
    });
    
    // Calculate folder sizes and check if empty
    for (const [folderPath, folder] of allFolders.entries()) {
        let folderSize = 0;
        let hasFiles = false;
        let hasSubfolders = false;
        
        // Check files in this folder
        for (const file of allFiles) {
            const shouldCheck = filter === 'deleted' ? file.deleted : !file.deleted;
            if (shouldCheck) {
                const relPath = file.path.replace(/\\/g, '/');
                if (relPath.startsWith(folderPath + '/')) {
                    folderSize += file.size || 0;
                    const fileFolder = relPath.substring(0, relPath.lastIndexOf('/'));
                    if (fileFolder === folderPath) {
                        hasFiles = true;
                    }
                }
            }
        }
        
        // Check subfolders
        for (const [otherPath, otherFolder] of allFolders.entries()) {
            if (otherPath !== folderPath && otherPath.startsWith(folderPath + '/')) {
                const parentPath = otherPath.substring(0, otherPath.lastIndexOf('/'));
                if (parentPath === folderPath) {
                    hasSubfolders = true;
                }
            }
        }
        
        folder.size = folderSize;
        folder.isEmpty = !hasFiles && !hasSubfolders;
    }
    
    // Filter folders in current path
    const folderList = Array.from(allFolders.values())
        .filter(folder => {
            const folderParts = folder.path.split('/');
            const parentPath = folderParts.slice(0, -1).join('/');
            return parentPath === currentPath;
        })
        .map(folder => ({
            name: folder.name,
            path: folder.path,
            createdBy: folder.createdBy || req.session.username,
            createdAt: folder.createdAt || new Date().toISOString(),
            lastModified: folder.lastModified || new Date().toISOString(),
            starred: folder.starred || false,
            size: folder.size || 0,
            isEmpty: folder.isEmpty !== undefined ? folder.isEmpty : true
        }));

    res.render('drive', {
        user: userData,
        currentPath,
        folders: folderList,
        files,
        filter
    });
});

// Dosya yükleme (GET isteği için yönlendirme)
app.get('/upload', (req, res) => {
    res.redirect('/drive');
});

// Dosya yükleme
app.post('/upload', uploadNone.single('file'), async (req, res) => {
    try {
        console.log('Upload endpoint çağrıldı');
        console.log('Session user:', req.session.user);
        console.log('Session username:', req.session.username);
        console.log('Request file:', req.file);
        console.log('Request body:', req.body);
        
    if (!req.session.user) {
            console.log('Hata: Giriş edilməyib');
            return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
        }

        if (!req.session.username || !req.session.userId) {
            console.log('Hata: İstifadəçi adı tapılmadı');
            return res.status(401).json({ success: false, message: 'İstifadəçi adı tapılmadı' });
        }

        const userId = req.session.userId;
        const userData = await getUserById(userId);
        
        if (!userData) {
            return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
        }

        // Dosya kontrolü
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Fayl tapılmadı' });
        }

        const file = req.file;
        if (!file.buffer) {
            return res.status(400).json({ success: false, message: 'Fayl məlumatı tapılmadı' });
        }

        let originalName = file.originalname;
        let relativePath = req.body.relativePath || originalName;

        // Depolama kontrolü
        if ((userData.storage_used || 0) + file.size > (userData.max_storage || 2147483648)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Saxlama sahəsi doludur. Əlavə yaddaş əldə edin.' 
            });
        }

        // Aynı isimde dosya kontrolü ve numara ekleme - Supabase'den
        const existingFiles = await getFiles(userId, { deleted: false });
        const fileExt = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
        const fileNameWithoutExt = originalName.includes('.') ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;
        
        let finalName = originalName;
        let finalPath = relativePath;
        let counter = 0;
        
        // Aynı isimde dosya var mı kontrol et
        while (existingFiles.some(f => f.name === finalName && f.path === finalPath && !f.deleted)) {
            counter++;
            finalName = fileNameWithoutExt + ' (' + counter + ')' + fileExt;
            // Path'i de güncelle
            const pathDir = path.dirname(relativePath).replace(/\\/g, '/');
            if (pathDir === '.' || pathDir === '') {
                finalPath = finalName;
            } else {
                finalPath = pathDir + '/' + finalName;
            }
        }

        // Dosyayı Supabase Storage'a yükle
        const contentType = file.mimetype || 'application/octet-stream';
        console.log('Uploading file to Supabase Storage:', finalPath);
        
        const storageUploadResult = await uploadFileToStorage(userId, finalPath, file.buffer, contentType);
        
        if (!storageUploadResult.success) {
            console.error('Error uploading file to Supabase Storage:', storageUploadResult.error);
            return res.status(500).json({ 
                success: false, 
                message: 'Fayl yüklənərkən xəta yarandı: ' + (storageUploadResult.error || 'Bilinməyən xəta') 
            });
        }
        
        console.log('File uploaded to Supabase Storage:', storageUploadResult.path);

        // Supabase'e dosya kaydı ekle
        let newFile;
        try {
            newFile = await createFile(userId, {
                name: finalName,
                path: finalPath,
                size: file.size,
                storagePath: storageUploadResult.path, // Supabase Storage path
                uploadDate: new Date().toISOString(),
                starred: false,
                deleted: false
            });
            
            if (!newFile) {
                console.error('createFile returned null');
                // If file creation failed, remove from storage
                try { 
                    await deleteFileFromStorage(storageUploadResult.path);
                } catch (e) {
                    console.warn('Could not remove file from storage after DB error:', e.message);
                }
                return res.status(500).json({ success: false, message: 'Fayl verilənlər bazasında yadda saxlanıla bilmədi' });
            }
            console.log('File created in Supabase:', newFile.id);
        } catch (createError) {
            console.error('Error creating file in Supabase:', createError);
            // If file creation failed, remove from storage
            try { 
                await deleteFileFromStorage(storageUploadResult.path);
            } catch (e) {
                console.warn('Could not remove file from storage after DB error:', e.message);
            }
            return res.status(500).json({ 
                success: false, 
                message: 'Fayl verilənlər bazasında yadda saxlanıla bilmədi: ' + createError.message 
            });
        }

        // Storage kullanımını güncelle
        let newStorageUsed;
        try {
            newStorageUsed = (userData.storage_used || 0) + file.size;
            const storageUpdated = await updateUser(userId, { storage_used: newStorageUsed });
            
            if (!storageUpdated) {
                console.warn('Storage update failed, but file was created');
            } else {
                console.log('Storage updated:', newStorageUsed);
            }
        } catch (storageError) {
            console.error('Error updating storage:', storageError);
            // Don't fail the upload if storage update fails
            newStorageUsed = (userData.storage_used || 0) + file.size;
        }
        
        // Klasör yapısını oluştur ve güncelle
        try {
            const fileFolder = path.dirname(finalPath).replace(/\\/g, '/');
            if (fileFolder && fileFolder !== '.') {
                await updateFolderHierarchy(userId, fileFolder, req.session.username);
                console.log('Folder hierarchy updated for:', fileFolder);
            }
        } catch (folderError) {
            console.warn('Error updating folder hierarchy:', folderError.message);
            // Don't fail the upload if folder hierarchy update fails
        }
        
        // Session'ı güncelle
        if (req.session.user && newStorageUsed !== undefined) {
            req.session.user.storageUsed = newStorageUsed;
        }
        
        console.log('File upload completed successfully');
        res.status(200).json({ success: true, message: 'Fayl uğurla yükləndi' });
    } catch (error) {
        console.error('Dosya yükleme hatası:', error);
        res.status(500).json({ success: false, message: 'Fayl yüklənərkən xəta yarandı: ' + error.message });
    }
});

// Dosya indirme sayfası (10 saniye geri sayım)
app.get('/download/:filename', (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Giriş edilməyib');
    }

    const filename = req.params.filename;
    res.render('download', { filename });
});

// Gerçek dosya indirme endpoint'i
app.get('/download-file/:filename', async (req, res) => {
    if (!req.session.user || !req.session.userId) {
        return res.status(401).send('Giriş edilməyib');
    }

    const filename = decodeURIComponent(req.params.filename);
    const userId = req.session.userId;
    
    // Dosyayı Supabase'den bul
    const files = await getFiles(userId, { deleted: false });
    const fileObj = files.find(f => f.name === filename || f.path === filename || f.path.endsWith('/' + filename));
    
    if (!fileObj) {
        return res.status(404).send('Fayl tapılmadı');
    }
    
    // Supabase Storage'dan dosyayı indir
    if (fileObj.storage_path) {
        const downloadResult = await downloadFileFromStorage(fileObj.storage_path);
        
        if (!downloadResult.success) {
            console.error('Error downloading file from storage:', downloadResult.error);
            return res.status(500).send('Fayl endirilərkən xəta yarandı');
        }
        
        // Dosyayı gönder
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileObj.name)}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(downloadResult.data);
    } else {
        // Eski sistem - disk'ten oku (backward compatibility)
        const filePath = path.join(__dirname, 'data', req.session.username, fileObj.path);
        if (fs.existsSync(filePath)) {
            res.download(filePath);
        } else {
            return res.status(404).send('Fayl tapılmadı');
        }
    }
});

// Dosya ismini değiştirme
app.post('/rename', async (req, res) => {
    if (!req.session.user || !req.session.userId) return res.status(401).send('Giriş edilməyib');
    const { oldPath, newName } = req.body;
    const userId = req.session.userId;
    
    const files = await getFiles(userId, { path: oldPath });
    const fileObj = files.find(f => !f.deleted);
    if (!fileObj) return res.status(404).send('Fayl tapılmadı');
    
    const parts = oldPath.split('/');
    const newPath = parts.slice(0, -1).concat([newName]).join('/');
    
    // Dosyayı disk üzerinde taşı
    const userDir = path.join(__dirname, 'data', req.session.username);
    const oldDiskPath = path.join(userDir, oldPath);
    let diskPathToUse = oldDiskPath;
    if (!fs.existsSync(oldDiskPath)) {
        if (fs.existsSync(path.join(userDir, fileObj.name))) {
            diskPathToUse = path.join(userDir, fileObj.name);
        }
    }
    const newDiskPath = path.join(userDir, newPath);
    await fs.ensureDir(path.dirname(newDiskPath));
    try {
        await fs.move(diskPathToUse, newDiskPath, { overwrite: true });
    } catch (e) {
        console.error('Dosya taşınırken hata:', e);
    }
    
    // Supabase'de güncelle
    const updated = await updateFile(userId, oldPath, { 
        name: newName, 
        path: newPath 
    });
    
    if (!updated) {
        return res.status(500).send('Fayl yenilənərkən xəta yarandı');
    }
    
    // Klasörün lastModified tarihini güncelle
    const fileFolder = path.dirname(newPath).replace(/\\/g, '/');
    if (fileFolder && fileFolder !== '.') {
        await updateFolderHierarchy(userId, fileFolder, req.session.username);
    }
    
    res.json({ success: true });
});

// Dosya ulduzlama (star/unstar)
app.post('/star', async (req, res) => {
    if (!req.session.user || !req.session.userId) return res.status(401).send('Giriş edilməyib');
    const { path: filePath, starred } = req.body;
    const userId = req.session.userId;
    
    const updated = await updateFile(userId, filePath, { starred: !!starred });
    if (!updated) {
        return res.status(404).send('Fayl tapılmadı');
    }
    
    // Klasörün lastModified tarihini güncelle
    const fileFolder = path.dirname(filePath).replace(/\\/g, '/');
    if (fileFolder && fileFolder !== '.') {
        await updateFolderHierarchy(userId, fileFolder, req.session.username);
    }
    
    res.json({ success: true });
});

// Dosya silme (soft delete)
app.post('/delete', async (req, res) => {
    if (!req.session.user || !req.session.userId) return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    const { path: filePath } = req.body;
    
    if (!filePath) {
        return res.status(400).json({ success: false, message: 'Fayl yolu təmin edilməyib' });
    }
    
    const userId = req.session.userId;
    const files = await getFiles(userId, { path: filePath });
    const fileObj = files.find(f => !f.deleted);
    
    if (!fileObj) {
        return res.status(404).json({ success: false, message: 'Fayl tapılmadı: ' + filePath });
    }
    
    // Eğer aynı isimde silinmiş bir dosya varsa, isme numara ekle
    const fileName = fileObj.name;
    const fileExt = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
    const fileNameWithoutExt = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
    
    // Aynı isimde silinmiş dosyaları bul - Supabase'den
    const allFiles = await getFiles(userId);
    const deletedFilesWithSameName = allFiles.filter(f => 
        f.deleted && 
        f.name.startsWith(fileNameWithoutExt) && 
        (f.name === fileName || f.name.startsWith(fileNameWithoutExt + ' ('))
    );
    
    let finalPath = filePath;
    let finalName = fileName;
    
    if (deletedFilesWithSameName.length > 0) {
        // En yüksek numarayı bul
        let maxNumber = 0;
        deletedFilesWithSameName.forEach(f => {
            if (f.name === fileName) {
                maxNumber = Math.max(maxNumber, 1);
            } else {
                const match = f.name.match(/^(.+)\s\((\d+)\)(\.[^.]+)?$/);
                if (match && match[1] === fileNameWithoutExt) {
                    maxNumber = Math.max(maxNumber, parseInt(match[2]));
                }
            }
        });
        
        // Yeni isim oluştur
        const newNumber = maxNumber + 1;
        finalName = fileNameWithoutExt + ' (' + newNumber + ')' + fileExt;
        finalPath = path.dirname(filePath).replace(/\\/g, '/') === '.' 
            ? finalName 
            : path.dirname(filePath).replace(/\\/g, '/') + '/' + finalName;
        
        // Disk üzerindeki dosyayı da yeniden adlandır (eğer varsa)
        const userDir = path.join(__dirname, 'data', req.session.username);
        const oldDiskPath = path.join(userDir, filePath);
        const newDiskPath = path.join(userDir, finalPath);
        if (fs.existsSync(oldDiskPath)) {
            try {
                await fs.move(oldDiskPath, newDiskPath, { overwrite: false });
            } catch (e) {
                console.error('Dosya yeniden adlandırılırken hata:', e);
            }
        }
        
        // Update file path in Supabase
        await updateFile(userId, filePath, { name: finalName, path: finalPath });
    }
    
    // Mark as deleted in Supabase
    const updated = await updateFile(userId, finalPath, { deleted: true });
    
    if (!updated) {
        return res.status(500).json({ success: false, message: 'Fayl silinərkən xəta yarandı' });
    }
    
    // Klasörün lastModified tarihini güncelle
    const fileFolder = path.dirname(finalPath).replace(/\\/g, '/');
    if (fileFolder && fileFolder !== '.') {
        await updateFolderHierarchy(userId, fileFolder, req.session.username);
    }
    
    console.log('Dosya silindi:', finalPath);
    res.json({ success: true, message: 'Fayl uğurla silindi' });
});

// Dosya kurtarma (restore)
app.post('/restore', async (req, res) => {
    if (!req.session.user || !req.session.userId) return res.status(401).send('Giriş edilməyib');
    const { path: filePath } = req.body;
    const userId = req.session.userId;
    
    const updated = await updateFile(userId, filePath, { deleted: false });
    if (!updated) {
        return res.status(404).send('Fayl tapılmadı');
    }
    
    res.json({ success: true });
});

// Dosya tamamen silme (hard delete)
app.post('/hard-delete', async (req, res) => {
    if (!req.session.user || !req.session.userId) return res.status(401).send('Giriş edilməyib');
    const { path: filePath } = req.body;
    const userId = req.session.userId;
    
    // Get file info before deletion
    const files = await getFiles(userId, { path: filePath });
    const fileObj = files[0];
    
    if (!fileObj) {
        return res.status(404).send('Fayl tapılmadı');
    }
    
    // Supabase Storage'dan dosyayı sil
    if (fileObj.storage_path) {
        const deleteResult = await deleteFileFromStorage(fileObj.storage_path);
        if (!deleteResult.success) {
            console.warn('Could not delete file from storage:', deleteResult.error);
            // Devam et, veritabanından silmeye çalış
        }
    } else {
        // Eski sistem - disk'ten sil (backward compatibility)
        const userDir = path.join(__dirname, 'data', req.session.username);
        const diskPath = path.join(userDir, filePath);
        try { await fs.remove(diskPath); } catch (e) {}
    }
    
    // Delete from Supabase database
    const deleted = await deleteFilePermanently(userId, filePath);
    if (!deleted) {
        return res.status(500).send('Fayl silinərkən xəta yarandı');
    }
    
    // Update storage used
    const userData = await getUserById(userId);
    if (userData) {
        const newStorageUsed = Math.max(0, (userData.storage_used || 0) - (fileObj.size || 0));
        await updateUser(userId, { storage_used: newStorageUsed });
    }
    
    res.json({ success: true });
});

// Profil fotoğrafı yükleme
app.post('/upload-avatar', multerAvatar.single('avatar'), async (req, res) => {
    try {
        console.log('=== Upload Avatar Request ===');
        console.log('Session user:', req.session.user ? 'exists' : 'missing');
        console.log('Session userId:', req.session.userId);
        console.log('Session username:', req.session.username);
        console.log('Request file:', req.file ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            hasBuffer: !!req.file.buffer,
            hasPath: !!req.file.path
        } : 'null');
        
        if (!req.session.user || !req.session.userId) {
            console.log('Hata: Giriş edilməyib');
            return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
        }
        
        if (!req.file) {
            console.log('Hata: Dosya bulunamadı');
            return res.status(400).json({ success: false, message: 'Şəkil tapılmadı' });
        }
        
        // Buffer kontrolü
        if (!req.file.buffer && !req.file.path) {
            console.error('Hata: Ne buffer ne de path bulunamadı');
            return res.status(400).json({ success: false, message: 'Dosya məlumatı tapılmadı' });
        }
        
        const userId = req.session.userId;
        const userData = await getUserById(userId);
        
        if (!userData) {
            console.error('Hata: Kullanıcı bulunamadı - userId:', userId);
            return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
        }
        
        // Avatar'ı Supabase Storage'a yükle
        const contentType = req.file.mimetype || 'image/png';
        const ext = path.extname(req.file.originalname) || '.png';
        
        // Buffer'ı al
        let avatarBuffer;
        if (req.file.buffer) {
            avatarBuffer = req.file.buffer;
        } else if (req.file.path) {
            // Eğer path varsa, dosyayı oku
            avatarBuffer = await fs.readFile(req.file.path);
        } else {
            return res.status(400).json({ success: false, message: 'Dosya məlumatı tapılmadı' });
        }
        
        console.log('Uploading avatar to Supabase Storage for user:', userId);
        
        // Eski avatarı sil (varsa)
        if (userData.avatar) {
            try {
                // Eski avatar Supabase Storage'da mı kontrol et
                if (userData.avatar.includes('/')) {
                    // Storage path formatında (örn: 'userId/avatar.png')
                    await deleteAvatarFromStorage(userData.avatar);
                    console.log('Old avatar deleted from storage:', userData.avatar);
                }
            } catch (e) {
                console.warn('Could not delete old avatar from storage:', e.message);
                // Devam et, eski avatar'ı silmek kritik değil
            }
        }
        
        // Yeni avatar'ı Supabase Storage'a yükle
        const storageUploadResult = await uploadAvatarToStorage(userId, avatarBuffer, contentType);
        
        if (!storageUploadResult.success) {
            console.error('Error uploading avatar to Supabase Storage:', storageUploadResult.error);
            return res.status(500).json({ 
                success: false, 
                message: 'Şəkil yüklənərkən xəta yarandı: ' + (storageUploadResult.error || 'Bilinməyən xəta') 
            });
        }
        
        console.log('Avatar uploaded to Supabase Storage:', storageUploadResult.path);
        
        // Supabase'de avatar path'ini güncelle (Storage path)
        try {
            const updated = await updateUser(userId, { avatar: storageUploadResult.path });
            
            if (!updated) {
                console.error('Failed to update avatar in Supabase - updateUser returned null');
                // Dosyayı sil (Supabase'de kaydedilemedi)
                try {
                    await deleteAvatarFromStorage(storageUploadResult.path);
                } catch (e) {
                    console.warn('Could not remove avatar from storage after DB error:', e.message);
                }
                return res.status(500).json({ 
                    success: false, 
                    message: 'Şəkil verilənlər bazasında yadda saxlanıla bilmədi' 
                });
            }
            console.log('Avatar updated in Supabase successfully:', updated.id);
        } catch (updateError) {
            console.error('Error updating avatar in Supabase:', updateError);
            console.error('Error message:', updateError.message);
            console.error('Error stack:', updateError.stack);
            // Dosyayı sil (Supabase'de kaydedilemedi)
            try {
                await deleteAvatarFromStorage(storageUploadResult.path);
            } catch (e) {
                console.warn('Could not remove avatar from storage after DB error:', e.message);
            }
            return res.status(500).json({ 
                success: false, 
                message: 'Şəkil verilənlər bazasında yadda saxlanıla bilmədi: ' + updateError.message 
            });
        }
        
        // Session'ı güncelle
        if (req.session.user) {
            req.session.user.avatar = storageUploadResult.path;
        }
        
        // Public URL oluştur
        const avatarUrl = getPublicUrl(BUCKETS.AVATARS, storageUploadResult.path);
        
        console.log('Avatar upload completed successfully');
        res.json({ 
            success: true, 
            message: 'Şəkil uğurla yükləndi', 
            avatar: storageUploadResult.path,
            avatarUrl: avatarUrl
        });
    } catch (error) {
        console.error('Avatar upload error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            success: false, 
            message: 'Şəkil yüklənərkən xəta yarandı: ' + (error.message || 'Bilinməyən xəta') 
        });
    }
});

// Ek depolama satın alma sayfası
app.get('/storage', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    const userDir = path.join(__dirname, 'data', req.session.username);
    const userDataPath = path.join(userDir, 'user.json');
    if (!fs.existsSync(userDataPath)) {
        fs.writeJsonSync(userDataPath, { files: [], folders: [], avatar: null, storageUsed: 0, maxStorage: 2147483648, email: '', phone: '' });
    }
    const userData = fs.readJsonSync(userDataPath);
    // maxStorage'ı 2GB'a güncelle (sadece eski 20GB değerlerini düzelt, ek storage satın alınmışsa koru)
    if (userData.maxStorage && userData.maxStorage >= 21474836480) {
        // Eski 20GB değeri, 2GB'a düşür
        userData.maxStorage = 2147483648; // 2GB
        fs.writeJsonSync(userDataPath, userData);
    }
    res.render('storage', { user: userData });
});

// Çek gönderme
const paymentReceiptStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const receiptsDir = path.join(__dirname, 'data', 'payment-receipts');
        fs.ensureDirSync(receiptsDir);
        cb(null, receiptsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.session.username + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const uploadPaymentReceipt = multer({ storage: paymentReceiptStorage });

app.post('/submit-payment', uploadPaymentReceipt.single('receipt'), (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const { gb, price } = req.body;
    if (!gb || !price || !req.file) {
        return res.status(400).json({ success: false, message: 'Məlumatlar tam deyil' });
    }
    
    const gbAmount = parseInt(gb);
    if (gbAmount < 1 || gbAmount > 50) {
        return res.status(400).json({ success: false, message: 'GB miqdarı 1-50 arasında olmalıdır' });
    }
    
    // Payment requests dosyasına kaydet
    const paymentRequestsPath = path.join(__dirname, 'data', 'payment-requests.json');
    let paymentRequests = [];
    if (fs.existsSync(paymentRequestsPath)) {
        paymentRequests = fs.readJsonSync(paymentRequestsPath);
    }
    
    paymentRequests.push({
        id: Date.now().toString(),
        username: req.session.username,
        gb: gbAmount,
        price: parseFloat(price),
        receiptPath: req.file.path,
        receiptFilename: req.file.filename,
        submittedAt: new Date().toISOString(),
        status: 'pending' // pending, approved, rejected
    });
    
    fs.writeJsonSync(paymentRequestsPath, paymentRequests);
    
    res.json({ success: true, message: 'Çekiniz uğurla göndərildi' });
});

// Developer için çek yönetim sayfası (artık drive sayfasında filter olarak)
app.get('/payment-requests', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.redirect('/drive?filter=payment');
});

// Çek onaylama
app.post('/approve-payment', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const userDir = path.join(__dirname, 'data', req.session.username);
    const userDataPath = path.join(userDir, 'user.json');
    if (!fs.existsSync(userDataPath)) {
        return res.status(403).json({ success: false, message: 'Developer deyilsiniz' });
    }
    const userData = fs.readJsonSync(userDataPath);
    // maxStorage'ı 2GB'a güncelle (sadece eski 20GB değerlerini düzelt, ek storage satın alınmışsa koru)
    if (userData.maxStorage && userData.maxStorage >= 21474836480) {
        // Eski 20GB değeri, 2GB'a düşür
        userData.maxStorage = 2147483648; // 2GB
        fs.writeJsonSync(userDataPath, userData);
    }
    
    if (userData.status !== 'developer') {
        return res.status(403).json({ success: false, message: 'Developer deyilsiniz' });
    }
    
    const { paymentId } = req.body;
    if (!paymentId) {
        return res.status(400).json({ success: false, message: 'Payment ID təmin edilməyib' });
    }
    
    const paymentRequestsPath = path.join(__dirname, 'data', 'payment-requests.json');
    if (!fs.existsSync(paymentRequestsPath)) {
        return res.status(404).json({ success: false, message: 'Ödəniş tapılmadı' });
    }
    
    let paymentRequests = fs.readJsonSync(paymentRequestsPath);
    const payment = paymentRequests.find(p => p.id === paymentId && p.status === 'pending');
    
    if (!payment) {
        return res.status(404).json({ success: false, message: 'Ödəniş tapılmadı' });
    }
    
    // Kullanıcının maxStorage'ını artır
    const targetUserDir = path.join(__dirname, 'data', payment.username);
    const targetUserDataPath = path.join(targetUserDir, 'user.json');
    
    if (!fs.existsSync(targetUserDataPath)) {
        return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
    }
    
    const targetUserData = fs.readJsonSync(targetUserDataPath);
    
    // Mevcut maxStorage değerini al
    let currentMaxStorage = targetUserData.maxStorage || 2147483648;
    
    // Eğer maxStorage 20GB (21474836480) gibi eski bir değerse, 2GB'a düşür
    // Ama eğer zaten ek storage satın alınmışsa (2GB'dan fazla ama 20GB'dan az), koru
    if (currentMaxStorage >= 21474836480) {
        // Eski 20GB değeri, 2GB'a düşür
        currentMaxStorage = 2147483648; // 2GB
    }
    
    // Seçilen GB'ı ekle (byte cinsinden)
    const additionalBytes = payment.gb * 1024 * 1024 * 1024;
    const newMaxStorage = currentMaxStorage + additionalBytes;
    
    targetUserData.maxStorage = newMaxStorage;
    console.log(`Kullanıcı ${payment.username} için ${payment.gb} GB eklendi.`);
    console.log(`Eski maxStorage: ${(currentMaxStorage / (1024 * 1024 * 1024)).toFixed(2)} GB`);
    console.log(`Yeni maxStorage: ${(newMaxStorage / (1024 * 1024 * 1024)).toFixed(2)} GB`);
    console.log(`Eklenen: ${payment.gb} GB (${additionalBytes} bytes)`);
    
    fs.writeJsonSync(targetUserDataPath, targetUserData);
    
    // Eğer onaylayan kişi aynı zamanda çek gönderen kişiyse, session'ı da güncelle
    if (req.session.username === payment.username) {
        if (!req.session.user) {
            req.session.user = {};
        }
        req.session.user.maxStorage = newMaxStorage;
        console.log(`Session güncellendi: ${(newMaxStorage / (1024 * 1024 * 1024)).toFixed(2)} GB`);
    }
    
    // Payment request'i onaylandı olarak işaretle
    payment.status = 'approved';
    payment.approvedAt = new Date().toISOString();
    payment.approvedBy = req.session.username;
    
    fs.writeJsonSync(paymentRequestsPath, paymentRequests);
    
    res.json({ 
        success: true, 
        message: 'Ödəniş təsdiqləndi',
        newMaxStorage: targetUserData.maxStorage,
        newMaxStorageGB: (targetUserData.maxStorage / (1024 * 1024 * 1024)).toFixed(2)
    });
});

// Çek reddetme
app.post('/reject-payment', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const userDir = path.join(__dirname, 'data', req.session.username);
    const userDataPath = path.join(userDir, 'user.json');
    if (!fs.existsSync(userDataPath)) {
        return res.status(403).json({ success: false, message: 'Developer deyilsiniz' });
    }
    const userData = fs.readJsonSync(userDataPath);
    // maxStorage'ı 2GB'a güncelle (sadece eski 20GB değerlerini düzelt, ek storage satın alınmışsa koru)
    if (userData.maxStorage && userData.maxStorage >= 21474836480) {
        // Eski 20GB değeri, 2GB'a düşür
        userData.maxStorage = 2147483648; // 2GB
        fs.writeJsonSync(userDataPath, userData);
    }
    
    if (userData.status !== 'developer') {
        return res.status(403).json({ success: false, message: 'Developer deyilsiniz' });
    }
    
    const { paymentId } = req.body;
    if (!paymentId) {
        return res.status(400).json({ success: false, message: 'Payment ID təmin edilməyib' });
    }
    
    const paymentRequestsPath = path.join(__dirname, 'data', 'payment-requests.json');
    if (!fs.existsSync(paymentRequestsPath)) {
        return res.status(404).json({ success: false, message: 'Ödəniş tapılmadı' });
    }
    
    let paymentRequests = fs.readJsonSync(paymentRequestsPath);
    const payment = paymentRequests.find(p => p.id === paymentId && p.status === 'pending');
    
    if (!payment) {
        return res.status(404).json({ success: false, message: 'Ödəniş tapılmadı' });
    }
    
    // Payment request'i reddedildi olarak işaretle
    payment.status = 'rejected';
    payment.rejectedAt = new Date().toISOString();
    payment.rejectedBy = req.session.username;
    
    fs.writeJsonSync(paymentRequestsPath, paymentRequests);
    
    res.json({ success: true, message: 'Ödəniş rədd edildi' });
});

// İsim değiştirme
app.post('/update-username', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const { username } = req.body;
    if (!username || username.trim() === '') {
        return res.status(400).json({ success: false, message: 'İstifadəçi adı boş ola bilməz' });
    }
    
    const oldUsername = req.session.username;
    const userDir = path.join(__dirname, 'data', oldUsername);
    const newUserDir = path.join(__dirname, 'data', username);
    const userDataPath = path.join(userDir, 'user.json');
    
    if (!fs.existsSync(userDataPath)) {
        return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
    }
    
    // Yeni kullanıcı adı zaten varsa
    if (fs.existsSync(newUserDir) && username !== oldUsername) {
        return res.status(400).json({ success: false, message: 'Bu istifadəçi adı artıq mövcuddur' });
    }
    
    const userData = fs.readJsonSync(userDataPath);
    userData.username = username;
    
    // Klasör adını değiştir
    if (username !== oldUsername) {
        fs.moveSync(userDir, newUserDir, { overwrite: false });
    }
    
    fs.writeJsonSync(path.join(newUserDir, 'user.json'), userData);
    req.session.user = userData;
    req.session.username = username;
    
    res.json({ success: true, message: 'İstifadəçi adı uğurla dəyişdirildi' });
});

// Telefon değiştirme
app.post('/update-phone', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const { phone } = req.body;
    const userDir = path.join(__dirname, 'data', req.session.username);
    const userDataPath = path.join(userDir, 'user.json');
    
    if (!fs.existsSync(userDataPath)) {
        return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
    }
    
    const userData = fs.readJsonSync(userDataPath);
    userData.phone = phone || '';
    
    fs.writeJsonSync(userDataPath, userData);
    req.session.user = userData;
    
    res.json({ success: true, message: 'Telefon nömrəsi uğurla dəyişdirildi' });
});

// Şifre değiştirme - Kod gönderme
app.post('/request-password-change', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const userData = req.session.user;
    if (!userData.email || !userData.email.includes('@')) {
        return res.status(400).json({ success: false, message: 'Email ünvanı təyin edilməyib' });
    }
    
    const verificationCode = generateVerificationCode();
    const codeExpiry = Date.now() + 10 * 60 * 1000; // 10 dakika
    
    req.session.pendingPasswordChange = {
        email: userData.email,
        verificationCode,
        codeExpiry
    };
    
    const emailSent = await sendPasswordResetEmail(userData.email, verificationCode);
    
    if (!emailSent) {
        return res.status(500).json({ success: false, message: 'Email göndərilə bilmədi' });
    }
    
    res.json({ success: true, message: 'Doğrulama kodu email ünvanınıza göndərildi' });
});

// Şifre değiştirme - Doğrulama
app.post('/verify-password-change', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const { code, newPassword } = req.body;
    const pending = req.session.pendingPasswordChange;
    
    if (!pending) {
        return res.status(400).json({ success: false, message: 'Doğrulama kodu tapılmadı' });
    }
    
    if (Date.now() > pending.codeExpiry) {
        req.session.pendingPasswordChange = null;
        return res.status(400).json({ success: false, message: 'Doğrulama kodu müddəti bitib' });
    }
    
    if (code !== pending.verificationCode) {
        return res.status(400).json({ success: false, message: 'Yanlış doğrulama kodu' });
    }
    
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Şifrə ən azı 6 simvol olmalıdır' });
    }
    
    const userDir = path.join(__dirname, 'data', req.session.username);
    const userDataPath = path.join(userDir, 'user.json');
    
    if (!fs.existsSync(userDataPath)) {
        return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
    }
    
    const userData = fs.readJsonSync(userDataPath);
    userData.password = newPassword;
    
    fs.writeJsonSync(userDataPath, userData);
    req.session.user = userData;
    req.session.pendingPasswordChange = null;
    
    res.json({ success: true, message: 'Şifrə uğurla dəyişdirildi' });
});

// Email değiştirme - Kod gönderme
app.post('/request-email-change', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const { newEmail } = req.body;
    if (!newEmail || !newEmail.includes('@')) {
        return res.status(400).json({ success: false, message: 'Düzgün email ünvanı daxil edin' });
    }
    
    // Yeni email'in başka bir kullanıcı tarafından kullanılıp kullanılmadığını kontrol et
    const dataDir = path.join(__dirname, 'data');
    if (fs.existsSync(dataDir)) {
        const users = fs.readdirSync(dataDir);
        for (const user of users) {
            const userDataPath = path.join(dataDir, user, 'user.json');
            if (fs.existsSync(userDataPath)) {
                const userData = fs.readJsonSync(userDataPath);
        // maxStorage'ı 2GB'a güncelle (eski 20GB değerlerini düzelt)
        if (userData.maxStorage && userData.maxStorage > 2147483648) {
            userData.maxStorage = 2147483648; // 2GB
            fs.writeJsonSync(userDataPath, userData);
        }
                if (userData.email === newEmail && user !== req.session.username) {
                    return res.status(400).json({ success: false, message: 'Bu email ünvanı artıq istifadə olunur' });
                }
            }
        }
    }
    
    const verificationCode = generateVerificationCode();
    const codeExpiry = Date.now() + 10 * 60 * 1000; // 10 dakika
    
    req.session.pendingEmailChange = {
        newEmail,
        verificationCode,
        codeExpiry
    };
    
    const emailSent = await sendVerificationEmail(newEmail, verificationCode);
    
    if (!emailSent) {
        return res.status(500).json({ success: false, message: 'Email göndərilə bilmədi' });
    }
    
    res.json({ success: true, message: 'Doğrulama kodu yeni email ünvanınıza göndərildi' });
});

// Email değiştirme - Doğrulama
app.post('/verify-email-change', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const { code } = req.body;
    const pending = req.session.pendingEmailChange;
    
    if (!pending) {
        return res.status(400).json({ success: false, message: 'Doğrulama kodu tapılmadı' });
    }
    
    if (Date.now() > pending.codeExpiry) {
        req.session.pendingEmailChange = null;
        return res.status(400).json({ success: false, message: 'Doğrulama kodu müddəti bitib' });
    }
    
    if (code !== pending.verificationCode) {
        return res.status(400).json({ success: false, message: 'Yanlış doğrulama kodu' });
    }
    
    const userDir = path.join(__dirname, 'data', req.session.username);
    const userDataPath = path.join(userDir, 'user.json');
    
    if (!fs.existsSync(userDataPath)) {
        return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
    }
    
    const userData = fs.readJsonSync(userDataPath);
    userData.email = pending.newEmail;
    userData.emailVerified = true;
    
    fs.writeJsonSync(userDataPath, userData);
    req.session.user = userData;
    req.session.pendingEmailChange = null;
    
    res.json({ success: true, message: 'Email uğurla dəyişdirildi' });
});

// Klasör oluşturma
app.post('/create-folder', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const { folderPath } = req.body;
    if (!folderPath || folderPath.trim() === '') {
        return res.status(400).json({ success: false, message: 'Klasör yolu boş ola bilməz' });
    }
    
    const userDir = path.join(__dirname, 'data', req.session.username);
    const userDataPath = path.join(userDir, 'user.json');
    const userData = fs.readJsonSync(userDataPath);
    
    if (!userData.folders) {
        userData.folders = [];
    }
    
    // Klasör zaten varsa kontrol et
    const existingFolder = userData.folders.find(f => f.path === folderPath && !f.deleted);
    if (existingFolder) {
        return res.status(400).json({ success: false, message: 'Bu klasör artıq mövcuddur' });
    }
    
    const folderDir = path.join(userDir, folderPath);
    
    // Klasörü oluştur
    fs.ensureDirSync(folderDir);
    
    // Klasör bilgisini user.json'a ekle
    const now = new Date().toISOString();
    userData.folders.push({
        name: folderPath.split('/').pop(),
        path: folderPath,
        createdBy: req.session.username,
        createdAt: now,
        lastModified: now,
        starred: false,
        deleted: false,
        size: 0
    });
    
    fs.writeJsonSync(userDataPath, userData);
    
    res.json({ success: true, message: 'Klasör uğurla yaradıldı' });
});

// Klasör bilgilerini güncelle (dosya işlemlerinde kullanılacak) - Supabase versiyonu
async function updateFolderHierarchy(userId, folderPath, username) {
    // Klasörün kendisi ve tüm üst klasörlerini güncelle
    const parts = folderPath.split('/');
    const now = new Date().toISOString();
    
    for (let i = 1; i <= parts.length; i++) {
        const currentPath = parts.slice(0, i).join('/');
        if (!currentPath) continue;
        
        // Check if folder exists
        const existingFolders = await getFolders(userId, { path: currentPath });
        const folder = existingFolders.find(f => !f.deleted);
        
        if (folder) {
            // Update last modified
            await updateFolder(userId, currentPath, { last_modified: now });
        } else {
            // Create folder
            await createFolder(userId, {
                name: parts[i - 1],
                path: currentPath,
                createdBy: username || 'system',
                createdAt: now,
                lastModified: now,
                starred: false,
                deleted: false,
                size: 0
            });
        }
    }
}

// Tüm klasörleri listele
app.get('/get-folders', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const userDir = path.join(__dirname, 'data', req.session.username);
    const userDataPath = path.join(userDir, 'user.json');
    
    if (!fs.existsSync(userDataPath)) {
        return res.json({ success: true, folders: [] });
    }
    
    const userData = fs.readJsonSync(userDataPath);
    const folders = new Set();
    
    // Tüm dosyalardan klasör yollarını çıkar
    userData.files.forEach(file => {
        if (!file.deleted) {
            const relPath = file.path.replace(/\\/g, '/');
            const parts = relPath.split('/');
            if (parts.length > 1) {
                // Tüm klasör yollarını ekle
                for (let i = 1; i < parts.length; i++) {
                    const folderPath = parts.slice(0, i).join('/');
                    folders.add(folderPath);
                }
            }
        }
    });
    
    // Klasörleri isim ve path ile döndür
    const folderList = Array.from(folders).map(folderPath => ({
        name: folderPath.split('/').pop(),
        path: folderPath
    }));
    
    res.json({ success: true, folders: folderList });
});

// Dosya taşıma
app.post('/move-file', async (req, res) => {
    if (!req.session.user || !req.session.userId) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) {
        return res.status(400).json({ success: false, message: 'Köhnə və yeni yol təyin edilməlidir' });
    }
    
    const userId = req.session.userId;
    const files = await getFiles(userId, { path: oldPath });
    const fileObj = files.find(f => !f.deleted);
    
    if (!fileObj) {
        return res.status(404).json({ success: false, message: 'Fayl tapılmadı' });
    }
    
    // Dosyayı disk üzerinde taşı
    const userDir = path.join(__dirname, 'data', req.session.username);
    const oldDiskPath = path.join(userDir, oldPath);
    const newDiskPath = path.join(userDir, newPath);
    
    // Hedef klasörü oluştur
    await fs.ensureDir(path.dirname(newDiskPath));
    
    // Dosyayı taşı
    if (fs.existsSync(oldDiskPath)) {
        try {
            await fs.move(oldDiskPath, newDiskPath, { overwrite: true });
        } catch (e) {
            console.error('Dosya taşınırken hata:', e);
        }
    }
    
    // Supabase'de güncelle
    const updated = await updateFile(userId, oldPath, { path: newPath });
    
    if (!updated) {
        return res.status(500).json({ success: false, message: 'Fayl taşınarkən xəta yarandı' });
    }
    
    // Eski ve yeni klasörlerin lastModified tarihini güncelle
    const oldFolder = path.dirname(oldPath).replace(/\\/g, '/');
    const newFolder = path.dirname(newPath).replace(/\\/g, '/');
    if (oldFolder && oldFolder !== '.') {
        await updateFolderHierarchy(userId, oldFolder, req.session.username);
    }
    if (newFolder && newFolder !== '.' && newFolder !== oldFolder) {
        await updateFolderHierarchy(userId, newFolder, req.session.username);
    }
    
    res.json({ success: true, message: 'Fayl uğurla taşındı' });
});

// Klasör adını değiştirme
app.post('/rename-folder', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const { oldPath, newName } = req.body;
    if (!oldPath || !newName) {
        return res.status(400).json({ success: false, message: 'Klasör yolu və yeni ad təyin edilməlidir' });
    }
    
    const userDir = path.join(__dirname, 'data', req.session.username);
    const userDataPath = path.join(userDir, 'user.json');
    const userData = fs.readJsonSync(userDataPath);
    
    if (!userData.folders) {
        userData.folders = [];
    }
    
    const folder = userData.folders.find(f => f.path === oldPath && !f.deleted);
    if (!folder) {
        return res.status(404).json({ success: false, message: 'Klasör tapılmadı' });
    }
    
    // Yeni yol oluştur
    const parts = oldPath.split('/');
    parts[parts.length - 1] = newName;
    const newPath = parts.join('/');
    
    // Klasör zaten varsa kontrol et
    const existingFolder = userData.folders.find(f => f.path === newPath && !f.deleted);
    if (existingFolder) {
        return res.status(400).json({ success: false, message: 'Bu adlı klasör artıq mövcuddur' });
    }
    
    // Disk üzerinde klasörü taşı
    const oldDiskPath = path.join(userDir, oldPath);
    const newDiskPath = path.join(userDir, newPath);
    
    if (fs.existsSync(oldDiskPath)) {
        await fs.move(oldDiskPath, newDiskPath, { overwrite: true });
    }
    
    // İçindeki dosyaların yollarını güncelle
    userData.files.forEach(file => {
        if (!file.deleted && file.path.startsWith(oldPath + '/')) {
            file.path = file.path.replace(oldPath, newPath);
        }
    });
    
    // Alt klasörlerin yollarını güncelle
    userData.folders.forEach(f => {
        if (!f.deleted && f.path.startsWith(oldPath + '/')) {
            f.path = f.path.replace(oldPath, newPath);
        }
    });
    
    // Klasör bilgisini güncelle
    folder.name = newName;
    folder.path = newPath;
    folder.lastModified = new Date().toISOString();
    
    // Üst klasörün lastModified tarihini güncelle
    const parentPath = parts.slice(0, -1).join('/');
    if (parentPath) {
        updateFolderLastModified(userDataPath, parentPath);
    }
    
    fs.writeJsonSync(userDataPath, userData);
    
    res.json({ success: true, message: 'Klasör adı uğurla dəyişdirildi' });
});

// Klasör ulduzlama
app.post('/star-folder', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const { path: folderPath } = req.body;
    const userDir = path.join(__dirname, 'data', req.session.username);
    const userDataPath = path.join(userDir, 'user.json');
    const userData = fs.readJsonSync(userDataPath);
    
    if (!userData.folders) {
        userData.folders = [];
    }
    
    const folder = userData.folders.find(f => f.path === folderPath && !f.deleted);
    if (!folder) {
        return res.status(404).json({ success: false, message: 'Klasör tapılmadı' });
    }
    
    folder.starred = !folder.starred;
    folder.lastModified = new Date().toISOString();
    
    // Üst klasörün lastModified tarihini güncelle
    const parts = folderPath.split('/');
    const parentPath = parts.slice(0, -1).join('/');
    if (parentPath) {
        updateFolderLastModified(userDataPath, parentPath);
    }
    
    fs.writeJsonSync(userDataPath, userData);
    
    res.json({ success: true });
});

// Klasör silme
app.post('/delete-folder', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const { path: folderPath } = req.body;
    const userDir = path.join(__dirname, 'data', req.session.username);
    const userDataPath = path.join(userDir, 'user.json');
    const userData = fs.readJsonSync(userDataPath);
    
    if (!userData.folders) {
        userData.folders = [];
    }
    
    let folder = userData.folders.find(f => f.path === folderPath && !f.deleted);
    if (!folder) {
        // Klasör folders array'inde yoksa, dosyalardan klasör yapısını oluştur
        const folderName = folderPath.split('/').pop();
        const now = new Date().toISOString();
        folder = {
            name: folderName,
            path: folderPath,
            createdBy: userData.username || 'system',
            createdAt: now,
            lastModified: now,
            starred: false,
            deleted: false,
            size: 0
        };
        userData.folders.push(folder);
    }
    
    // Klasörü sil (soft delete)
    folder.deleted = true;
    folder.lastModified = new Date().toISOString();
    
    // İçindeki dosyaları sil
    userData.files.forEach(file => {
        if (!file.deleted && file.path.startsWith(folderPath + '/')) {
            file.deleted = true;
        }
    });
    
    // Alt klasörleri sil
    userData.folders.forEach(f => {
        if (!f.deleted && f.path.startsWith(folderPath + '/')) {
            f.deleted = true;
        }
    });
    
    // Üst klasörün lastModified tarihini güncelle
    const parts = folderPath.split('/');
    const parentPath = parts.slice(0, -1).join('/');
    if (parentPath) {
        updateFolderLastModified(userDataPath, parentPath);
    }
    
    fs.writeJsonSync(userDataPath, userData);
    
    res.json({ success: true, message: 'Klasör uğurla silindi' });
});

// Klasör kurtarma (restore)
app.post('/restore-folder', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const { path: folderPath } = req.body;
    const userDir = path.join(__dirname, 'data', req.session.username);
    const userDataPath = path.join(userDir, 'user.json');
    const userData = fs.readJsonSync(userDataPath);
    
    if (!userData.folders) {
        userData.folders = [];
    }
    
    let folder = userData.folders.find(f => f.path === folderPath && f.deleted);
    if (!folder) {
        // Eğer klasör folders array'inde bulunamazsa ama dosyalar varsa, klasörü oluştur
        const hasFilesInFolder = userData.files.some(file => file.path.startsWith(folderPath + '/') && file.deleted);
        if (hasFilesInFolder) {
            const folderName = folderPath.split('/').pop();
            const now = new Date().toISOString();
            folder = {
                name: folderName,
                path: folderPath,
                createdBy: userData.username || 'system',
                createdAt: now,
                lastModified: now,
                starred: false,
                deleted: true, // Şu anda deleted durumunda
                size: 0
            };
            userData.folders.push(folder);
        } else {
            return res.status(404).json({ success: false, message: 'Klasör tapılmadı' });
        }
    }
    
    // Klasörü kurtar
    folder.deleted = false;
    folder.lastModified = new Date().toISOString();
    
    // İçindeki dosyaları kurtar
    userData.files.forEach(file => {
        if (file.deleted && file.path.startsWith(folderPath + '/')) {
            file.deleted = false;
        }
    });
    
    // Alt klasörleri kurtar
    userData.folders.forEach(f => {
        if (f.deleted && f.path.startsWith(folderPath + '/')) {
            f.deleted = false;
        }
    });
    
    // Üst klasörün lastModified tarihini güncelle
    const parts = folderPath.split('/');
    const parentPath = parts.slice(0, -1).join('/');
    if (parentPath) {
        updateFolderLastModified(userDataPath, parentPath);
    }
    
    fs.writeJsonSync(userDataPath, userData);
    
    res.json({ success: true, message: 'Klasör uğurla bərpa edildi' });
});

// Klasör tamamen silme (hard delete)
app.post('/hard-delete-folder', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Giriş edilməyib' });
    }
    
    const { path: folderPath } = req.body;
    const userDir = path.join(__dirname, 'data', req.session.username);
    const userDataPath = path.join(userDir, 'user.json');
    const userData = fs.readJsonSync(userDataPath);
    
    if (!userData.folders) {
        userData.folders = [];
    }
    
    let folder = userData.folders.find(f => f.path === folderPath && f.deleted);
    if (!folder) {
        // Eğer klasör folders array'inde bulunamazsa ama dosyalar varsa, klasörü oluştur
        const hasFilesInFolder = userData.files.some(file => file.path.startsWith(folderPath + '/') && file.deleted);
        if (hasFilesInFolder) {
            const folderName = folderPath.split('/').pop();
            const now = new Date().toISOString();
            folder = {
                name: folderName,
                path: folderPath,
                createdBy: userData.username || 'system',
                createdAt: now,
                lastModified: now,
                starred: false,
                deleted: true, // Şu anda deleted durumunda
                size: 0
            };
            userData.folders.push(folder);
            fs.writeJsonSync(userDataPath, userData); // Klasörü ekle
        } else {
            // Klasör yoksa ve içinde dosya da yoksa, direkt diskten silmeyi dene
            const folderDir = path.join(userDir, folderPath);
            if (fs.existsSync(folderDir)) {
                try {
                    await fs.remove(folderDir);
                } catch (e) {
                    console.error('Klasör silinərkən xəta:', e);
                }
            }
            return res.json({ success: true, message: 'Klasör uğurla silindi' });
        }
    }
    
    // Disk üzerinde klasörü sil
    const folderDir = path.join(userDir, folderPath);
    try {
        await fs.remove(folderDir);
    } catch (e) {
        console.error('Klasör silinərkən xəta:', e);
    }
    
    // İçindeki dosyaları tamamen sil ve storageUsed'ı azalt
    const filesToDelete = userData.files.filter(file => file.path.startsWith(folderPath + '/'));
    let totalSizeToRemove = 0;
    filesToDelete.forEach(file => {
        totalSizeToRemove += (file.size || 0);
        const fileIdx = userData.files.findIndex(f => f.path === file.path);
        if (fileIdx !== -1) {
            userData.files.splice(fileIdx, 1);
        }
    });
    
    // Alt klasörleri tamamen sil
    const foldersToDelete = userData.folders.filter(f => f.path.startsWith(folderPath + '/'));
    foldersToDelete.forEach(f => {
        const folderIdx = userData.folders.findIndex(folder => folder.path === f.path);
        if (folderIdx !== -1) {
            userData.folders.splice(folderIdx, 1);
        }
    });
    
    // Klasörü user.json'dan tamamen sil
    const folderIdx = userData.folders.findIndex(f => f.path === folderPath);
    if (folderIdx !== -1) {
        userData.folders.splice(folderIdx, 1);
    }
    
    // storageUsed'ı azalt
    userData.storageUsed -= totalSizeToRemove;
    if (userData.storageUsed < 0) userData.storageUsed = 0;
    
    fs.writeJsonSync(userDataPath, userData);
    
    res.json({ success: true, message: 'Klasör tamamilə silindi' });
});

// Çıxış (logout) route
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// İletişim formu - Email gönderme
app.post('/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ success: false, message: 'Bütün sahələri doldurun' });
        }

        if (!email.includes('@')) {
            return res.status(400).json({ success: false, message: 'Düzgün email ünvanı daxil edin' });
        }

        // Email gönder
        const mailOptions = {
            from: 'samilhsv@mail.ru',
            to: 'samilhsv@mail.ru', // Kendi email adresiniz
            subject: `Drive - Yeni İletişim Mesajı: ${name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f6fa;">
                    <div style="background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #4285f4; text-align: center; margin-bottom: 30px;">Yeni İletişim Mesajı</h2>
                        
                        <div style="margin-bottom: 20px;">
                            <strong style="color: #333; display: block; margin-bottom: 5px;">Ad Soyad:</strong>
                            <p style="color: #666; margin: 0; padding: 10px; background-color: #f5f6fa; border-radius: 5px;">${name}</p>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <strong style="color: #333; display: block; margin-bottom: 5px;">Email:</strong>
                            <p style="color: #666; margin: 0; padding: 10px; background-color: #f5f6fa; border-radius: 5px;">${email}</p>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <strong style="color: #333; display: block; margin-bottom: 5px;">Mesaj:</strong>
                            <p style="color: #666; margin: 0; padding: 15px; background-color: #f5f6fa; border-radius: 5px; white-space: pre-wrap;">${message}</p>
                        </div>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eceef2; text-align: center; color: #999; font-size: 12px;">
                            <p style="margin: 0;">Bu mesaj Drive veb sayfasından göndərilmişdir.</p>
                            <p style="margin: 5px 0 0 0;">Tarix: ${new Date().toLocaleString('az-AZ')}</p>
                        </div>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: 'Mesajınız uğurla göndərildi!' });
    } catch (error) {
        console.error('İletişim email gönderme hatası:', error);
        res.status(500).json({ success: false, message: 'Email göndərilə bilmədi. Zəhmət olmasa yenidən cəhd edin.' });
    }
});

app.listen(port, () => {
    console.log(`Server http://localhost:${port} ünvanında işləyir`);
}); 