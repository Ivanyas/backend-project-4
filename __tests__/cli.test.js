import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const pageLoaderPath = join(projectRoot, 'bin', 'pageLoader.js');

describe('CLI tests', () => {
  let tempDir;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(join(process.cwd(), 'test-cli-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('positive cases', () => {
    test('should show help when called with -h', () => {
      const output = execSync(`node ${pageLoaderPath} -h`, { encoding: 'utf8' });
      expect(output).toContain('Page loader utility');
      expect(output).toContain('-o, --output');
      expect(output).toContain('<url>');
    });

    test('should show version when called with -V', () => {
      const output = execSync(`node ${pageLoaderPath} -V`, { encoding: 'utf8' });
      expect(output).toContain('1.0.0');
    });

    test('should show help when called with --help', () => {
      const output = execSync(`node ${pageLoaderPath} --help`, { encoding: 'utf8' });
      expect(output).toContain('Page loader utility');
      expect(output).toContain('-o, --output');
      expect(output).toContain('<url>');
    });

    test('should show version when called with --version', () => {
      const output = execSync(`node ${pageLoaderPath} --version`, { encoding: 'utf8' });
      expect(output).toContain('1.0.0');
    });
  });

  describe('error cases', () => {
    test('should handle connection refused errors gracefully', () => {
      try {
        execSync(`node ${pageLoaderPath} -o ${tempDir} http://localhost:9999/nonexistent`, { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        fail('Expected command to fail');
      } catch (error) {
        expect(error.status).toBe(1);
        expect(error.stdout).toBe('');
        expect(error.stderr).toContain('Request http://localhost:9999/nonexistent failed: ECONNREFUSED');
      }
    });

    test('should handle invalid URLs gracefully', () => {
      try {
        execSync(`node ${pageLoaderPath} -o ${tempDir} invalid-url`, { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        fail('Expected command to fail');
      } catch (error) {
        expect(error.status).toBe(1);
        expect(error.stdout).toBe('');
        expect(error.stderr).toContain('Invalid URL');
      }
    });

    test('should handle non-existent output directories gracefully', () => {
      const nonExistentDir = join(tempDir, 'non-existent-subdir');
      try {
        execSync(`node ${pageLoaderPath} -o ${nonExistentDir} https://httpbin.org/html`, { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        fail('Expected command to fail');
      } catch (error) {
        expect(error.status).toBe(1);
        expect(error.stdout).toBe('');
        expect(error.stderr).toContain('Directory:');
        expect(error.stderr).toContain('not exists or has no access');
      }
    });

    test('should handle missing URL argument gracefully', () => {
      try {
        execSync(`node ${pageLoaderPath} -o ${tempDir}`, { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        fail('Expected command to fail');
      } catch (error) {
        expect(error.status).toBe(1);
        expect(error.stdout).toBe('');
        expect(error.stderr).toContain('error: missing required argument');
      }
    });

    test('should handle malformed URLs gracefully', () => {
      try {
        execSync(`node ${pageLoaderPath} -o ${tempDir} "not-a-url"`, { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        fail('Expected command to fail');
      } catch (error) {
        expect(error.status).toBe(1);
        expect(error.stdout).toBe('');
        expect(error.stderr).toContain('Invalid URL');
      }
    });
  });

  describe('integration cases', () => {
    test('should successfully download a simple page', () => {
      // This test requires a working internet connection
      // We'll use a simple, reliable URL
      const output = execSync(`node ${pageLoaderPath} -o ${tempDir} https://httpbin.org/html`, { 
        encoding: 'utf8' 
      });
      
      expect(output).toContain('Page was successfully loaded into');
      
      // Check that files were created
      const files = fs.readdirSync(tempDir);
      expect(files.length).toBeGreaterThan(0);
      
      // Should have an HTML file
      const htmlFiles = files.filter(file => file.endsWith('.html'));
      expect(htmlFiles.length).toBeGreaterThan(0);
    });

    test('should use default output directory when not specified', () => {
      const output = execSync(`node ${pageLoaderPath} https://httpbin.org/html`, { 
        encoding: 'utf8',
        cwd: tempDir
      });
      
      expect(output).toContain('Page was successfully loaded into');
      
      // Check that files were created in the current working directory
      const files = fs.readdirSync(tempDir);
      expect(files.length).toBeGreaterThan(0);
    });
  });
});
