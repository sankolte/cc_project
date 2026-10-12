// tests/verify-phase0.js
// Verification script for Phase 0 deliverables

const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 VERIFYING PHASE 0: SETUP & DATABASE SCHEMA DESIGN');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
  }
}

// 1. Verify Directory Structure
const rootDir = path.resolve(__dirname, '..');
const targetAppDir = path.join(rootDir, 'target-app');
const monitorServerDir = path.join(rootDir, 'monitor-server');
const schemaFile = path.join(rootDir, 'schema.sql');
const envExampleFile = path.join(rootDir, '.env.example');

assert(fs.existsSync(targetAppDir), 'Directory target-app/ exists');
assert(fs.existsSync(monitorServerDir), 'Directory monitor-server/ exists');
assert(fs.existsSync(schemaFile), 'File schema.sql exists');
assert(fs.existsSync(envExampleFile), 'File .env.example exists');

// 2. Verify schema.sql Table Definitions
const schemaContent = fs.readFileSync(schemaFile, 'utf8');

assert(schemaContent.includes('CREATE TABLE IF NOT EXISTS telemetry_logs'), 'schema.sql defines telemetry_logs table');
assert(schemaContent.includes('CREATE TABLE IF NOT EXISTS metrics'), 'schema.sql defines metrics table');
assert(schemaContent.includes('CREATE TABLE IF NOT EXISTS incidents'), 'schema.sql defines incidents table');
assert(schemaContent.includes('idx_telemetry_timestamp'), 'schema.sql includes indexing for telemetry timestamps');
assert(schemaContent.includes('idx_incidents_status'), 'schema.sql includes indexing for incident statuses');

// 3. Verify .env.example contents
const envContent = fs.readFileSync(envExampleFile, 'utf8');
assert(envContent.includes('MONITOR_PORT'), '.env.example specifies MONITOR_PORT');
assert(envContent.includes('DB_HOST'), '.env.example specifies RDS/PostgreSQL DB_HOST');
assert(envContent.includes('AWS_SQS_QUEUE_URL'), '.env.example specifies AWS_SQS_QUEUE_URL');
assert(envContent.includes('AWS_S3_BUCKET'), '.env.example specifies AWS_S3_BUCKET');
assert(envContent.includes('USE_MOCK_AWS'), '.env.example specifies USE_MOCK_AWS toggle');

// 4. Verify package.json configurations
const targetPkg = JSON.parse(fs.readFileSync(path.join(targetAppDir, 'package.json'), 'utf8'));
const monitorPkg = JSON.parse(fs.readFileSync(path.join(monitorServerDir, 'package.json'), 'utf8'));

assert(targetPkg.name === 'target-app', 'target-app/package.json configured properly');
assert(monitorPkg.name === 'monitor-server', 'monitor-server/package.json configured properly');
assert(monitorPkg.dependencies['pg'], 'monitor-server includes pg (PostgreSQL/RDS driver)');
assert(monitorPkg.dependencies['@aws-sdk/client-sqs'], 'monitor-server includes AWS SQS SDK');
assert(monitorPkg.dependencies['@aws-sdk/client-s3'], 'monitor-server includes AWS S3 SDK');

console.log('\n----------------------------------------------------');
console.log(`📊 RESULTS: ${passedTests}/${totalTests} Tests Passed`);
console.log('----------------------------------------------------');

if (passedTests === totalTests) {
  console.log('🎉 Phase 0 verification complete and successful!\n');
  process.exit(0);
} else {
  console.error('⚠️ Phase 0 has failing checks.\n');
  process.exit(1);
}
