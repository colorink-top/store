import { BaseStore } from "../../base/js/base.js";

const STORAGEKEY = 'onenoteTokenInfo'

const client_id = 'd9de663c-0a36-4cb8-ad88-9a5c879d95f4';
const client_secret = '';
//const redirect_uri = 'http://localhost:2022/onedrive/callback.html'
//const redirect_uri = 'https://store.colorink.top/onedrive/callback.html'
const redirect_uri = document.location.origin + '/onedrive/callback.html';
const apiHost = 'https://graph.microsoft.com/v1.0'
//const accessTokenUrl = 'http://localhost:3034/oauth2/microsoft'
const accessTokenUrl = 'https://oauth.colorink.top/oauth2/microsoft'

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
      apiHost + "/me/onenote/notebooks",
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
    scope: 'offline_access Notes.ReadWrite',
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

const uploadFileFn = async (files, opts) => {
  const UPLOAD_FILE_SIZE_LIMIT = 4 * 1024 * 1024;
  const formData = new FormData();
  const fileObjs = []
  let title = ''
  for (let _i = 0; _i < files.length; _i++) {
    const file = files[_i]
    const name = 'name_' + _i
    if (!title) {
      title = file.name
    }
    formData.append(name, file)
    fileObjs.push({name, filename: file.name, type: file.type})
  }
  const objHtmls = fileObjs.map((fileObj)=>{
    return `<object data-attachment="${_.escape(fileObj.filename)}" data="name:${fileObj.name}" type="${_.escape(fileObj.type)}" />`
  })
  //dbx.auth.setAccessToken('xxxx')
  // File is smaller than 150 MB - use filesUpload API
  const createdDate = new Date()

  const htmlStr = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>${_.escape(title)}</title>
      <meta name="created" content="${createdDate}" />
    </head>
    <body>
      <div>gggggg</div>
      ${objHtmls.join('<br/>')}
    </body>
  </html>
  `
  const uploadUrl = apiHost + '/me/onenote/pages?' + new URLSearchParams({sectionName: 'colorink.top'});
  formData.append('Presentation', new File([htmlStr], 'htmlfile', {type: 'text/html'}))
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + tokenInfo.accessToken,
    },
    body: formData
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
};


class OnedriveStore extends BaseStore {
  async checkAuth(initInfo) {
    return await checkAuthFn(initInfo)
  }
  async auth(){
    return await authFn()
  }
  async uploadFiles(files, opts){
    const result =  await uploadFileFn(files, opts)
    const url = result.links.oneNoteWebUrl.href
    return {
      msg: `Upload success location: <a href="${url}" target="_blank">root/colorink.top/${ _.escape(result.title)}</a>`,
      fileId: result.id,
      url 
    }
  }
  async uploadFile(file, opts) {
    const result = await this.uploadFiles([file], opts)
    return result[0]
  }
}

const init = async () => {
  const onedriveStore = new OnedriveStore();
  onedriveStore.start()
};

init()
