const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const apiDir = path.join(projectRoot, 'src', 'app', 'api');
const apiBackupDir = path.join(projectRoot, 'src', 'app', '_api');

console.log('🚀 Starting Electron Build Process...');

// 0. Cleanup old builds
console.log('🧹 Cleaning up old build artifacts...');
const dirsToClean = ['.next', 'out', 'dist'];
dirsToClean.forEach(dir => {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
    }
});

try {
    const isWin = process.platform === 'win32';
    const moveCmd = isWin ? 'move' : 'mv';

    // 1. Rebuild native addons for Electron (better-sqlite3)
    console.log('🔧 Rebuilding native addons for Electron...');
    try {
        execSync('npx electron-rebuild -f -w better-sqlite3', {
            stdio: 'inherit',
            cwd: projectRoot,
        });
        console.log('✅ Native addons rebuilt for Electron');
    } catch (e) {
        console.warn('⚠️ electron-rebuild failed (better-sqlite3 may still work):', e.message);
    }

    // 2. Rename api to _api to ignore it during static build
    if (fs.existsSync(apiDir)) {
        console.log('📦 Hiding API routes for static export...');
        try {
            execSync(`${moveCmd} "${apiDir}" "${apiBackupDir}"`, { stdio: 'inherit' });
        } catch (e) {
            console.log('⚠️ Shell move failed, falling back to fs.renameSync...');
            try { fs.renameSync(apiDir, apiBackupDir); } catch (err) { console.error('CRITICAL: Rename failed', err.message); }
        }
    }

    // 3. Run next build with relative asset paths for file:// protocol
    console.log('🏗️ Running next build...');
    execSync('npx next build', { stdio: 'inherit', env: { ...process.env, ELECTRON_BUILD: 'true' } });

    // 4. Rename back
    if (fs.existsSync(apiBackupDir)) {
        console.log('✅ Restoring API routes...');
        try {
            execSync(`${moveCmd} "${apiBackupDir}" "${apiDir}"`, { stdio: 'inherit' });
        } catch (e) {
            try { fs.renameSync(apiBackupDir, apiDir); } catch (err) { console.error('CRITICAL: Restore failed', err.message); }
        }
    }

    // 5. Run electron-builder
    console.log('📦 Packaging Electron app...');
    execSync('npx electron-builder', { stdio: 'inherit' });

    // 6. Print success and install instructions
    const distDir = path.join(projectRoot, 'dist');
    const appPath = path.join(distDir, 'Voz Flow.app');
    const dmgFiles = fs.existsSync(distDir)
        ? fs.readdirSync(distDir).filter(f => f.endsWith('.dmg'))
        : [];

    console.log('\n✨ Build successful!\n');
    console.log('📁 Output: /dist/');

    if (dmgFiles.length > 0) {
        console.log(`💿 DMG: dist/${dmgFiles[0]}`);
        console.log('\n📋 Para instalar:');
        console.log(`   1. Abre dist/${dmgFiles[0]}`);
        console.log('   2. Arrastra "Voz Flow" a Applications');
        console.log('   3. Abre desde Launchpad o Spotlight');
    }

    if (fs.existsSync(appPath)) {
        console.log('\n⚡ Para probar rapido sin instalar:');
        console.log('   open "dist/Voz Flow.app"');
    }

    console.log('\n⚠️ Si macOS bloquea la app:');
    console.log('   Preferencias del Sistema → Seguridad → "Abrir de todos modos"');

} catch (error) {
    console.error('❌ Build failed:', error.message);

    // Safety: ensure API dir is restored even if build fails
    if (fs.existsSync(apiBackupDir)) {
        console.log('⚠️ Recovering API routes after failure...');
        fs.renameSync(apiBackupDir, apiDir);
    }
    process.exit(1);
}
