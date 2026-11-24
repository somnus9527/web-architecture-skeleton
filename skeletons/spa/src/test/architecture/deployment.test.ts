import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.cwd();

async function readProjectFile(filePath: string): Promise<string> {
  return await readFile(path.join(ROOT_DIR, filePath), 'utf8');
}

describe('SPA deployment contract', () => {
  it('uses the normal Vite production build without secondary packaging', async () => {
    const packageJson = JSON.parse(await readProjectFile('package.json'));

    expect(packageJson.scripts['build:prod']).toContain('run-vite-with-env.mjs');
    expect(packageJson.scripts).not.toHaveProperty('build:dist:prod');
    expect(packageJson.scripts).not.toHaveProperty('start:prod');
  });

  it('keeps the deployment script limited to Nginx reload commands', async () => {
    const deployScript = await readProjectFile('scripts/deploy.sh');

    expect(deployScript).toContain('nginx -t && nginx -s reload');
    expect(deployScript).not.toContain('NGINX_BIN');
    expect(deployScript).not.toContain('case ');
    expect(deployScript).not.toContain('pm2');
  });

  it('emits release metadata and preserves SPA history fallback', async () => {
    const viteConfig = await readProjectFile('vite.config.ts');
    const nginxConfig = await readProjectFile('docs/deployment/nginx.example.conf');

    expect(viteConfig).toContain("fileName: 'version.json'");
    expect(viteConfig).not.toContain('outDir');
    expect(nginxConfig).toContain('try_files $uri $uri/ /<project-id>/index.html');
    expect(nginxConfig).toContain('proxy_pass http://127.0.0.1:<api-port>');
    expect(nginxConfig).toContain('Cache-Control "no-store, max-age=0"');
    expect(nginxConfig).toContain('Cache-Control "public, max-age=31536000, immutable"');
  });
});
