const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://owtpwnwinpluptrzpwzv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93dHB3bndpbnBsdXB0cnpwd3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MjM3MjgsImV4cCI6MjA3OTE5OTcyOH0.pMyu6ad1KCB2WmhlfGcm5yayzoLLhTFDmX6XMzZjUEw';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;

