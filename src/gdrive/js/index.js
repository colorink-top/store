import { BaseStore } from "../../base/js/base.js";

const STORAGEKEY = "gdriveTokenInfo";
const scope = "https://www.googleapis.com/auth/drive.file";
const client_id =
  "427922301164-eukho3o4bjrc3115mqj0si2qundqfb2k.apps.googleusercontent.com";
const client_secret = "";
//const redirect_uri = "http://localhost:2022";
const redirect_uri = document.location.origin;
//const accessTokenUrl = 'http://localhost:3034/oauth2/google'
const accessTokenUrl = 'https://oauth.colorink.top/oauth2/google'
const foldPath = `colorink.top`;

let tokenInfo = null;

const checkAuthFn = async (initInfo = {}) => {
  initInfo = initInfo || {};
  const tokenInfoStr = localStorage.getItem(STORAGEKEY) || "";
  try {
    tokenInfo = initInfo.authInfo || JSON.parse(tokenInfoStr);
    if (!tokenInfo || !tokenInfo.accessToken || !tokenInfo.accessTokenSecret)
      return false;
  } catch (err) {
    console.log("err", err);
    return false;
  }
  try {
    // [web services - How can I verify a Google authentication API access token? - Stack Overflow](https://stackoverflow.com/questions/359472/how-can-i-verify-a-google-authentication-api-access-token)
    let req = await fetch(
      "https://www.googleapis.com/oauth2/v1/tokeninfo?" +
        new URLSearchParams({ access_token: tokenInfo.accessToken })
    );
    let result = await req.json();
    if (result && result.audience) {
      return true;
    }
    console.log("try get access token by refresh token");
    tokenInfo = await getAccessTokenOnServerFn({refresh_token: tokenInfo.accessTokenSecret})
    localStorage.setItem(STORAGEKEY, JSON.stringify(tokenInfo));
    return true;

    req = await fetch("https://oauth2.googleapis.com/token", {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        client_id,
        client_secret,
        grant_type: "refresh_token",
        refresh_token: tokenInfo.accessTokenSecret,
      }),
    });
    result = await req.json();
    if (result && result.access_token) {
      tokenInfo = {
        accessToken: result.access_token,
        accessTokenSecret: result.refresh_token,
        extraInfo: result,
      };
      localStorage.setItem(STORAGEKEY, JSON.stringify(tokenInfo));
      return true;
    }

    console.log("no permission", result);
    throw "no permission";
  } catch (err) {
    console.log("refresh err", err);
    localStorage.removeItem(STORAGEKEY);
    return false;
  }
  return true;
};


const getAccessTokenOnClientFn = async (opts)=>{
  const code = opts.code || opts.refresh_token
  const args = {
    client_id,
    client_secret,
    code,
    grant_type: "authorization_code",
    redirect_uri,
  }
  if (opts.code) {
    args['code'] = code
    args['grant_type'] = "authorization_code"
  } else {
    args['refresh_token'] = code
    args['grant_type'] = 'refresh_token'
  }
  const req = await fetch("https://oauth2.googleapis.com/token", {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(args),
  });
  const result = await req.json();
  if (result && result.access_token) {
    const _result = {
      accessToken: result.access_token,
      accessTokenSecret: result.refresh_token,
      extraInfo: result,
    };
    return _result;
  }
  throw "auth fail" + result;
}


const getAccessTokenOnServerFn = async (opts)=>{
  const req = await fetch(accessTokenUrl + '?' +  new URLSearchParams({
    redirect_uri,
    ...opts
  }))
  return await req.json()
}

const authFn = async () => {
  return new Promise((resolve, reject) => {
    const client1 = google.accounts.oauth2.initCodeClient({
      client_id,
      scope,
      ux_mode: "popup",
      access_type: "offline",
      prompt: "consent",
      error_callback: (err) => {
        reject(err.type || err.message || err);
      },
      callback: (response) => {
        if (response.error) {
          reject(response.error_description || response.error);
          return;
        }
        getAccessTokenOnServerFn({code: response.code}).then((result)=>{
          resolve(result)
        }).catch((err)=>{
          reject(err.message || err);
        })
      },
    });
    client1.requestCode();
  });
};

const createOrUpdateFolderFn = async () => {
  let req = await fetch(
    "https://www.googleapis.com/drive/v3/files?" +
      new URLSearchParams({
        q: `name = '${foldPath}' or mimeType = 'application/vnd.google-apps.folder'`,
      }),
    {
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + tokenInfo.accessToken,
      },
      method: "GET",
    }
  );
  let result = await req.json();
  if (result.files.length > 0) {
    return result.files[0].id
  }
  req = await fetch('https://www.googleapis.com/drive/v3/files', {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer " + tokenInfo.accessToken,
    },
    method: "POST",
    body: JSON.stringify({
      name: foldPath,
      mimeType: 'application/vnd.google-apps.folder'
    })
  })
  result = await req.json()
  return result.id
};

const uploadFileFn = async (file) => {
  const UPLOAD_FILE_SIZE_LIMIT = 150 * 1024 * 1024;
  const parentFoldId = await createOrUpdateFolderFn()
  return new Promise(async (resolve, reject) => {
    const metadata = {
      name: file.name,
      mimeType: file.type,
      parents: [parentFoldId]
    };
    var form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", file);
    try {
      const req = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          headers: {
            Accept: "application/json",
            Authorization: "Bearer " + tokenInfo.accessToken,
          },
          method: "POST",
          body: form,
        }
      );
      const result = await req.json();
      console.log("success upload ::::", result);
      resolve({
        fileId: result.id,
        url: "https://drive.google.com/file/d/" + result.id,
      });
    } catch (e) {
      reject(e);
    }
  });
};

class GdriveStore extends BaseStore {
  async checkAuth(initInfo) {
    return await checkAuthFn(initInfo);
  }
  async auth() {
    return await authFn();
  }
  async uploadFile(file) {
    return await uploadFileFn(file);
  }
}

const start = async () => {
  const gdriveStore = new GdriveStore();
  gdriveStore.start();
};

gapi.load("client", start);
