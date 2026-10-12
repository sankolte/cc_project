// tests/verify-phase4.js
// Automated Verification Script for Phase 4 (AWS Deployment & Viva Readiness)

const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 VERIFYING PHASE 4: AWS DEPLOYMENT & VIVA READINESS');
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

const rootDir = path.resolve(__dirname, '..');
const deployScript = path.join(rootDir, 'deploy-ec2.sh');
const vivaGuide = path.join(rootDir, 'viva_guide.md');
const packageJsonFile = path.join(rootDir, 'package.json');

// 1. Verify Deployment Script
assert(fs.existsSync(deployScript), 'deploy-ec2.sh script exists');
const deployContent = fs.readFileSync(deployScript, 'utf8');
assert(deployContent.includes('pm2 start target-app/server.js'), 'deploy-ec2.sh configures target app with PM2');
assert(deployContent.includes('pm2 start monitor-server/server.js'), 'deploy-ec2.sh configures monitor server with PM2');
assert(deployContent.includes('checkip.amazonaws.com'), 'deploy-ec2.sh dynamically prints public IP dashboard link');

// 2. Verify Viva Defense Guide
assert(fs.existsSync(vivaGuide), 'viva_guide.md exists');
const vivaContent = fs.readFileSync(vivaGuide, 'utf8');
assert(vivaContent.includes('Live Demonstration Script'), 'viva_guide.md includes 5-minute live demo script');
assert(vivaContent.includes('Top 10 Viva Questions'), 'viva_guide.md includes curated viva questions and answers');
assert(vivaContent.includes('Why did you use Amazon SQS'), 'viva_guide.md covers SQS loose coupling question');
assert(vivaContent.includes('Dual-Tier Storage'), 'viva_guide.md covers S3 + RDS storage tier question');
assert(vivaContent.includes('AWS IAM'), 'viva_guide.md covers cloud security & least privilege');

// 3. Verify Master package.json commands
const pkg = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
assert(!!pkg.scripts['start:target'], 'package.json contains start:target script');
assert(!!pkg.scripts['start:monitor'], 'package.json contains start:monitor script');
assert(!!pkg.scripts['simulate:normal'], 'package.json contains simulate:normal script');
assert(!!pkg.scripts['simulate:slow'], 'package.json contains simulate:slow script');
assert(!!pkg.scripts['simulate:error'], 'package.json contains simulate:error script');
assert(!!pkg.scripts['test:all'], 'package.json contains master test:all script');

console.log('\n----------------------------------------------------');
console.log(`📊 RESULTS: ${passedTests}/${totalTests} Tests Passed`);
console.log('----------------------------------------------------');

if (passedTests === totalTests) {
  console.log('🎉 Phase 4 verification complete and successful!\n');
  process.exit(0);
} else {
  console.error('⚠️ Phase 4 has failing checks.\n');
  process.exit(1);
}
