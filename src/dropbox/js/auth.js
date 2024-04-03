
const authFn = async ()=>{
  const dbx = new Dropbox.Dropbox({ clientId: "clu8ul5tzsgxrwn"})
  //const uri = 'https://markdown.xiaoshujiang.com' + '/dropboxv2.html'
  const uri = 'http://localhost:2022/callback.html'
  const authUrl = await dbx.auth.getAuthenticationUrl(uri, undefined, 'code', 'offline', undefined, undefined, true)
  console.log('authUrl::', authUrl)
}
