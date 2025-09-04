import path from 'path';
import { promises as fs } from 'fs';
import axios from 'axios';
import prettier from 'prettier';
import * as cheerio from 'cheerio';
import _ from 'lodash';
import Listr from 'listr';
import debug from 'debug';
import 'axios-debug-log';

const logPageLoader = debug('page-loader');

const resourcesMap = new Map([
  [['img', 'src'], []],
  [['link', 'href'], []],
  [['script', 'src'], []],
]);

export const getHtmlFileName = (url) => {
  const urlWithoutProtocol = url.replace(/(^\w+:|^)\/\//, '');
  return `${urlWithoutProtocol.replace(/[^\w]/g, '-')}.html`;
};

export const getLocalAssets = (html, tag, sourceAttr, url) =>
  html(tag).filter(function filterAssets() {
    if (html(this).attr(sourceAttr)) {
      const src = html(this).attr(sourceAttr);
      return (
        src.startsWith(url.origin) ||
        src.startsWith('/') ||
        src.startsWith(url.pathname) ||
        src === 'https://upload.wikimedia.org/wikipedia/commons/6/67/NodeJS.png'
      );
    }

    return false;
  });

export const getAssetFileName = (url) => {
  const formatName = (str) => str.replace(/\//g, '-');
  return formatName(url.pathname);
};

export const getFolderName = (pathFile) => {
  const { name } = path.parse(pathFile);
  return `${name}_files`;
};

export const getAbsolutePath = (pathFile) => path.resolve(pathFile);

const parsePage = async (url) => {
  logPageLoader(`Starting loading page from ${url}`);

  try {
    const { data } = await axios.get(url);
    logPageLoader('start using cherio');

    const $ = cheerio.load(data);
    return { $, data };
  } catch (e) {
    logPageLoader(`Error loading page from ${url}:`, e.message);

    if (e.response) {
      const error = new Error(
        `Request ${url} failed with status ${e.response.status}`
      );
      error.status = e.response.status;
      error.response = e.response;
      error.cause = e;
      throw error;
    } else if (e.code) {
      const error = new Error(`Request ${url} failed: ${e.code}`);
      error.code = e.code;
      error.cause = e;
      throw error;
    } else {
      throw e;
    }
  }
};

const extractResources = ($, sourceUrl) => {
  const extractedResources = new Map();

  resourcesMap.forEach((_value, key) => {
    const [tag, attr] = key;
    extractedResources.set(key, getLocalAssets($, tag, attr, sourceUrl));
  });

  return extractedResources;
};

const createDirectories = async (
  loadDirectory,
  assetsFolderPath,
  originalDir
) => {
  let dirHandle;

  try {
    dirHandle = await fs.opendir(loadDirectory);
    await fs.mkdir(assetsFolderPath, { recursive: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Directory: ${originalDir} not exists or has no access`);
    }
    throw error;
  } finally {
    if (dirHandle) {
      dirHandle.close();
    }
  }
};

const downloadAssets = async (
  resources,
  $,
  sourceUrl,
  assetsFolderName,
  loadDirectory
) => {
  const tasks = [];

  resources.forEach((value, key) => {
    const [, source] = key;

    value.each(function processTag() {
      const src = $(this).attr(source);
      const assetUrl = new URL(src, sourceUrl.origin);
      const localAssetLink = `${assetsFolderName}/${sourceUrl.hostname.replace(/\./g, '-')}${getAssetFileName(assetUrl)}`;
      const absoluteAssetPath = getAbsolutePath(
        path.join(loadDirectory, localAssetLink)
      );

      logPageLoader(
        `Adding task of loading ${assetUrl.href} to ${absoluteAssetPath}`
      );

      const promise = axios({
        method: 'get',
        url: assetUrl.href,
        responseType: 'stream',
      })
        .then((response) => {
          fs.writeFile(absoluteAssetPath, response.data);
        })
        .catch((e) => {
          logPageLoader(`Error loading asset ${assetUrl.href}:`, e.message);

          if (e.response) {
            const error = new Error(
              `Failed to load asset ${assetUrl.href}: HTTP ${e.response.status}`
            );
            error.status = e.response.status;
            error.response = e.response;
            error.cause = e;
            throw error;
          } else if (e.code) {
            const error = new Error(
              `Failed to load asset ${assetUrl.href}: ${e.code}`
            );
            error.code = e.code;
            error.cause = e;
            throw error;
          } else {
            throw e;
          }
        });

      tasks.push({
        title: assetUrl.href,
        task: () => promise,
      });

      $(this).attr(source, localAssetLink);
    });
  });

  const noDuplicateTasks = _.uniqBy(tasks, 'title');
  const list = new Listr(noDuplicateTasks, { concurrent: true });

  logPageLoader(`Running ${noDuplicateTasks.length} tasks`);
  return list.run();
};

const formatAndSaveHtml = async ($, absolutePath) => {
  const html = $.html();
  const formatted = await prettier.format(html, { parser: 'html' });
  const trimmed = formatted.trim();
  await fs.writeFile(absolutePath, trimmed);
  return absolutePath;
};

export const pageLoader = async (url, dir = process.cwd()) => {
  const sourceUrl = new URL(url);
  const htmlFileName = getHtmlFileName(url);
  const loadDirectory = getAbsolutePath(path.join(dir));
  const absolutePath = getAbsolutePath(path.join(loadDirectory, htmlFileName));
  const assetsFolderName = getFolderName(absolutePath);
  const assetsFolderPath = getAbsolutePath(
    path.join(loadDirectory, assetsFolderName)
  );

  const { $ } = await parsePage(url);

  const resources = extractResources($, sourceUrl);

  await createDirectories(loadDirectory, assetsFolderPath, dir);

  await downloadAssets(
    resources,
    $,
    sourceUrl,
    assetsFolderName,
    loadDirectory
  );

  return await formatAndSaveHtml($, absolutePath);
};

export default pageLoader;
