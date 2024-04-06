import { BaseStore } from "../../base/js/base.js";

const STORAGEKEY = 'boxTokenInfo'

const client_id = 'gxyw8taes78auz49fqt9qofw5fq8wer6';
const client_secret = '';
//const redirect_uri = 'http://localhost:2022/box/callback.html'
//const redirect_uri = 'https://store.colorink.top/box/callback.html'
const redirect_uri = document.location.origin + '/box/callback.html';
const scope = 'root_readwrite'
const apiHost = 'https://api.box.com/2.0'
//const accessTokenUrl = 'http://localhost:3034/oauth2/box'
const accessTokenUrl = 'https://oauth.colorink.top/oauth2/box'

let tokenInfo = null

const rebuildFilenameFn = (_filename)=>{
  if (/\.pdf$/i.test(_filename)) {
    let filename = _filename.substring(0, _filename.length - 4) 
    filename = filename.substring(0,50)
    return filename + '.pdf'
  }
  return _filename
}

const checkAuthFn = async (initInfo={})=>{
  initInfo = initInfo || {}
  const tokenInfoStr = localStorage.getItem(STORAGEKEY) || ''
  try{
    tokenInfo = initInfo.authInfo || JSON.parse(tokenInfoStr)
    if (!tokenInfo || !tokenInfo.accessToken || !tokenInfo.accessTokenSecret) return false
//    dbx.auth.setAccessToken(tokenInfo.accessToken)
//    dbx.auth.setRefreshToken(tokenInfo.accessTokenSecret)
  } catch(err){
    console.log('err', err)
    return false
  }
  try {
    console.log('zzzz')
    let req = await fetch(
      apiHost + "/users/me",
      {
        headers: {
          Accept: "application/json",
          Authorization: "Bearer " + tokenInfo.accessToken,
        },
        method: "GET",
      }
    );
    let result = await req.json()
    console.log('check auth result', result)
    if (result.id) {
      // 不需要再认证了
      return true
    }
  }
  catch (err){}
  try {
    return await refreshTokenFn()
//    await dbx.auth.checkAndRefreshAccessToken()
  } catch (err ) {
    console.log('refresh err', err)
    localStorage.removeItem(STORAGEKEY)
    return false
  }
  return true
}

const refreshTokenFn = async ()=>{
  console.log('get refresh token', tokenInfo)
  const req = await fetch(accessTokenUrl + '?' +  new URLSearchParams({
    redirect_uri,
    refresh_token: tokenInfo.accessTokenSecret
  }))
  const result = await  req.json()
  console.log('refresh token', result)
  if (result.accessToken && result.accessTokenSecret) {
    tokenInfo = result;
    localStorage.setItem(STORAGEKEY, JSON.stringify(tokenInfo))
    return true
  } else {
    return false
  }
}

const authFn = async ()=>{

  const uri = 'https://account.box.com/api/oauth2/authorize?' + new URLSearchParams({
    response_type: 'code',
    scope,
    state: Date.now() + '',
    client_id,
    redirect_uri,
  })
  const opener = window.open(uri, 'box', 'popup=true,width=800,height=800')
  return new Promise((resolve, reject)=>{
    const messageFn = (event)=>{
      if (event.source === window) {
        return;
      }
      const msg = event.data || {}
      switch (msg.type) {
        case "accessToken": {
          const searchInfo = msg.data.searchInfo
          const req = fetch(accessTokenUrl + '?' +  new URLSearchParams({
            redirect_uri,
            code: searchInfo.code
          })).then((res)=> res.json()).then((reqJson)=>{
            if (reqJson.error) {
              throw reqJson
            }
            tokenInfo = reqJson
            localStorage.setItem(STORAGEKEY, JSON.stringify(tokenInfo))
            resolve(tokenInfo)
          }).catch((err)=>{
            reject(err.message||err.error||err)
          })
          opener.close()
          window.removeEventListener("message", messageFn);
          return
          // onedrice cant use web get accesstoken
          fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            headers: {
              Accept: "application/json",
              'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            method: 'POST',
            body: new URLSearchParams({
              client_id,
              client_secret,
              redirect_uri: redirect_uri,
              grant_type: 'authorization_code',
              code: searchInfo.code
            })
          }).then((res)=> res.json()).then((result)=>{
            console.log('accesstoken::;', result)
            tokenInfo = {
              accessToken: result.access_token,
              accessTokenSecret: result.refresh_token,
              extraInfo: result
            }
            localStorage.setItem(STORAGEKEY, JSON.stringify(tokenInfo))
            resolve(tokenInfo)
          }).catch((err)=>{
            reject(err.message||err.error||err)
            console.log('get access token fail:', err)
          })
          opener.close()
          window.removeEventListener("message", messageFn);
          break
        }
      }
    }
    window.addEventListener("message", messageFn);
  })
}

const createOrUpdateFolderFn = async () => {
  let req = await fetch(apiHost + '/folders', {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer " + tokenInfo.accessToken,
    },
    method: "POST",
    body: JSON.stringify({
      name: 'colorink.top',
      parent: {
        id: "0"
      }
    })
  })
  let result = await req.json()
  if (result.status == 409 && result.context_info.conflicts) {
    result = result.context_info.conflicts[0]
  }
  return result.id
};


const getFileFn = async (filename, foldId)=>{
  const response = await fetch(apiHost + '/files/content',
  {
    headers: {
      Accept: "application/json",
      'Content-Type': 'application/json',
      Authorization: "Bearer " + tokenInfo.accessToken,
    },
    method: "OPTIONS",
    body: JSON.stringify({
      name: filename,
      parent: { id: foldId }
    })
  })
  const result =  await response.json()
  if (result && result.status == 409 && result.context_info?.conflicts) {
    return result.context_info.conflicts
  }
  return null
}

const uploadFileFn = async (file) => {
  const UPLOAD_FILE_SIZE_LIMIT = 50 * 1024 * 1024;
  if (file.size < UPLOAD_FILE_SIZE_LIMIT) {
    //dbx.auth.setAccessToken('xxxx')
    // File is smaller than 150 MB - use filesUpload API
    const parentFoldId = await createOrUpdateFolderFn()
    const filename = rebuildFilenameFn(file.name)
    const existFile = await getFileFn(filename, parentFoldId)
    let uploadUrl = 'https://upload.box.com/api/2.0/files/content';
    if (existFile){
      uploadUrl = `https://upload.box.com/api/2.0/files/${existFile.id}/content`;
    }
    const metadata = {
      name: filename,
      parent: {id: parentFoldId}
    };
    var form = new FormData();
    form.append(
      "attributes",
      JSON.stringify(metadata)
    );
    form.append("file", file);
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Accept': "application/json",
        'Authorization': 'Bearer ' + tokenInfo.accessToken,
      },
      body: form
    })
    let result = await response.json()
    if (result.error) {
      throw result.error
    }
    if (result.total_count != 1) {
      throw 'fail'
    }
    result = result.entries[0]
    console.log('upload success', result)
    var results = document.getElementById("results");
    var br = document.createElement("br");
    results.appendChild(document.createTextNode("File uploaded!"));
    results.appendChild(br);
    return result
  } else {
    throw "file too large";
    return;
    const chunkSize = 4 * 1024 * 1024; // 5 MB 分块大小，你可以根据需要调整
    const filePath = encodeURIComponent(`colorink.top/` + file.name)
    const uploadSessionResponse = await fetch(apiHost + '/me/drive/root:/' + filePath + ':/createUploadSession', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + tokenInfo.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        '@microsoft.graph.conflictBehavior': 'replace' // 如果文件已存在，替换它
      })
    });

    const uploadSessionData = await uploadSessionResponse.json();
    const uploadUrl = uploadSessionData.uploadUrl;
    let start = 0;
    let end = Math.min(chunkSize, file.size);
    let chunkNumber = 0;
    let response = null

    while (start < file.size) {
      const chunk = file.slice(start, end);
      response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes ${start}-${end - 1}/${file.size}`,
          'Content-Length': chunk.size,
    //      'Authorization': 'Bearer ' + tokenInfo.accessToken,
        },
        body: chunk
      });

      if (!response.ok) {
        const errorMsg = response.statusText || response.status
        console.error('分块上传失败:', errorMsg);
        throw "upload fail:" + errorMsg;
        return;
      }

      chunkNumber++;
      console.log(`分块 ${chunkNumber} 上传成功`);

      start = end;
      end = Math.min(start + chunkSize, file.size);
    }
    if (response) {
      const result = await response.json()
      if (result.error) {
        throw result.error
      }
      return result
    }
    console.log('文件上传完成！');
    return
  }
};


class BoxStore extends BaseStore {
  async checkAuth(initInfo) {
    return await checkAuthFn(initInfo)
  }
  async auth(){
    return await authFn()
  }
  async uploadFile(file){
    const result = await uploadFileFn(file)
    const url = `https://app.box.com/file/` + result.id
    return {
      pdfInfo: file._pdfInfo,
      msg: `Upload success location: <a href="${url}" target="_blank">Box/colorink.top/${_.escape(result.name)}</a>`,
      fileId: result.id,
      url
    }
  }
}

const init = async () => {
  const boxStore = new BoxStore();
  boxStore.start()
};

init()
