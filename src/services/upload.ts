import { Configuration } from './configuration';
import { RootDirectory } from '../environment';
import { Logger } from './logger';

import { ensureDirSync, moveSync, pathExistsSync, removeSync, move, statSync } from 'fs-extra';
import { dirname, extname, basename, join } from 'path';
import * as klawSync from 'klaw-sync';
import * as multer from 'multer';
import slugify from 'slugify';

const Upload = {
  Multer: multer({
    dest: `${RootDirectory}/${Configuration.Uploads.TempDirectory}`
  }),
  AddMetadata: (request, response) => {
    const tempPath = `${request['file'].path}`;
    let newPath = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/`;
    newPath += `${request.headers['semirandomtoken']}/`;
    newPath += `${request.headers['metadatakey']}/`;
    // Filename gets a prefix of the metadata input field selected
    const filename = `${request.headers['prefix']}-${request['file'].originalname}`;
    newPath += filename;

    ensureDirSync(dirname(newPath));
    move(tempPath, newPath).then(_ => {
      const responseObject = {
        metadata_file: filename,
        metadata_object: request.headers['metadatakey'],
        metadata_link: `models/${request.headers['semirandomtoken']}/${request.headers['metadatakey']}/${filename}`,
        metadata_format: `${extname(newPath)}`,
        metadata_size: `${statSync(newPath).size} bytes`
      };
      response.end(JSON.stringify(responseObject));
    }).catch(() => response.end(`File already exists`));
  },
  CancelMetadata: () => {
    // TODO: Either remove on it's own via request or delete with the rest of the upload cancel
  },
  UploadRequest: (request, response) => {
    // TODO: Checksum
    // TODO: Subdirectories based on request?
    const tempPath = `${request['file'].destination}/${request['file'].filename}`;
    let newPath = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/`;
    newPath += `${request.headers['semirandomtoken']}/`;
    newPath += `${request.headers['relpath']}/`;
    newPath += `${Date.now()}_${slugify(request['file'].originalname)}`;

    ensureDirSync(dirname(newPath));
    moveSync(tempPath, newPath);
    response.end('Uploaded');
  },
  UploadCancel: (request, response) => {
    const Token = request.body.uuid;
    const path = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/${Token}`;

    Logger.info(`Cancelling upload request ${Token}`);

    if (!pathExistsSync(path)) {
      response.json({ message: 'Path with this token does not exist' });
    } else {
      removeSync(path);
      response.json({ message: 'Successfully cancelled upload' });
    }
  },
  UploadFinish: async (request, response) => {
    Logger.info(request.body);
    const Token = request.body.uuid;
    const Type = request.body.type;
    const path = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/${Token}`;

    if (!pathExistsSync(path)) {
      response.json([]).end('Upload not finished');
    } else {
      const found = klawSync(path);
      // Move all files to top level
      found.filter(file => !file.stats.isDirectory())
      .forEach(file => {
        const src = file.path;
        const filename = basename(file.path);
        const dest = join(path, filename);
        moveSync(src, dest);
      });
      // Remove subdirs
      found.filter(file => file.stats.isDirectory())
      .sort((a, b) => a.path.length - b.path.length)
      .forEach(directory => removeSync(directory.path));

      const foundFiles = klawSync(path);
      // TODO: Add more filters
      const filter: string[] = [];
      switch (Type) {
        case 'model': filter.push('.ply', '.obj', '.babylon'); break;
        default: break;
      }

      const filteredFiles = await foundFiles.filter(file => {
        return filter.indexOf(extname(file.path)) !== -1;
      }); // .map(file => file.path.substr(file.path.indexOf('models/')));

      const ResponseFile = {
        file_name: '',
        file_link: '',
        file_size: 0,
        file_format: ''
      };

      const prepareResponseFiles = (fileArray: ReadonlyArray<klawSync.Item>) => {
        return fileArray.map(file => {
          const result = { ...ResponseFile };
          result.file_format = extname(file.path);
          let _relativePath = file.path.replace(RootDirectory, '');
          _relativePath = (_relativePath.charAt(0) === '/') ? _relativePath.substr(1) : _relativePath;
          console.log(_relativePath);
          result.file_link = `${_relativePath}`;
          result.file_name = `${basename(file.path)}`;
          result.file_size = parseInt(`${file.stats.size}`, 10);
          return result;
        }).sort((a, b) => a.file_size - b.file_size);
      };

      const ResponseFiles = prepareResponseFiles((filteredFiles.length > 0)
        ? filteredFiles : foundFiles);
      Logger.info(ResponseFiles);
      response.json(ResponseFiles);
    }
    response.end('Done!');
  }
};

export { Upload };
