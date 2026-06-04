/*
 * create_student.js — Create a Student Account in RoomFind
 * =========================================================
 * This script creates a student account in BOTH:
 *   1. Supabase Auth (for login credentials)
 *   2. The 'users' table (for role/name/course info)
 *
 * Usage:
 *   node create_student.js
 *
 * Or customize the students below and run once.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/villa/Downloads/RoomFind-master/RoomFind-master/server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase config. Make sure server/.env has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ─── ADD YOUR STUDENTS HERE ────────────────────────────────────────────────
const studentsToCreate = [
  {
    name:       'Juan Dela Cruz',
    email:      'juan.delacruz@university.edu',
    password:   'student123',
    department: 'BSIT 3-A',
  },
  {
    name:       'Maria Santos',
    email:      'maria.santos@university.edu',
    password:   'student123',
    department: 'BSCS 2-B',
  },
  // Add more students here by copying the block above...
];
// ───────────────────────────────────────────────────────────────────────────

async function createStudent({ name, email, password, department }) {
  console.log(`\n👤 Creating student: ${name} (${email})`);

  // Step 1: Create auth account via Supabase Admin API
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,   // ← Skips email confirmation requirement
  });

  if (authError) {
    // If user already exists in Auth, that's okay — continue to update users table
    if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
      console.log(`  ℹ️  Auth user already exists — skipping auth creation, updating users table only.`);
    } else {
      console.error(`  ❌ Auth creation failed: ${authError.message}`);
      return false;
    }
  } else {
    console.log(`  ✅ Auth account created (ID: ${authData.user.id})`);
  }

  // Step 2: Check if user already exists in the users table
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (existingUser) {
    console.log(`  ℹ️  User already in 'users' table (ID: ${existingUser.id}) — skipping insert.`);
    return true;
  }

  // Step 3: Insert into users table with role = 'student'
  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({
      name,
      email,
      department,
      role:      'student',
      is_active: true,
    })
    .select('id, name, email, role')
    .single();

  if (insertError) {
    console.error(`  ❌ Failed to insert into users table: ${insertError.message}`);
    return false;
  }

  console.log(`  ✅ User record created in DB (ID: ${newUser.id})`);
  console.log(`  📋 Role: ${newUser.role} | Name: ${newUser.name}`);
  return true;
}

async function run() {
  console.log('🎓 RoomFind — Student Account Creator');
  console.log('======================================');
  console.log(`Creating ${studentsToCreate.length} student account(s)...\n`);

  let successCount = 0;

  for (const student of studentsToCreate) {
    const ok = await createStudent(student);
    if (ok) successCount++;
  }

  console.log('\n======================================');
  console.log(`✅ Done! ${successCount}/${studentsToCreate.length} account(s) created successfully.`);
  console.log('\n📌 Login credentials:');
  studentsToCreate.forEach(s => {
    console.log(`   Email: ${s.email}  |  Password: ${s.password}`);
  });
  console.log('\n🌐 Go to: http://localhost:5173 and log in with the credentials above.');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
