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

export const getLocalAssets = (html, tag, sourceAttr, url) => html(tag)
  .filter(function filterAssets() {
    if (html(this).attr(sourceAttr)) {
      return html(this).attr(sourceAttr).startsWith(url.origin)
      || html(this).attr(sourceAttr).startsWith('/')
      || html(this).attr(sourceAttr).startsWith(url.pathname);
    }

    return false;
  });

export const getAssetFileName = (url) => {
  const formatName = (str) => str.replace(/\//g, '-');
  return path.extname(url.pathname) ? formatName(url.pathname) : `${formatName(url.pathname)}.html`;
};

export const getFolderName = (pathFile) => {
  const { name } = path.parse(pathFile);
  return `${name}_files`;
};

export const getAbsolutePath = (pathFile) => path.resolve(pathFile);

export const pageLoader = async (url, dir = process.cwd()) => {
  const tasks = [];
  const sourceUrl = new URL(url);
  const htmlFileName = getHtmlFileName(url);
  const loadDirectory = getAbsolutePath(path.join(dir));
  const absolutePath = getAbsolutePath(path.join(loadDirectory, htmlFileName));
  const assetsFolderName = getFolderName(absolutePath);
  const assetsFolderPath = getAbsolutePath(path.join(loadDirectory, assetsFolderName));
  let htmlResult;
  let dirHandle;

  logPageLoader(`Starting loading page from ${url} to ${dir}`);

  return axios.get(url)
    .then(({ data }) => {
      logPageLoader('start using cherio');

      const $ = cheerio.load(data);
      htmlResult = $;

      resourcesMap.forEach((_value, key) => {
        const [tag, attr] = key;
        resourcesMap.set(key, getLocalAssets($, tag, attr, sourceUrl));
      });
    })
    .catch((e) => {
      if (e.response.status !== 200) {
        throw new Error(`Request ${url} failed, status code: ${e.response.status}`);
      }
    })
    .then(() => fs.opendir(loadDirectory)
      .catch(() => {
        throw new Error(`Directory: ${dir} not exists or has no access`);
      }))
    .then((handle) => {
      dirHandle = handle;
      return fs.mkdir(assetsFolderPath);
    })
    .finally(() => {
      if (dirHandle) {
        dirHandle.close();
      }
    })
    .then(() => {
      resourcesMap.forEach((value, key) => {
        const [, source] = key;

        value.each(function processTag() {
          const src = htmlResult(this).attr(source);
          const assetUrl = new URL(src, sourceUrl.origin);
          const downloadAssetUrl = `${assetUrl.href}`;
          const localAssetLink = `${assetsFolderName}/${sourceUrl.hostname.replace(/\./g, '-')}${getAssetFileName(assetUrl)}`;
          const absoluteAssetPath = getAbsolutePath(path.join(loadDirectory, localAssetLink));

          logPageLoader(`Adding task of loading ${assetUrl.href} to ${absoluteAssetPath}`);

          const promise = axios({
            method: 'get',
            url: downloadAssetUrl,
            responseType: 'stream',
          })
            .then((response) => {
              fs.writeFile(absoluteAssetPath, response.data);
            });

          tasks.push({
            title: downloadAssetUrl,
            task: () => promise,
          });

          htmlResult(this).attr(source, localAssetLink);
        });
      });
      const noDuplicateTasks = _.uniqBy(tasks, 'title');
      const list = new Listr(noDuplicateTasks, { concurrent: true });

      logPageLoader(`Running ${noDuplicateTasks.length} tasks`);
      return list.run();
    })
    .then(() => htmlResult.html())
    .then((data) => prettier.format(data, { parser: 'html' }))
    .then((html) => html.trim())
    .then((formatedHtml) => fs.writeFile(absolutePath, formatedHtml))
    .then(() => absolutePath);
};

export default pageLoader;