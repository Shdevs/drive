-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    storage_used BIGINT DEFAULT 0,
    max_storage BIGINT DEFAULT 2147483648, -- 2GB default
    avatar TEXT, -- Supabase Storage path (örn: 'userId/avatar.png')
    email_verified BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'user', -- 'user' or 'developer'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create files table
CREATE TABLE IF NOT EXISTS files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    size BIGINT NOT NULL,
    storage_path TEXT, -- Supabase Storage path (örn: 'userId/folder1/file.txt')
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    starred BOOLEAN DEFAULT false,
    deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, path)
);

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    starred BOOLEAN DEFAULT false,
    deleted BOOLEAN DEFAULT false,
    size BIGINT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, path)
);

-- Create payment_requests table
CREATE TABLE IF NOT EXISTS payment_requests (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    gb INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    receipt_path TEXT,
    receipt_filename TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejected_by TEXT
);

-- Create verification_codes table for email verification
CREATE TABLE IF NOT EXISTS verification_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    type TEXT NOT NULL, -- 'registration', 'password_reset', 'email_change', 'password_change'
    username TEXT,
    user_data JSONB, -- For storing registration data
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for verification codes
CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(deleted);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path);
CREATE INDEX IF NOT EXISTS idx_folders_deleted ON folders(deleted);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

