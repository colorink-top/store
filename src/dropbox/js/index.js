import { BaseStore } from '../../base/js/base.js'

const STORAGEKEY = 'dropboxTokenInfo'
const redirect_uri = document.location.origin + '/dropbox/callback.html'
//const dbx = new Dropbox.Dropbox({ clientId: "clu8ul5tzsgxrwn"})
const dbx = new Dropbox.Dropbox({ clientId: "ycf1b81wwb1930c"})


const checkAuthFn = async (initInfo={})=>{
  initInfo = initInfo || {}
  const tokenInfoStr = localStorage.getItem(STORAGEKEY) || ''
  try{
    const tokenInfo = initInfo.authInfo || JSON.parse(tokenInfoStr)
    if (!tokenInfo || !tokenInfo.accessToken || !tokenInfo.accessTokenSecret) return false
    dbx.auth.setAccessToken(tokenInfo.accessToken)
    dbx.auth.setRefreshToken(tokenInfo.accessTokenSecret)
  } catch(err){
    console.log('err', err)
    return false
  }
  try {
    await dbx.auth.checkAndRefreshAccessToken()
  } catch (err ) {
    console.log('refresh err', err)
    localStorage.removeItem(STORAGEKEY)
    return false
  }
  return true
}

const authFn = async ()=>{

  const authUrl = await dbx.auth.getAuthenticationUrl(redirect_uri, undefined, 'code', 'offline', undefined, undefined, true)
  const opener = window.open(authUrl, 'dropbox', 'popup=true,width=800,height=800')
  return new Promise((resolve, reject)=>{
    const messageFn = (event)=>{
      if (event.source === window) {
        return;
      }
      const msg = event.data || {}
      switch (msg.type) {
        case "accessToken": {
          const searchInfo = msg.data.searchInfo
          opener.close()
          dbx.auth.getAccessTokenFromCode(redirect_uri, searchInfo.code).then((_response)=>{
            const codeResult = _response.result;
            const tokenInfo = {
              accessToken: codeResult.access_token,
              accessTokenSecret: codeResult.refresh_token
            }
            dbx.auth.setAccessToken(tokenInfo.accessToken)
            dbx.auth.setRefreshToken(tokenInfo.accessTokenSecret)
            localStorage.setItem(STORAGEKEY, JSON.stringify(tokenInfo))
            resolve(tokenInfo)
          }).catch((err)=>{
            reject(err.message||err.error||err)
            console.log('get access token fail:', err)
          })
          window.removeEventListener("message", messageFn);
          break
        }
      }
    }
    window.addEventListener("message", messageFn);
  })
}

const uploadFileFn = async (file) => {
  //const UPLOAD_FILE_SIZE_LIMIT = 150 * 1024 * 1024;
  const UPLOAD_FILE_SIZE_LIMIT = 50 * 1024 * 1024;
  return new Promise((resolve, reject)=>{
    if (file.size < UPLOAD_FILE_SIZE_LIMIT) {
      //dbx.auth.setAccessToken('xxxx')
      // File is smaller than 150 MB - use filesUpload API
      dbx
        .filesUpload({ path: "/" + file.name, contents: file, mode: { ".tag": "overwrite" }})
        .then(function (response) {
          var results = document.getElementById("results");
          var br = document.createElement("br");
          results.appendChild(document.createTextNode("File uploaded!"));
          results.appendChild(br);
          console.log(response);
          resolve(response.result)
        })
        .catch(function (error) {
          reject(error.message || error.error || error)
          console.error(error.error || error);
        });
    } else {
      // File is bigger than 150 MB - use filesUploadSession* API
      const maxBlob = 10 * 1024 * 1024; // 8MB - Dropbox JavaScript API suggested chunk size

      var workItems = [];

      var offset = 0;

      while (offset < file.size) {
        var chunkSize = Math.min(maxBlob, file.size - offset);
        workItems.push(file.slice(offset, offset + chunkSize));
        offset += chunkSize;
      }

      const task = workItems.reduce((acc, blob, idx, items) => {
        if (idx == 0) {
          // Starting multipart upload of file
          return acc.then(function () {
            return dbx
              .filesUploadSessionStart({ close: false, contents: blob })
              .then((response) => response.result.session_id);
          });
        } else if (idx < items.length - 1) {
          // Append part to the upload session
          return acc.then(function (sessionId) {
            var cursor = { session_id: sessionId, offset: idx * maxBlob };
            return dbx
              .filesUploadSessionAppendV2({
                cursor: cursor,
                close: false,
                contents: blob,
              })
              .then(() => sessionId);
          });
        } else {
          // Last chunk of data, close session
          return acc.then(function (sessionId) {
            var cursor = { session_id: sessionId, offset: file.size - blob.size };
            var commit = {
              path: "/" + file.name,
              mode: "add",
              autorename: true,
              mute: false,
            };
            return dbx.filesUploadSessionFinish({
              cursor: cursor,
              commit: commit,
              contents: blob,
            });
          });
        }
      }, Promise.resolve());

      task
        .then(function (response) {
          const results = document.getElementById("results");
          results.appendChild(document.createTextNode("File uploaded!"));
          console.log('large file success:::', response)
          resolve(response.result)
        })
        .catch(function (error) {
          reject(error.message || error.error || error)
          console.error(error);
        });
    }
  })
};


class DropboxStore extends BaseStore {
  async checkAuth(initInfo) {
    return await checkAuthFn(initInfo)
  }
  async auth(){
    return await authFn()
  }
  async uploadFile(file){
    const result = await uploadFileFn(file)
    const url = ``
    return {
      pdfInfo: file._pdfInfo,
      msg: `Upload success location: Apps/colorink.top/${_.escape(result.name)}`,
      fileId: result.id,
      url
    }
  }
}

const init = async () => {
  const dropboxStore = new DropboxStore();
  dropboxStore.start()
};

init()
