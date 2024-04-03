const authFn = ()=>{
  console.log('auth......')
}

const client1 = google.accounts.oauth2.initCodeClient({
  client_id: '427922301164-eukho3o4bjrc3115mqj0si2qundqfb2k.apps.googleusercontent.com',
  scope: 'https://www.googleapis.com/auth/drive.file',
  ux_mode: 'popup',
  //ux_mode: 'redirect',
  //ux_mode: 'popup',
  access_type: "offline",
  prompt: 'consent',
  callback: async (response) => {
    const req = await fetch('http://localhost:3034/oauth2/google?' +  new URLSearchParams({code: response.code}))
    const reqJson = await req.json()
    console.log('receicveee :::', response.code, reqJson)
  },
});


const client = google.accounts.oauth2.initTokenClient({
  client_id: '427922301164-eukho3o4bjrc3115mqj0si2qundqfb2k.apps.googleusercontent.com',
  scope: 'https://www.googleapis.com/auth/drive.file',
  callback: (response) => {
    console.log('token:::', response)
  },
});
