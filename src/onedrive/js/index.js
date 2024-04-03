import { BaseStore } from "../../base/js/base.js";

const STORAGEKEY = 'onedriveTokenInfo'

const client_id = 'd9de663c-0a36-4cb8-ad88-9a5c879d95f4';
const client_secret = '';
//const redirect_uri = 'http://localhost:2022/onedrive/callback.html'
//const redirect_uri = 'https://store.colorink.top/onedrive/callback.html'
const redirect_uri = document.location.origin + '/onedrive/callback.html';
const apiHost = 'https://graph.microsoft.com/v1.0'
//const accessTokenUrl = 'http://localhost:3034/oauth2/microsoft'
const accessTokenUrl = 'https://store.colorink.top/oauth2/microsoft'

let tokenInfo = null

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
      apiHost + "/me/drives",
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
    if (result.value) {
      // 不需要再认证了
      return true
    }
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

  const uri = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' + new URLSearchParams({
    response_type: 'code',
    scope: 'offline_access Files.ReadWrite Files.ReadWrite.AppFolder',
    //scope: 'Files.ReadWrite Files.ReadWrite.AppFolder',
    client_id,
    redirect_uri,
  })
  const opener = window.open(uri, 'onedrive', 'popup=true,width=800,height=800')
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
            debugger
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
          window.removeEventListener("message", messageFn);
          break
        }
      }
    }
    window.addEventListener("message", messageFn);
  })
}

const uploadFileFn = async (file) => {
  const UPLOAD_FILE_SIZE_LIMIT = 4 * 1024 * 1024;
  if (file.size < UPLOAD_FILE_SIZE_LIMIT) {
    //dbx.auth.setAccessToken('xxxx')
    // File is smaller than 150 MB - use filesUpload API
    const filePath = encodeURIComponent(`colorink.top/` + file.name)
    const uploadUrl = apiHost + '/me/drive/root:/' + filePath + ':/content';
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + tokenInfo.accessToken,
      },
      body: file
    })
    const result = await response.json()
    if (result.error) {
      throw result.error
    }
    console.log('upload success', result)
    var results = document.getElementById("results");
    var br = document.createElement("br");
    results.appendChild(document.createTextNode("File uploaded!"));
    results.appendChild(br);
    return result
  } else {
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


class OnedriveStore extends BaseStore {
  async checkAuth(initInfo) {
    return await checkAuthFn(initInfo)
  }
  async auth(){
    return await authFn()
  }
  async uploadFile(file){
    return await uploadFileFn(file)
  }
}

const init = async () => {
  const onedriveStore = new OnedriveStore();
  onedriveStore.start()
};

init()
