import os from 'os';
import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';
import * as cheerio from 'cheerio';
import nock from 'nock';
import { test, expect, beforeEach, beforeAll, jest } from '@jest/globals';
import {
  getHtmlFileName,
  pageLoader,
  getFolderName,
  getAbsolutePath,
  getLocalAssets,
} from '../src/pageLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const getFixturePath = (filename) =>
  path.join(__dirname, '..', '__fixtures__', filename);

nock.disableNetConnect();

const mockUrl = 'https://ru.hexlet.io/courses';
const expectedFileName = getHtmlFileName(mockUrl);
const mockImgPath = getFixturePath(
  'ru-hexlet-io-courses_files/ru-hexlet-io-wikipedia-commons-6-67-NodeJS.png'
);
const mockCssPath = getFixturePath(
  'ru-hexlet-io-courses_files/ru-hexlet-io-assets-application.css'
);
const mockJsPath = getFixturePath(
  'ru-hexlet-io-courses_files/ru-hexlet-io-packs-js-runtime.js'
);
const mockHtmlPath = getFixturePath(
  'ru-hexlet-io-courses_files/ru-hexlet-io-courses'
);

const checkFile = async (relativePath, expectedPath) => {
  const filePath = getAbsolutePath(relativePath);
  const expectedContent = await fs.readFile(expectedPath, 'utf-8');
  const expectedName = path.basename(expectedPath);
  const resultContent = await fs.readFile(filePath, 'utf-8');
  const resultName = path.basename(filePath);

  const stat = await fs.stat(filePath);
  expect(stat.isFile()).toBe(true);
  expect(resultName).toEqual(expectedName);
  expect(resultContent).toEqual(expectedContent);
};

let tempDir;
let originHtmlFile;
let expected;

beforeAll(async () => {
  originHtmlFile = await fs.readFile(getFixturePath('origin.html'), 'utf-8');
  expected = await fs.readFile(
    getFixturePath('ru-hexlet-io-courses.html'),
    'utf-8'
  );
});

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
  nock('https://ru.hexlet.io')
    .get('/courses')
    .reply(200, originHtmlFile)
    .get('/assets/application.css')
    .replyWithFile(200, mockCssPath)
    .get('/courses')
    .replyWithFile(200, mockHtmlPath)
    .get('/packs/js/runtime.js')
    .replyWithFile(200, mockJsPath);

  nock('https://upload.wikimedia.org')
    .get('/wikipedia/commons/6/67/NodeJS.png')
    .replyWithFile(200, mockImgPath);
});

test('web page loaded', async () => {
  const filePath = await pageLoader(mockUrl, tempDir);
  const result = await fs.readFile(filePath, 'utf-8');
  expect(result).toEqual(expected);
});

test('html file name is correctly created', async () => {
  const filePath = await pageLoader(mockUrl, tempDir);
  const fileName = path.basename(filePath);
  expect(fileName).toEqual(expectedFileName);
});

test('images folder is created', async () => {
  const resultPath = await pageLoader(mockUrl, tempDir);
  const filePath = getAbsolutePath(
    path.join(tempDir, getFolderName(resultPath))
  );
  const stat = await fs.stat(filePath);
  expect(stat.isDirectory()).toBe(true);
});

test('css file is correctly created', async () => {
  const resultPath = await pageLoader(mockUrl, tempDir);
  const folderName = getFolderName(resultPath);
  const fileName = path.basename(mockCssPath);
  await checkFile(path.join(tempDir, folderName, fileName), mockCssPath);
  expect(true).toBe(true);
});

test('js file is correctly created', async () => {
  const resultPath = await pageLoader(mockUrl, tempDir);
  const folderName = getFolderName(resultPath);
  const fileName = path.basename(mockJsPath);
  await checkFile(path.join(tempDir, folderName, fileName), mockJsPath);
  expect(true).toBe(true);
});

test('html file is correctly created', async () => {
  const resultPath = await pageLoader(mockUrl, tempDir);
  const folderName = getFolderName(resultPath);
  const fileName = path.basename(mockHtmlPath);
  await checkFile(path.join(tempDir, folderName, fileName), mockHtmlPath);
  expect(true).toBe(true);
});

test('catch error with wrong url', async () => {
  nock('https://ru.hexlet.io').get('/404').reply(404, '');
  const badUrl = 'https://ru.hexlet.io/404';
  await expect(pageLoader(badUrl, tempDir)).rejects.toThrow(
    `Request ${badUrl} failed with status 404`
  );
});

test('access directory error', async () => {
  jest
    .spyOn(fs, 'mkdir')
    .mockRejectedValue(new Error('EACCES: permission denied'));

  const notAccessiblePath = '/some/protected-path';
  await expect(pageLoader(mockUrl, notAccessiblePath)).rejects.toThrow(
    `Directory: ${notAccessiblePath} not exists or has no access`
  );

  fs.mkdir.mockRestore();
});

test('not exists directory', async () => {
  const notExistDir = './test';
  await expect(pageLoader(mockUrl, notExistDir)).rejects.toThrow(
    `Directory: ${notExistDir} not exists or has no access`
  );
});

test('ignores elements without required attribute', () => {
  const html = `
    <html>
      <head>
        <link href="">
        <script></script>
      </head>
      <body>
        <img>
        <img src="">
        <img src="/valid-image.png">
      </body>
    </html>
  `;
  const $ = cheerio.load(html);
  const sourceUrl = new URL(mockUrl);
  const imgElements = getLocalAssets($, 'img', 'src', sourceUrl);
  expect(imgElements).toHaveLength(1);
});
