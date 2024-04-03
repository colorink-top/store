
//const client_id = '52e7b04a-bba1-4036-8961-05d95d5cdad3';
const client_id = 'd9de663c-0a36-4cb8-ad88-9a5c879d95f4';
const redirect_uri = 'http://localhost:2022/onedrive/callback.html'
const btnEl = document.querySelector('.authorizate-btn')
btnEl.onclick = ()=>{
  // https://login.microsoftonline.com/common/oauth2/authorize?response_type=code&client_id=${client_id}&redirect_uri=${redirect_uri}
  //window.open('https://login.microsoftonline.com/common/oauth2/authorize?' + new URLSearchParams({
  window.open('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' + new URLSearchParams({
    response_type: 'code',
    scope: 'offline_access Files.ReadWrite Files.ReadWrite.AppFolder',
    //scope: 'Files.ReadWrite Files.ReadWrite.AppFolder',
    client_id,
    redirect_uri,
  }), 'onedrive', 'popup=true,width=800,height=600')
}

/*
 *
 *
 *

          fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      headers: {
        Accept: "application/json",
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
            method: 'POST',
            body: new URLSearchParams({
              client_id: 'd9de663c-0a36-4cb8-ad88-9a5c879d95f4',
              client_secret: '',
              redirect_uri: 'http://localhost:2022/onedrive/callback.html',
              grant_type: "authorization_code",
              code:  ''
            })
          })

*/
