import Swal from './libs/sweetalert2.esm.js'
import { showDimmer, hideDimmer } from './utils.js'

const processMap = {}

const STORAGEUSAGECOUNTKEY = 'storageUsageCount'

let initEvent = null

const initMessageListener = (uniqueId) => {
  return new Promise((resolve, reject)=>{
    const messageFn = (event) => {
      if (event.source === window) {
        return;
      }
      const msg = event.data || {};
      switch (msg.type) {
        case "init": {
          if (initEvent) return // 已经
          if (uniqueId != msg.uniqueId) return
          initEvent = event;
          event.source.postMessage({ type: uniqueId + ".inited", skipData: true }, event.origin);
          window.removeEventListener("message", messageFn);
          if (msg.data && !msg.data.authInfo) {
            msg.data.authInfo = {}
          }
          resolve(msg.data)
          break;
        }
      }
    };
    window.addEventListener("message", messageFn);
  })
};

/**
 * return  {authInfo, certification, files}
 **/
export const getInitInfo = async () => {
  if (window.parent === window) return
  const params =  new URLSearchParams(document.location.search);
  const uniqueId = params.get('uniqueid') + "";
  window.parent.postMessage({type: uniqueId + '.init', uniqueId}, '*')
  return await initMessageListener(uniqueId);
}


export const sendResult = async (data)=>{
  if (!initEvent) return
  const uniqueId = initEvent.data.uniqueId;
  initEvent.source.postMessage({
    type: uniqueId + ".result",
    data
  }, initEvent.origin)
}

export class BaseStore {
  constructor(){}
  async #start(){
    showDimmer()
    let vipType = 'free'
    const initInfo = await getInitInfo();
    if (initInfo && initInfo.certification) {
      vipType = initInfo.certification.vipType
      if (['free', 'VIP1'].indexOf(vipType) >=0) {
        const count = parseInt(localStorage.getItem(STORAGEUSAGECOUNTKEY)) || 0
        if (count > 50) {
          showDimmer('This feature is only available to VIP2 user.<br/> You have exceeded the maximum usages limit, <br/>please upgrade first.', {html: true})
          return
        }
      }
    }
    const isAuth = await this.checkAuth(initInfo)
    if (!isAuth) {
      const authInfo = await this.initAuth()
      if (initInfo) {
        initInfo.authInfo = authInfo // 刷新返回的认证
      }
    }
    const fileEl = document.querySelector(".file-input");
    const submitBtnEl = document.querySelector('.submit-file-btn')
    if (submitBtnEl) {
      submitBtnEl.onclick = async ()=>{
        const file = fileEl.files[0]
        if (file) {
          showDimmer()
          await this.uploadFile(file);
          hideDimmer()
        }
      }
    }
    if (initInfo) {
      let uploadResult = null
      let results = []
      const files = initInfo.pdfInfos?.map((pdfInfo)=>{
        const file = new File([pdfInfo.data], pdfInfo.meta.filename, {type: pdfInfo.data.type})
        //mapInfo[file] = pdfInfo
        file._pdfInfo = pdfInfo
        //files.push(file)
        return file
      }) || []
      if (files.length > 0) {
        results = await this.uploadFiles(files, initInfo)
        if (['free', 'VIP1'].indexOf(vipType) >=0) {
          const count = parseInt(localStorage.getItem(STORAGEUSAGECOUNTKEY))|| 0
          localStorage.setItem(STORAGEUSAGECOUNTKEY, count+1)
        }
      }
      sendResult({
        authInfo: initInfo.authInfo,
        result: results,
      })
    } else {
      document.querySelector('.upload-container').style.display = '';
    }
    hideDimmer();
  }
  async start(){
    this.#start().catch((err)=>{
      sendResult({
        error: err
      })
    })
  }
  async initAuth(){
    const result = await Swal.fire({
      title: "Authorization",
      showDenyButton: false,
      showCancelButton: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      allowOutsideClick: false,
      confirmButtonText: "Authorize this app",
    });
    if (result.isConfirmed) {
      showDimmer()
      return await this.auth()
    }
  }
  async checkAuth(initInfo) {
    throw "Impelment required"
  }
  async auth(){
    throw "Impelment required"
  }
  async uploadFiles(files, opts){
    const results = []
    for (let file of files) {
      const uploadResult = await this.uploadFile(file, opts)
      results.push(uploadResult)
    }
    return results
  }
  async uploadFile(file, opts){
    throw "Impelment required"
  }
}
